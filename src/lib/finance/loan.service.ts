import prisma from '@/lib/prisma';
import { PaymentMethodType, type Prisma } from '@/generated/prisma/client';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import type {
  CreateLoanInput,
  UpdateLoanInput,
  UpdateLoanPaymentInput,
} from '@/schemas/loan.schema';
import {
  calculateLoanProgress,
  deriveLoanStatusFromPayments,
  formatDateYmd,
  generateLoanPaymentSchedule,
  parseYmdAsUtcDate,
} from '@/lib/finance/loan-schedule';
import { todayCalendarDate } from '@/lib/calendar-dates';
import {
  applyWalletAmountDelta,
  getPaidExpenseWalletDelta,
  isFundingWalletType,
} from '@/lib/finance/wallet-accounting';
import { createExpenseInTransaction } from '@/lib/finance/expense.service';
import { resolveOrCreateFortnight } from '@/lib/fortnights';
import { getFortnightPeriodForDay } from '@/lib/fortnight-calendar';
import type {
  LoanDuePaymentItem,
  LoanListItem,
  LoanPaymentActionValue,
  LoanPaymentListItem,
  LoanStatusValue,
  PlannerLoanPaymentsResponse,
} from '@/types/loans';

function decimalToNumber(value: unknown): number {
  if (
    typeof value === 'object' &&
    value != null &&
    'toNumber' in value &&
    typeof (value as { toNumber: () => number }).toNumber === 'function'
  ) {
    return (value as { toNumber: () => number }).toNumber();
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function ownerData(ownerType: 'user' | 'house', ownerId: number) {
  return ownerType === 'user'
    ? { user_id: ownerId, house_id: null }
    : { user_id: null, house_id: ownerId };
}

function ownerFromFilter(ownerFilter: OwnerFilter): {
  ownerType: 'user' | 'house';
  ownerId: number;
} {
  return ownerFilter.user_id != null
    ? { ownerType: 'user', ownerId: ownerFilter.user_id }
    : { ownerType: 'house', ownerId: ownerFilter.house_id };
}

async function assertOwnedWallet(
  walletId: number | null | undefined,
  ownerFilter: OwnerFilter,
) {
  if (!walletId) return;
  const wallet = await prisma.wallet.findFirst({
    where: { id: walletId, ...ownerFilter },
    select: { id: true },
  });
  if (!wallet) {
    throw new Error('La billetera seleccionada no pertenece a este contexto');
  }
}

async function assertOwnedFundingWallet(
  walletId: number | null | undefined,
  ownerFilter: OwnerFilter,
) {
  if (!walletId) return;
  const wallet = await prisma.wallet.findFirst({
    where: { id: walletId, ...ownerFilter },
    select: { id: true, type: true },
  });
  if (!wallet) {
    throw new Error('La billetera de pago no pertenece a este contexto');
  }
  if (wallet.type !== 'CASH' && wallet.type !== 'DEBIT_CARD') {
    throw new Error('El préstamo debe pagarse desde efectivo o débito');
  }
}

async function assertOwnedIncomeTemplate(
  incomeTemplateId: number | null | undefined,
  ownerFilter: OwnerFilter,
) {
  if (!incomeTemplateId) return;
  const template = await prisma.incomeTemplate.findFirst({
    where: { id: incomeTemplateId, ...ownerFilter },
    select: { id: true },
  });
  if (!template) {
    throw new Error('La plantilla de ingreso seleccionada no pertenece a este contexto');
  }
}

function mapPayment(
  payment: {
    id: number;
    loan_id: number;
    sequence: number;
    due_date: Date;
    amount: unknown;
    status: string;
    paid_at: Date | null;
    source_wallet_id: number | null;
    source_wallet?: { name: string } | null;
    linked_expense?: { id: number } | null;
    note: string | null;
  },
): LoanPaymentListItem {
  return {
    id: payment.id,
    loanId: payment.loan_id,
    sequence: payment.sequence,
    dueDate: formatDateYmd(payment.due_date),
    amount: decimalToNumber(payment.amount),
    status: payment.status as LoanPaymentListItem['status'],
    paidAt: payment.paid_at ? formatDateYmd(payment.paid_at) : null,
    sourceWalletId: payment.source_wallet_id,
    sourceWalletName: payment.source_wallet?.name ?? null,
    linkedExpenseId: payment.linked_expense?.id ?? null,
    note: payment.note,
  };
}

function mapLoan(
  loan: {
    id: number;
    name: string;
    lender: string;
    type: string;
    status: string;
    principal_amount: unknown;
    payment_amount: unknown;
    payment_count: number;
    frequency: string;
    start_date: Date;
    payment_source: string;
    source_wallet_id: number | null;
    source_wallet?: { name: string } | null;
    linked_wallet_id: number | null;
    linked_wallet?: { name: string } | null;
    income_template_id: number | null;
    income_template?: { name: string } | null;
    notes: string | null;
    payments: Array<Parameters<typeof mapPayment>[0]>;
  },
): LoanListItem {
  const payments = loan.payments.map(mapPayment);
  const progress = calculateLoanProgress({
    principalAmount: decimalToNumber(loan.principal_amount),
    payments,
  });
  const nextPayment =
    payments
      .filter((p) => p.status === 'SCHEDULED')
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] ?? null;

  return {
    id: loan.id,
    name: loan.name,
    lender: loan.lender,
    type: loan.type as LoanListItem['type'],
    status: loan.status as LoanListItem['status'],
    principalAmount: decimalToNumber(loan.principal_amount),
    paymentAmount: decimalToNumber(loan.payment_amount),
    paymentCount: loan.payment_count,
    frequency: loan.frequency as LoanListItem['frequency'],
    startDate: formatDateYmd(loan.start_date),
    paymentSource: loan.payment_source as LoanListItem['paymentSource'],
    sourceWalletId: loan.source_wallet_id,
    sourceWalletName: loan.source_wallet?.name ?? null,
    linkedWalletId: loan.linked_wallet_id,
    linkedWalletName: loan.linked_wallet?.name ?? null,
    incomeTemplateId: loan.income_template_id,
    incomeTemplateName: loan.income_template?.name ?? null,
    notes: loan.notes,
    ...progress,
    nextPayment,
    payments,
  };
}

const loanInclude = {
  source_wallet: { select: { name: true } },
  linked_wallet: { select: { name: true } },
  income_template: { select: { name: true } },
  payments: {
    include: {
      source_wallet: { select: { name: true } },
      linked_expense: { select: { id: true } },
    },
    orderBy: { sequence: 'asc' as const },
  },
};

async function ensureLoanPaymentCategory(
  tx: Prisma.TransactionClient,
  ownerFilter: OwnerFilter,
) {
  const existing = await tx.category.findFirst({
    where: { ...ownerFilter, name: 'Pago de préstamos' },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await tx.category.create({
    data: {
      ...ownerFilter,
      name: 'Pago de préstamos',
      description: 'Pagos generados desde préstamos',
      icon: '🏦',
    },
    select: { id: true },
  });
  return created.id;
}

async function reverseAndDeleteLoanPaymentExpense(
  tx: Prisma.TransactionClient,
  expense: {
    id: number;
    wallet_id: number | null;
    amount: unknown;
    is_paid: boolean;
    wallet: { type: PaymentMethodType } | null;
  },
) {
  if (expense.is_paid && expense.wallet_id != null && expense.wallet != null) {
    await applyWalletAmountDelta(
      tx,
      expense.wallet_id,
      -getPaidExpenseWalletDelta(expense.wallet.type, Number(expense.amount)),
    );
  }

  await tx.expense.delete({ where: { id: expense.id } });
}

async function createLinkedLoanPaymentExpense(input: {
  tx: Prisma.TransactionClient;
  ownerFilter: OwnerFilter;
  paymentId: number;
  paidAt: Date;
  amount: number;
  sourceWalletId: number;
  loanName: string;
  lender: string;
}) {
  const { ownerType, ownerId } = ownerFromFilter(input.ownerFilter);
  const year = input.paidAt.getUTCFullYear();
  const month = input.paidAt.getUTCMonth() + 1;
  const day = input.paidAt.getUTCDate();
  const period = getFortnightPeriodForDay(day);
  const fortnight = await resolveOrCreateFortnight({
    ownerType,
    ownerId,
    year,
    month,
    period,
    tx: input.tx,
  });
  const categoryId = await ensureLoanPaymentCategory(input.tx, input.ownerFilter);

  return createExpenseInTransaction(input.tx, {
    fortnightId: fortnight.id,
    categoryId,
    description: `Pago préstamo: ${input.loanName} (${input.lender})`,
    amount: input.amount,
    isPaid: true,
    paymentDate: formatDateYmd(input.paidAt),
    walletId: input.sourceWalletId,
    loanPaymentId: input.paymentId,
  });
}

function normalizeLoanPaymentAction(
  input: UpdateLoanPaymentInput,
): LoanPaymentActionValue {
  if (input.action) return input.action;

  if (input.status === 'PAID') return 'MARK_PAID';
  if (input.status === 'SKIPPED') return 'SKIP';
  if (input.status === 'CANCELLED') return 'CANCEL';
  return 'MARK_SCHEDULED';
}

function statusForLoanPaymentAction(action: LoanPaymentActionValue) {
  if (action === 'MARK_PAID') return 'PAID';
  if (action === 'SKIP') return 'SKIPPED';
  if (action === 'CANCEL') return 'CANCELLED';
  return 'SCHEDULED';
}

function assertLoanStatusTransition(
  currentStatus: LoanStatusValue,
  nextStatus: LoanStatusValue,
) {
  if (currentStatus === nextStatus) return;

  if (nextStatus === 'PAUSED' && currentStatus !== 'ACTIVE') {
    throw new Error('Solo los préstamos activos se pueden pausar');
  }
  if (nextStatus === 'ACTIVE' && currentStatus !== 'PAUSED') {
    throw new Error('Solo los préstamos pausados se pueden reanudar');
  }
  if (
    nextStatus === 'CANCELLED' &&
    currentStatus !== 'ACTIVE' &&
    currentStatus !== 'PAUSED'
  ) {
    throw new Error('Solo los préstamos activos o pausados se pueden cancelar');
  }
  if (currentStatus === 'CANCELLED') {
    throw new Error('Los préstamos cancelados no se pueden reactivar');
  }
  if (currentStatus === 'PAID_OFF') {
    throw new Error('Los préstamos pagados permanecen en historial');
  }
}

export async function listLoansByOwner(
  ownerFilter: OwnerFilter,
): Promise<LoanListItem[]> {
  const loans = await prisma.loan.findMany({
    where: ownerFilter,
    include: loanInclude,
    orderBy: [{ status: 'asc' }, { created_at: 'desc' }],
  });
  return loans.map(mapLoan);
}

export async function createLoanForOwner(
  ownerType: 'user' | 'house',
  ownerId: number,
  ownerFilter: OwnerFilter,
  input: CreateLoanInput,
): Promise<LoanListItem> {
  await Promise.all([
    assertOwnedFundingWallet(input.sourceWalletId, ownerFilter),
    assertOwnedWallet(input.linkedWalletId, ownerFilter),
    assertOwnedIncomeTemplate(input.incomeTemplateId, ownerFilter),
  ]);

  const startDate = parseYmdAsUtcDate(input.startDate);
  const schedule = generateLoanPaymentSchedule({
    startDate,
    paymentAmount: input.paymentAmount,
    paymentCount: input.paymentCount,
    frequency: input.frequency,
  });

  const loan = await prisma.loan.create({
    data: {
      ...ownerData(ownerType, ownerId),
      name: input.name,
      lender: input.lender,
      type: input.type,
      principal_amount: input.principalAmount.toString(),
      payment_amount: input.paymentAmount.toString(),
      payment_count: input.paymentCount,
      frequency: input.frequency,
      start_date: startDate,
      payment_source: input.paymentSource,
      source_wallet_id:
        input.paymentSource === 'WALLET' ? input.sourceWalletId : null,
      linked_wallet_id: input.linkedWalletId ?? null,
      income_template_id:
        input.paymentSource === 'PAYROLL_DEDUCTION'
          ? (input.incomeTemplateId ?? null)
          : null,
      notes: input.notes?.trim() || null,
      payments: {
        create: schedule.map((payment) => ({
          sequence: payment.sequence,
          due_date: payment.dueDate,
          amount: payment.amount.toString(),
          source_wallet_id:
            input.paymentSource === 'WALLET' ? input.sourceWalletId : null,
        })),
      },
    },
    include: loanInclude,
  });

  return mapLoan(loan);
}

export async function updateLoanForOwner(
  loanId: number,
  ownerFilter: OwnerFilter,
  input: UpdateLoanInput,
): Promise<LoanListItem> {
  const existing = await prisma.loan.findFirst({
    where: { id: loanId, ...ownerFilter },
    select: {
      id: true,
      status: true,
      payment_source: true,
    },
  });
  if (!existing) {
    throw new Error('Préstamo no encontrado');
  }

  await Promise.all([
    assertOwnedWallet(input.linkedWalletId, ownerFilter),
    assertOwnedIncomeTemplate(input.incomeTemplateId, ownerFilter),
  ]);

  if (
    existing.payment_source !== 'PAYROLL_DEDUCTION' &&
    input.incomeTemplateId != null
  ) {
    throw new Error('La plantilla de ingreso solo aplica a préstamos de nómina');
  }

  const data: Prisma.LoanUncheckedUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.lender !== undefined) data.lender = input.lender;
  if (input.linkedWalletId !== undefined) {
    data.linked_wallet_id = input.linkedWalletId;
  }
  if (input.incomeTemplateId !== undefined) {
    data.income_template_id =
      existing.payment_source === 'PAYROLL_DEDUCTION'
        ? input.incomeTemplateId
        : null;
  }
  if (input.notes !== undefined) data.notes = input.notes?.trim() || null;
  if (input.status !== undefined) {
    assertLoanStatusTransition(
      existing.status as LoanStatusValue,
      input.status as LoanStatusValue,
    );
    data.status = input.status;
  }

  const loan = await prisma.loan.update({
    where: { id: loanId },
    data,
    include: loanInclude,
  });

  return mapLoan(loan);
}

export async function updateLoanPaymentForOwner(
  paymentId: number,
  ownerFilter: OwnerFilter,
  input: UpdateLoanPaymentInput,
): Promise<LoanPaymentListItem> {
  await assertOwnedFundingWallet(input.sourceWalletId, ownerFilter);
  const action = normalizeLoanPaymentAction(input);
  const targetStatus = statusForLoanPaymentAction(action);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.loanPayment.findFirst({
      where: { id: paymentId, loan: ownerFilter },
      include: {
        linked_expense: {
          select: {
            id: true,
            wallet_id: true,
            amount: true,
            is_paid: true,
            wallet: { select: { type: true } },
          },
        },
        loan: {
          select: {
            id: true,
            name: true,
            lender: true,
            payment_source: true,
          },
        },
      },
    });
    if (!existing) {
      throw new Error('Pago de préstamo no encontrado');
    }

    const nextSourceWalletId = input.sourceWalletId ?? existing.source_wallet_id;
    const amount = decimalToNumber(existing.amount);
    const wasPaid = existing.status === 'PAID';
    const willBePaid = action === 'MARK_PAID';
    const paidAt =
      willBePaid
        ? parseYmdAsUtcDate(input.paidAt ?? todayCalendarDate())
        : null;

    if (wasPaid && existing.linked_expense) {
      await reverseAndDeleteLoanPaymentExpense(tx, existing.linked_expense);
    } else if (
      wasPaid &&
      existing.loan.payment_source === 'WALLET' &&
      existing.source_wallet_id
    ) {
      await tx.wallet.update({
        where: { id: existing.source_wallet_id },
        data: { amount: { increment: amount } },
      });
    }

    if (existing.loan.payment_source === 'WALLET') {
      if (willBePaid && !nextSourceWalletId) {
        throw new Error('Selecciona la billetera que paga el préstamo');
      }

      if (willBePaid && nextSourceWalletId) {
        const sourceWallet = await tx.wallet.findFirst({
          where: { id: nextSourceWalletId, ...ownerFilter },
          select: { id: true, amount: true, type: true },
        });
        if (!sourceWallet) {
          throw new Error('Billetera de origen no encontrada');
        }
        if (!isFundingWalletType(sourceWallet.type)) {
          throw new Error('El préstamo debe pagarse desde efectivo o débito');
        }
        if (decimalToNumber(sourceWallet.amount) < amount) {
          throw new Error('Saldo insuficiente en la billetera de origen');
        }
      }
    }

    const payment = await tx.loanPayment.update({
      where: { id: paymentId },
      data: {
        status: targetStatus,
        paid_at: paidAt,
        source_wallet_id:
          existing.loan.payment_source === 'WALLET' ? nextSourceWalletId : null,
        note: input.note === undefined ? existing.note : input.note,
      },
      include: {
        source_wallet: { select: { name: true } },
        linked_expense: { select: { id: true } },
      },
    });

    let linkedExpense: { id: number } | null = null;
    if (
      willBePaid &&
      paidAt != null &&
      existing.loan.payment_source === 'WALLET' &&
      nextSourceWalletId
    ) {
      linkedExpense = await createLinkedLoanPaymentExpense({
        tx,
        ownerFilter,
        paymentId,
        paidAt,
        amount,
        sourceWalletId: nextSourceWalletId,
        loanName: existing.loan.name,
        lender: existing.loan.lender,
      });
    }

    const paymentStatuses = await tx.loanPayment.findMany({
      where: { loan_id: existing.loan.id },
      select: { status: true },
    });
    await tx.loan.update({
      where: { id: existing.loan.id },
      data: {
        status: deriveLoanStatusFromPayments(
          paymentStatuses.map((row) => ({
            status: row.status as LoanPaymentListItem['status'],
          })),
        ),
      },
    });

    return mapPayment({
      ...payment,
      linked_expense: linkedExpense ?? payment.linked_expense,
    });
  });
}

export async function listLoanPaymentsForPlannerMonth(
  ownerFilter: OwnerFilter,
  year: number,
  month: number,
): Promise<PlannerLoanPaymentsResponse> {
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  const payments = await prisma.loanPayment.findMany({
    where: {
      due_date: { gte: from, lte: to },
      loan: { ...ownerFilter, status: { in: ['ACTIVE', 'PAID_OFF'] } },
    },
    include: {
      source_wallet: { select: { name: true } },
      linked_expense: { select: { id: true } },
      loan: {
        include: {
          linked_wallet: { select: { name: true } },
          income_template: { select: { name: true } },
        },
      },
    },
    orderBy: [{ due_date: 'asc' }, { sequence: 'asc' }],
  });

  const mapped: LoanDuePaymentItem[] = payments.map((payment) => ({
    ...mapPayment(payment),
    loanName: payment.loan.name,
    lender: payment.loan.lender,
    loanType: payment.loan.type as LoanDuePaymentItem['loanType'],
    paymentSource:
      payment.loan.payment_source as LoanDuePaymentItem['paymentSource'],
    linkedWalletId: payment.loan.linked_wallet_id,
    linkedWalletName: payment.loan.linked_wallet?.name ?? null,
    incomeTemplateName: payment.loan.income_template?.name ?? null,
  }));

  return {
    first: mapped.filter((payment) => {
      const day = Number(payment.dueDate.slice(8, 10));
      return day <= 15;
    }),
    second: mapped.filter((payment) => {
      const day = Number(payment.dueDate.slice(8, 10));
      return day >= 16;
    }),
  };
}

type PlanningFortnightLike = {
  id: number;
  start_date: Date;
  end_date: Date;
};

export type LoanPlanningPayment = {
  id: number;
  loanId: number;
  loanName: string;
  lender: string;
  amount: number;
  dueDate: string;
  paidAt: string | null;
  status: LoanPaymentListItem['status'];
  paymentSource: LoanDuePaymentItem['paymentSource'];
  sourceWalletId: number | null;
  sourceWalletName: string | null;
  linkedExpenseId: number | null;
};

export type LoanPlanningAggregate = {
  total: number;
  paidTotal: number;
  pendingTotal: number;
  count: number;
  pendingCount: number;
  payments: LoanPlanningPayment[];
  upcoming: LoanPlanningPayment[];
};

function containsDate(fortnights: PlanningFortnightLike[], value: Date) {
  const ts = value.getTime();
  return fortnights.some(
    (fortnight) =>
      ts >= fortnight.start_date.getTime() && ts <= fortnight.end_date.getTime(),
  );
}

export async function aggregateLoanPaymentsForFortnights(
  ownerFilter: OwnerFilter,
  fortnights: PlanningFortnightLike[],
): Promise<LoanPlanningAggregate> {
  if (fortnights.length === 0) {
    return {
      total: 0,
      paidTotal: 0,
      pendingTotal: 0,
      count: 0,
      pendingCount: 0,
      payments: [],
      upcoming: [],
    };
  }

  const from = new Date(
    Math.min(...fortnights.map((fortnight) => fortnight.start_date.getTime())),
  );
  const to = new Date(
    Math.max(...fortnights.map((fortnight) => fortnight.end_date.getTime())),
  );

  const rows = await prisma.loanPayment.findMany({
    where: {
      due_date: { gte: from, lte: to },
      status: { in: ['SCHEDULED', 'PAID'] },
      loan: { ...ownerFilter, status: { in: ['ACTIVE', 'PAID_OFF'] } },
    },
    include: {
      source_wallet: { select: { name: true } },
      linked_expense: { select: { id: true } },
      loan: {
        select: {
          id: true,
          name: true,
          lender: true,
          payment_source: true,
        },
      },
    },
    orderBy: [{ due_date: 'asc' }, { sequence: 'asc' }],
  });

  const payments = rows
    .filter((row) => containsDate(fortnights, row.due_date))
    .map((row): LoanPlanningPayment => {
      const mapped = mapPayment(row);
      return {
        id: mapped.id,
        loanId: row.loan.id,
        loanName: row.loan.name,
        lender: row.loan.lender,
        amount: mapped.amount,
        dueDate: mapped.dueDate,
        paidAt: mapped.paidAt,
        status: mapped.status,
        paymentSource: row.loan.payment_source as LoanDuePaymentItem['paymentSource'],
        sourceWalletId: mapped.sourceWalletId,
        sourceWalletName: mapped.sourceWalletName,
        linkedExpenseId: mapped.linkedExpenseId,
      };
    });

  const shouldAddToDashboardTotals = (payment: LoanPlanningPayment) =>
    payment.status === 'SCHEDULED' || payment.linkedExpenseId == null;

  const total = payments
    .filter(shouldAddToDashboardTotals)
    .reduce((sum, payment) => sum + payment.amount, 0);
  const paidTotal = payments
    .filter(
      (payment) =>
        payment.status === 'PAID' && shouldAddToDashboardTotals(payment),
    )
    .reduce((sum, payment) => sum + payment.amount, 0);
  const upcoming = payments.filter((payment) => payment.status === 'SCHEDULED');
  const pendingTotal = upcoming.reduce((sum, payment) => sum + payment.amount, 0);

  return {
    total,
    paidTotal,
    pendingTotal,
    count: payments.length,
    pendingCount: upcoming.length,
    payments,
    upcoming,
  };
}
