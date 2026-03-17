import prisma from '@/lib/prisma';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import {
  getWalletAvailableCredit,
  isCreditWalletType,
} from '@/lib/finance/wallet-accounting';

const MAX_PAYMENT_HISTORY = 25;

const createUtcDate = (year: number, month: number, day: number) =>
  new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));

const toDateOnlyString = (date: Date) => date.toISOString().split('T')[0];

const clampDayToMonth = (year: number, month: number, day: number) =>
  Math.min(day, new Date(Date.UTC(year, month, 0)).getUTCDate());

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const addMonths = (date: Date, months: number, targetDay: number) => {
  const monthIndex = date.getUTCMonth() + months;
  const year = date.getUTCFullYear() + Math.floor(monthIndex / 12);
  const normalizedMonth = ((monthIndex % 12) + 12) % 12;
  const month = normalizedMonth + 1;
  return createUtcDate(year, month, clampDayToMonth(year, month, targetDay));
};

const resolvePreviousOrSameCutoff = (asOf: Date, cutoffDay: number) => {
  const currentMonthCutoff = createUtcDate(
    asOf.getUTCFullYear(),
    asOf.getUTCMonth() + 1,
    clampDayToMonth(asOf.getUTCFullYear(), asOf.getUTCMonth() + 1, cutoffDay),
  );

  if (asOf >= currentMonthCutoff) {
    return currentMonthCutoff;
  }

  return addMonths(currentMonthCutoff, -1, cutoffDay);
};

const resolveDueDate = (statementEnd: Date, dueDay: number) => {
  const candidate = createUtcDate(
    statementEnd.getUTCFullYear(),
    statementEnd.getUTCMonth() + 1,
    clampDayToMonth(
      statementEnd.getUTCFullYear(),
      statementEnd.getUTCMonth() + 1,
      dueDay,
    ),
  );

  if (candidate > statementEnd) {
    return candidate;
  }

  return addMonths(candidate, 1, dueDay);
};

const isWithinRange = (value: Date, start: Date, end: Date) =>
  value.getTime() >= start.getTime() && value.getTime() <= end.getTime();

const toEffectiveExpenseDate = (expense: {
  payment_date: Date | null;
  created_at: Date;
}) => expense.payment_date ?? expense.created_at;

export const resolveCreditCardStatementWindow = (
  asOfDate: Date,
  cutoffDay: number,
  dueDay: number,
) => {
  const statementEnd = resolvePreviousOrSameCutoff(asOfDate, cutoffDay);
  const previousCutoff = addMonths(statementEnd, -1, cutoffDay);
  const statementStart = addDays(previousCutoff, 1);
  const currentCycleStart = addDays(statementEnd, 1);
  const currentCycleEnd = addMonths(statementEnd, 1, cutoffDay);
  const statementDueDate = resolveDueDate(statementEnd, dueDay);

  return {
    statementStart,
    statementEnd,
    currentCycleStart,
    currentCycleEnd,
    statementDueDate,
  };
};

export async function getCreditCardStatementByOwner(
  creditCardId: number,
  ownerFilter: OwnerFilter,
  asOf?: Date,
) {
  const card = await prisma.wallet.findFirst({
    where: { id: creditCardId, ...ownerFilter },
    select: {
      id: true,
      name: true,
      type: true,
      amount: true,
      credit_limit: true,
      cutoff_day: true,
      due_day: true,
    },
  });

  if (!card) {
    const error = new Error('Credit card not found');
    (error as { code?: string }).code = 'P2025';
    throw error;
  }

  if (
    !isCreditWalletType(card.type) ||
    card.cutoff_day == null ||
    card.due_day == null
  ) {
    const error = new Error('Wallet is not configured as a credit card');
    (error as { code?: string }).code = 'INVALID_CREDIT_CARD';
    throw error;
  }

  const normalizedAsOf = asOf ?? new Date();
  const window = resolveCreditCardStatementWindow(
    normalizedAsOf,
    card.cutoff_day,
    card.due_day,
  );

  const [purchases, payments] = await Promise.all([
    prisma.expense.findMany({
      where: {
        ...ownerFilter,
        wallet_id: creditCardId,
        is_paid: true,
      },
      select: {
        id: true,
        description: true,
        amount: true,
        payment_date: true,
        created_at: true,
        category: { select: { name: true } },
      },
      orderBy: [{ payment_date: 'desc' }, { created_at: 'desc' }],
    }),
    prisma.creditCardPayment.findMany({
      where: {
        ...ownerFilter,
        credit_card_wallet_id: creditCardId,
      },
      include: {
        source_wallet: { select: { id: true, name: true } },
        credit_card_wallet: { select: { id: true, name: true } },
      },
      orderBy: { paid_at: 'desc' },
      take: MAX_PAYMENT_HISTORY,
    }),
  ]);

  const statementPurchases = purchases
    .map((expense) => ({
      ...expense,
      effectiveDate: toEffectiveExpenseDate(expense),
      amount: Number(expense.amount),
    }))
    .filter((expense) =>
      isWithinRange(expense.effectiveDate, window.statementStart, window.statementEnd),
    );

  const currentCyclePurchases = purchases
    .map((expense) => ({
      ...expense,
      effectiveDate: toEffectiveExpenseDate(expense),
      amount: Number(expense.amount),
    }))
    .filter((expense) =>
      isWithinRange(expense.effectiveDate, window.currentCycleStart, window.currentCycleEnd),
    );

  const paymentsSinceLastCutoff = payments.filter(
    (payment) => payment.paid_at > window.statementEnd,
  );

  const paymentsAppliedToStatement = payments.filter(
    (payment) =>
      payment.paid_at > window.statementEnd &&
      payment.paid_at <= window.statementDueDate,
  );

  const currentCyclePayments = payments.filter((payment) =>
    isWithinRange(payment.paid_at, window.currentCycleStart, window.currentCycleEnd),
  );

  const lastStatementBalance = statementPurchases.reduce(
    (sum, expense) => sum + expense.amount,
    0,
  );
  const paymentsAfterCutoffTotal = paymentsSinceLastCutoff.reduce(
    (sum, payment) => sum + Number(payment.amount),
    0,
  );
  const paymentsAppliedToStatementTotal = paymentsAppliedToStatement.reduce(
    (sum, payment) => sum + Number(payment.amount),
    0,
  );
  const currentCyclePurchasesTotal = currentCyclePurchases.reduce(
    (sum, expense) => sum + expense.amount,
    0,
  );
  const currentCyclePaymentsTotal = currentCyclePayments.reduce(
    (sum, payment) => sum + Number(payment.amount),
    0,
  );
  const currentBalance = Number(card.amount);
  const creditLimit = card.credit_limit == null ? null : Number(card.credit_limit);

  return {
    credit_card_id: card.id,
    name: card.name,
    type: card.type,
    current_balance: currentBalance,
    credit_limit: creditLimit,
    available_credit: getWalletAvailableCredit({
      amount: currentBalance,
      credit_limit: creditLimit,
    }),
    cutoff_day: card.cutoff_day,
    due_day: card.due_day,
    statement_start: toDateOnlyString(window.statementStart),
    statement_end: toDateOnlyString(window.statementEnd),
    statement_due_date: toDateOnlyString(window.statementDueDate),
    current_cycle_start: toDateOnlyString(window.currentCycleStart),
    current_cycle_end: toDateOnlyString(window.currentCycleEnd),
    outstanding_balance: currentBalance,
    last_statement_balance: lastStatementBalance,
    payments_since_last_cutoff: paymentsAfterCutoffTotal,
    payments_applied_to_statement: paymentsAppliedToStatementTotal,
    next_due_payment: Math.max(
      lastStatementBalance - paymentsAppliedToStatementTotal,
      0,
    ),
    current_cycle_purchases: currentCyclePurchasesTotal,
    current_cycle_payments: currentCyclePaymentsTotal,
    statement_purchases: statementPurchases.map((expense) => ({
      id: expense.id,
      description: expense.description,
      amount: expense.amount,
      payment_date: toDateOnlyString(expense.effectiveDate),
      category: expense.category?.name ?? '',
    })),
    current_cycle_purchase_items: currentCyclePurchases.map((expense) => ({
      id: expense.id,
      description: expense.description,
      amount: expense.amount,
      payment_date: toDateOnlyString(expense.effectiveDate),
      category: expense.category?.name ?? '',
    })),
    payment_history: payments.map((payment) => ({
      id: payment.id,
      amount: Number(payment.amount),
      paid_at: toDateOnlyString(payment.paid_at),
      note: payment.note ?? null,
      source_wallet_id: payment.source_wallet_id,
      source_wallet_name: payment.source_wallet.name,
      credit_card_wallet_id: payment.credit_card_wallet_id,
      credit_card_wallet_name: payment.credit_card_wallet.name,
    })),
  };
}
