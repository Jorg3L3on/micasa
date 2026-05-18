import prisma from '@/lib/prisma';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import type { CreateLoanInput, UpdateLoanPaymentInput } from '@/schemas/loan.schema';
import {
  calculateLoanProgress,
  formatDateYmd,
  generateLoanPaymentSchedule,
  parseYmdAsUtcDate,
} from '@/lib/finance/loan-schedule';
import { applyWalletAmountDelta } from '@/lib/finance/wallet-accounting';
import type {
  LoanDuePaymentItem,
  LoanListItem,
  LoanPaymentListItem,
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
    throw new Error('El prestamo debe pagarse desde efectivo o debito');
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
    include: { source_wallet: { select: { name: true } } },
    orderBy: { sequence: 'asc' as const },
  },
};

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

export async function updateLoanPaymentForOwner(
  paymentId: number,
  ownerFilter: OwnerFilter,
  input: UpdateLoanPaymentInput,
): Promise<LoanPaymentListItem> {
  await assertOwnedFundingWallet(input.sourceWalletId, ownerFilter);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.loanPayment.findFirst({
      where: { id: paymentId, loan: ownerFilter },
      include: { loan: { select: { id: true, payment_source: true } } },
    });
    if (!existing) {
      throw new Error('Pago de prestamo no encontrado');
    }

    const nextSourceWalletId = input.sourceWalletId ?? existing.source_wallet_id;
    const amount = decimalToNumber(existing.amount);
    const wasPaid = existing.status === 'PAID';
    const willBePaid = input.status === 'PAID';

    if (existing.loan.payment_source === 'WALLET') {
      if (willBePaid && !nextSourceWalletId) {
        throw new Error('Selecciona la billetera que paga el prestamo');
      }

      if (wasPaid && existing.source_wallet_id) {
        await applyWalletAmountDelta(tx, existing.source_wallet_id, amount);
      }

      if (willBePaid && nextSourceWalletId) {
        const sourceWallet = await tx.wallet.findFirst({
          where: { id: nextSourceWalletId, ...ownerFilter },
          select: { id: true, amount: true },
        });
        if (!sourceWallet) {
          throw new Error('Billetera de origen no encontrada');
        }
        if (decimalToNumber(sourceWallet.amount) < amount) {
          throw new Error('Saldo insuficiente en la billetera de origen');
        }
        await applyWalletAmountDelta(tx, nextSourceWalletId, -amount);
      }
    }

    const payment = await tx.loanPayment.update({
      where: { id: paymentId },
      data: {
        status: input.status,
        paid_at:
          input.status === 'PAID'
            ? parseYmdAsUtcDate(input.paidAt ?? formatDateYmd(new Date()))
            : null,
        source_wallet_id: nextSourceWalletId,
        note: input.note ?? null,
      },
      include: { source_wallet: { select: { name: true } } },
    });

    const remainingScheduled = await tx.loanPayment.count({
      where: { loan_id: existing.loan.id, status: 'SCHEDULED' },
    });
    await tx.loan.update({
      where: { id: existing.loan.id },
      data: { status: remainingScheduled === 0 ? 'PAID_OFF' : 'ACTIVE' },
    });

    return mapPayment(payment);
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
