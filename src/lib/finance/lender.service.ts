import prisma from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma/client';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import { todayCalendarDate } from '@/lib/calendar-dates';
import { isFundingWalletType } from '@/lib/finance/wallet-accounting';
import { createExpenseInTransaction } from '@/lib/finance/expense.service';
import { resolveOrCreateFortnight } from '@/lib/fortnights';
import { getCalendarFortnightRefForYmd } from '@/lib/fortnight-calendar';
import {
  deriveLoanStatusFromPayments,
  formatDateYmd,
  parseYmdAsUtcDate,
} from '@/lib/finance/loan-schedule';
import { listLoansByOwner } from '@/lib/finance/loan.service';
import { findOrCreateLenderForOwner } from '@/lib/finance/lender-resolve';
import {
  selectLenderPayWindow,
  type LenderWindowPayment,
} from '@/lib/finance/lender-payment-window';
import type { CreateLenderInput, PayLenderInput } from '@/schemas/lender.schema';
import type {
  LenderDetail,
  LenderListItem,
  LenderPaymentListItem,
  LenderPayWindowView,
  PayLenderResult,
} from '@/types/lenders';
import type { LoanListItem, LoanPaymentListItem } from '@/types/loans';

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

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

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

const mapLenderPayment = (row: {
  id: number;
  lender_id: number;
  amount: unknown;
  paid_at: Date;
  mode: string;
  source_wallet_id: number | null;
  source_wallet?: { name: string } | null;
  expense_id: number | null;
  note: string | null;
  loan_payments?: Array<{ id: number }>;
}): LenderPaymentListItem => ({
  id: row.id,
  lenderId: row.lender_id,
  amount: decimalToNumber(row.amount),
  paidAt: formatDateYmd(row.paid_at),
  mode: row.mode as LenderPaymentListItem['mode'],
  sourceWalletId: row.source_wallet_id,
  sourceWalletName: row.source_wallet?.name ?? null,
  expenseId: row.expense_id,
  note: row.note,
  installmentCount: row.loan_payments?.length ?? 0,
});

const toWindowPayments = (loans: LoanListItem[]): LenderWindowPayment[] =>
  loans.flatMap((loan) =>
    (loan.payments ?? []).map((payment) => ({
      id: payment.id,
      loanId: loan.id,
      loanName: loan.name,
      sequence: payment.sequence,
      dueDate: payment.dueDate,
      amount: payment.amount,
      paymentSource: loan.paymentSource,
      loanStatus: loan.status,
      status: payment.status,
    })),
  );

const payWindowView = (
  loans: LoanListItem[],
  todayYmd: string,
): LenderPayWindowView => {
  const window = selectLenderPayWindow(toWindowPayments(loans), todayYmd);
  return {
    amount: window.amount,
    commitmentDate: window.commitmentDate,
    commitmentDateEnd: window.commitmentDateEnd,
    isRange: window.isRange,
    canPay: window.included.length > 0,
    included: window.included.map((row) => ({
      id: row.id,
      loanId: row.loanId,
      loanName: row.loanName,
      sequence: row.sequence,
      dueDate: row.dueDate,
      amount: row.amount,
    })),
  };
};

const buildLenderListItem = (
  lender: {
    id: number;
    name: string;
    provider_icon_key: string | null;
    notes: string | null;
    active: boolean;
  },
  loans: LoanListItem[],
  todayYmd: string,
  recentPayments?: LenderPaymentListItem[],
): LenderListItem => {
  const activeLoans = loans.filter((loan) => loan.status === 'ACTIVE');
  const payrollOnly =
    activeLoans.length > 0 &&
    activeLoans.every((loan) => loan.paymentSource === 'PAYROLL_DEDUCTION');

  return {
    id: lender.id,
    name: lender.name,
    providerIconKey: lender.provider_icon_key,
    notes: lender.notes,
    active: lender.active,
    remainingPrincipal: roundMoney(
      loans.reduce((sum, loan) => sum + loan.remainingAmount, 0),
    ),
    activeContractCount: activeLoans.length,
    payrollOnly,
    payWindow: payWindowView(loans, todayYmd),
    loans,
    recentPayments,
  };
};

export async function createLenderForOwner(
  ownerType: 'user' | 'house',
  ownerId: number,
  ownerFilter: OwnerFilter,
  input: CreateLenderInput,
): Promise<LenderListItem> {
  const lender = await findOrCreateLenderForOwner(
    ownerType,
    ownerId,
    ownerFilter,
    input.name,
  );
  if (input.providerIconKey !== undefined || input.notes !== undefined) {
    await prisma.lender.update({
      where: { id: lender.id },
      data: {
        ...(input.providerIconKey !== undefined
          ? { provider_icon_key: input.providerIconKey }
          : {}),
        ...(input.notes !== undefined
          ? { notes: input.notes?.trim() || null }
          : {}),
      },
    });
  }
  const items = await listLendersByOwner(ownerFilter);
  const created = items.find((item) => item.id === lender.id);
  if (!created) {
    throw new Error('No se pudo crear el prestamista');
  }
  return created;
}

export async function listLendersByOwner(
  ownerFilter: OwnerFilter,
): Promise<LenderListItem[]> {
  const todayYmd = todayCalendarDate();
  const [lenders, loans, payments] = await Promise.all([
    prisma.lender.findMany({
      where: ownerFilter,
      orderBy: { name: 'asc' },
    }),
    listLoansByOwner(ownerFilter),
    prisma.lenderPayment.findMany({
      where: ownerFilter,
      include: {
        source_wallet: { select: { name: true } },
        loan_payments: { select: { id: true } },
      },
      orderBy: [{ paid_at: 'desc' }, { id: 'desc' }],
    }),
  ]);

  const loansByLender = new Map<number, LoanListItem[]>();
  for (const loan of loans) {
    if (loan.lenderId == null) continue;
    const rows = loansByLender.get(loan.lenderId) ?? [];
    rows.push(loan);
    loansByLender.set(loan.lenderId, rows);
  }

  const paymentsByLender = new Map<number, LenderPaymentListItem[]>();
  for (const payment of payments) {
    const rows = paymentsByLender.get(payment.lender_id) ?? [];
    if (rows.length >= 1) continue;
    rows.push(mapLenderPayment(payment));
    paymentsByLender.set(payment.lender_id, rows);
  }

  return lenders.map((lender) =>
    buildLenderListItem(
      lender,
      loansByLender.get(lender.id) ?? [],
      todayYmd,
      paymentsByLender.get(lender.id),
    ),
  );
}

async function loadLenderDetail(
  lenderId: number,
  ownerFilter: OwnerFilter,
): Promise<LenderDetail> {
  const todayYmd = todayCalendarDate();
  const lender = await prisma.lender.findFirst({
    where: { id: lenderId, ...ownerFilter },
  });
  if (!lender) {
    throw new Error('Prestamista no encontrado');
  }

  const [loans, payments] = await Promise.all([
    listLoansByOwner(ownerFilter),
    prisma.lenderPayment.findMany({
      where: { lender_id: lenderId, ...ownerFilter },
      include: {
        source_wallet: { select: { name: true } },
        loan_payments: { select: { id: true } },
      },
      orderBy: [{ paid_at: 'desc' }, { id: 'desc' }],
    }),
  ]);

  const mappedPayments = payments.map(mapLenderPayment);
  return {
    ...buildLenderListItem(
      lender,
      loans.filter((loan) => loan.lenderId === lenderId),
      todayYmd,
      mappedPayments.slice(0, 5),
    ),
    payments: mappedPayments,
  };
}

export async function getLenderByIdForOwner(
  lenderId: number,
  ownerFilter: OwnerFilter,
): Promise<LenderDetail> {
  return loadLenderDetail(lenderId, ownerFilter);
}

async function assertOwnedFundingWallet(
  walletId: number | null | undefined,
  ownerFilter: OwnerFilter,
) {
  if (!walletId) return;
  const wallet = await prisma.wallet.findFirst({
    where: { id: walletId, ...ownerFilter },
    select: { id: true, type: true, amount: true },
  });
  if (!wallet) {
    throw new Error('La billetera de pago no pertenece a este contexto');
  }
  if (!isFundingWalletType(wallet.type)) {
    throw new Error('El prestamista debe pagarse desde efectivo o débito');
  }
  return wallet;
}

export async function payLenderForOwner(
  lenderId: number,
  ownerFilter: OwnerFilter,
  input: PayLenderInput,
): Promise<PayLenderResult> {
  const { ownerType, ownerId } = ownerFromFilter(ownerFilter);
  const detail = await loadLenderDetail(lenderId, ownerFilter);
  const window = selectLenderPayWindow(
    toWindowPayments(detail.loans),
    todayCalendarDate(),
  );
  if (window.included.length === 0) {
    throw new Error('No hay cuotas de billetera para pagar en este periodo');
  }

  const mode = input.mode ?? 'WALLET';
  const paidAt = parseYmdAsUtcDate(input.paidAt ?? todayCalendarDate());
  const sourceWalletId = mode === 'WALLET' ? input.sourceWalletId ?? null : null;

  if (mode === 'WALLET') {
    const wallet = await assertOwnedFundingWallet(sourceWalletId, ownerFilter);
    if (!wallet) {
      throw new Error('Selecciona la billetera que paga al prestamista');
    }
    if (decimalToNumber(wallet.amount) < window.amount) {
      throw new Error('Saldo insuficiente en la billetera de origen');
    }
  }

  const includedIds = window.included.map((row) => row.id);

  const createdPaymentId = await prisma.$transaction(async (tx) => {
    const lenderPayment = await tx.lenderPayment.create({
      data: {
        lender_id: lenderId,
        amount: window.amount.toString(),
        paid_at: paidAt,
        mode,
        source_wallet_id: sourceWalletId,
        note: input.note?.trim() || null,
        ...ownerData(ownerType, ownerId),
      },
    });

    let expenseId: number | null = null;
    if (mode === 'WALLET' && sourceWalletId) {
      const paidYmd = formatDateYmd(paidAt);
      const { year, month, period } = getCalendarFortnightRefForYmd(paidYmd);
      const fortnight = await resolveOrCreateFortnight({
        ownerType,
        ownerId,
        year,
        month,
        period,
        tx,
      });
      const categoryId = await ensureLoanPaymentCategory(tx, ownerFilter);
      const expense = await createExpenseInTransaction(tx, {
        fortnightId: fortnight.id,
        categoryId,
        description: `Pago a ${detail.name}`,
        amount: window.amount,
        isPaid: true,
        paymentDate: paidYmd,
        walletId: sourceWalletId,
      });
      expenseId = expense.id;
      await tx.lenderPayment.update({
        where: { id: lenderPayment.id },
        data: { expense_id: expenseId },
      });
    }

    await tx.loanPayment.updateMany({
      where: { id: { in: includedIds }, loan: ownerFilter },
      data: {
        status: 'PAID',
        paid_at: paidAt,
        source_wallet_id: sourceWalletId,
        lender_payment_id: lenderPayment.id,
        note: input.note?.trim() || undefined,
      },
    });

    const loanIds = [...new Set(window.included.map((row) => row.loanId))];
    for (const loanId of loanIds) {
      const paymentStatuses = await tx.loanPayment.findMany({
        where: { loan_id: loanId },
        select: { status: true },
      });
      await tx.loan.update({
        where: { id: loanId },
        data: {
          status: deriveLoanStatusFromPayments(
            paymentStatuses.map((row) => ({
              status: row.status as LoanPaymentListItem['status'],
            })),
          ),
        },
      });
    }

    return lenderPayment.id;
  });

  const updated = await loadLenderDetail(lenderId, ownerFilter);
  const payment = updated.payments.find((row) => row.id === createdPaymentId);
  if (!payment) {
    throw new Error('No se pudo registrar el pago del prestamista');
  }

  const loanPayments = updated.loans.flatMap((loan) =>
    (loan.payments ?? []).filter((row) => includedIds.includes(row.id)),
  );

  return { lender: updated, payment, loanPayments };
}

export async function undoLenderPaymentForOwner(
  lenderId: number,
  paymentId: number,
  ownerFilter: OwnerFilter,
): Promise<LenderDetail> {
  const existing = await prisma.lenderPayment.findFirst({
    where: { id: paymentId, lender_id: lenderId, ...ownerFilter },
    include: {
      expense: {
        select: {
          id: true,
          wallet_id: true,
          amount: true,
          is_paid: true,
          wallet: { select: { type: true } },
        },
      },
      loan_payments: {
        select: { id: true, loan_id: true },
      },
    },
  });
  if (!existing) {
    throw new Error('Pago del prestamista no encontrado');
  }

  await prisma.$transaction(async (tx) => {
    if (existing.expense) {
      const { applyWalletAmountDelta, getPaidExpenseWalletDelta } = await import(
        '@/lib/finance/wallet-accounting'
      );
      if (
        existing.expense.is_paid &&
        existing.expense.wallet_id != null &&
        existing.expense.wallet != null
      ) {
        await applyWalletAmountDelta(
          tx,
          existing.expense.wallet_id,
          -getPaidExpenseWalletDelta(
            existing.expense.wallet.type,
            Number(existing.expense.amount),
          ),
        );
      }
      await tx.expense.delete({ where: { id: existing.expense.id } });
    }

    await tx.loanPayment.updateMany({
      where: { lender_payment_id: existing.id },
      data: {
        status: 'SCHEDULED',
        paid_at: null,
        lender_payment_id: null,
        note: null,
      },
    });

    const loanIds = [...new Set(existing.loan_payments.map((row) => row.loan_id))];
    for (const loanId of loanIds) {
      const paymentStatuses = await tx.loanPayment.findMany({
        where: { loan_id: loanId },
        select: { status: true },
      });
      await tx.loan.update({
        where: { id: loanId },
        data: {
          status: deriveLoanStatusFromPayments(
            paymentStatuses.map((row) => ({
              status: row.status as LoanPaymentListItem['status'],
            })),
          ),
        },
      });
    }

    await tx.lenderPayment.delete({ where: { id: existing.id } });
  });

  return loadLenderDetail(lenderId, ownerFilter);
}
