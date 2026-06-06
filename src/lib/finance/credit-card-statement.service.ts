import {
  endOfCalendarDay,
  formatCalendarDate,
  parseCalendarDate,
} from '@/lib/calendar-dates';
import prisma from '@/lib/prisma';
import { PaymentMethodType, Prisma } from '@/generated/prisma/client';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import {
  attachPlannedPaymentsToDueItems,
  getEffectiveCardPaymentAmount,
  resolveFortnightIdForDate,
} from '@/lib/finance/credit-card-payment-plan.service';
import {
  buildCardStatementObligation,
  computeNextDuePayment,
  paymentAppliesToStatementPeriod,
  resolveCreditCardStatementWindow,
  toDuePaymentItemFields,
  type ComputeNextDuePaymentInput,
  type CreditCardStatementWindow,
} from '@/lib/finance/card-statement-obligation';
import { isCreditInstallmentExpense } from '@/lib/finance/expense-planning-scope';
import {
  getWalletAvailableCredit,
  isCreditWalletType,
} from '@/lib/finance/wallet-accounting';
import {
  isCalendarFortnightCurrent,
  isCalendarFortnightNext,
} from '@/lib/fortnight-calendar';

export {
  buildCardStatementObligation,
  computeNextDuePayment,
  paymentAppliesToStatementPeriod,
  reconcileDuePaymentItemCanonicalFields,
  resolveCreditCardStatementWindow,
  toDuePaymentItemFields,
  toPlannerCardPaymentStatusUi,
  type CardStatementObligationDto,
  type CardStatementObligationStatus,
  type CardObligationAmountSource,
  type ComputeNextDuePaymentInput,
  type CreditCardStatementWindow,
  type PlannerCardPaymentStatusUi,
} from '@/lib/finance/card-statement-obligation';

const MAX_PAYMENT_HISTORY = 25;

const toDateOnlyString = (date: Date) => formatCalendarDate(date);

const createCalendarDate = (year: number, month: number, day: number) =>
  parseCalendarDate(
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  );

/** Inclusive upper bound for the due calendar day in Mexico City. */
const endOfDueCalendarDay = (date: Date) =>
  endOfCalendarDay(formatCalendarDate(date));

const clampDayToMonth = (year: number, month: number, day: number) =>
  Math.min(day, new Date(Date.UTC(year, month, 0)).getUTCDate());

const addMonths = (date: Date, months: number, targetDay: number) => {
  const monthIndex = date.getUTCMonth() + months;
  const year = date.getUTCFullYear() + Math.floor(monthIndex / 12);
  const normalizedMonth = ((monthIndex % 12) + 12) % 12;
  const month = normalizedMonth + 1;
  return createCalendarDate(year, month, clampDayToMonth(year, month, targetDay));
};

const isWithinRange = (value: Date, start: Date, end: Date) =>
  value.getTime() >= start.getTime() && value.getTime() <= end.getTime();

const toEffectiveExpenseDate = (expense: {
  payment_date: Date | null;
  created_at: Date;
}) => expense.payment_date ?? expense.created_at;

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
      temporary_credit_limit: true,
      cutoff_day: true,
      due_day: true,
    },
  });

  if (!card) {
    const error = new Error('Tarjeta no encontrada');
    (error as { code?: string }).code = 'P2025';
    throw error;
  }

  if (
    !isCreditWalletType(card.type) ||
    card.cutoff_day == null ||
    card.due_day == null
  ) {
    const error = new Error(
      'La billetera no está configurada como tarjeta de crédito',
    );
    (error as { code?: string }).code = 'INVALID_CREDIT_CARD';
    throw error;
  }

  const normalizedAsOf = asOf ?? new Date();
  const window = resolveCreditCardStatementWindow(
    normalizedAsOf,
    card.cutoff_day,
    card.due_day,
  );

  const paymentWhereBase = {
    ...ownerFilter,
    credit_card_wallet_id: creditCardId,
  };

  const [purchases, payments, paymentTotals, statementImports] = await Promise.all([
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
        credit_installment_current: true,
        credit_installment_total: true,
        category: { select: { name: true, icon: true } },
        fortnight: {
          select: { id: true, year: true, month: true, period: true },
        },
      },
      orderBy: [{ payment_date: 'desc' }, { created_at: 'desc' }],
    }),
    prisma.creditCardPayment.findMany({
      where: paymentWhereBase,
      include: {
        source_wallet: { select: { id: true, name: true } },
        credit_card_wallet: { select: { id: true, name: true } },
      },
      orderBy: { paid_at: 'desc' },
      take: MAX_PAYMENT_HISTORY,
    }),
    Promise.all([
      prisma.creditCardPayment.aggregate({
        where: {
          ...paymentWhereBase,
          paid_at: { gt: window.statementEnd },
        },
        _sum: { amount: true },
      }),
      sumPaymentsAppliedToStatementByWallet(
        [creditCardId],
        window,
        ownerFilter,
      ).then((m) => m.get(creditCardId) ?? 0),
      prisma.creditCardPayment.aggregate({
        where: {
          ...paymentWhereBase,
          paid_at: {
            gte: window.currentCycleStart,
            lte: window.currentCycleEnd,
          },
        },
        _sum: { amount: true },
      }),
    ]),
    prisma.creditCardStatementImport.findMany({
      where: { wallet_id: creditCardId },
      orderBy: { created_at: 'desc' },
      select: {
        wallet_id: true,
        total_due: true,
        payment_due_date: true,
        minimum_payment: true,
        period_end: true,
        created_at: true,
      },
    }),
  ]);

  const recentImport = resolveStatementImportForStatementWindow(
    statementImports,
    creditCardId,
    window,
  );

  const importedTotalDue =
    recentImport?.total_due != null ? Number(recentImport.total_due) : null;
  const importedMinimumPayment =
    recentImport?.minimum_payment != null
      ? Number(recentImport.minimum_payment)
      : null;

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

  /** Cuotas con pagos aún pendientes (cuota actual estrictamente menor al total). */
  const installmentActivePurchases = purchases
    .filter(
      (e) =>
        isCreditInstallmentExpense(e) &&
        e.credit_installment_current != null &&
        e.credit_installment_total != null &&
        e.credit_installment_current < e.credit_installment_total,
    )
    .map((expense) => ({
      ...expense,
      effectiveDate: toEffectiveExpenseDate(expense),
      amount: Number(expense.amount),
    }))
    .sort(
      (a, b) => b.effectiveDate.getTime() - a.effectiveDate.getTime(),
    )
    .map((expense) => ({
      id: expense.id,
      description: expense.description,
      amount: expense.amount,
      payment_date: toDateOnlyString(expense.effectiveDate),
      category: expense.category?.name ?? '',
      categoryIcon: expense.category?.icon ?? null,
      fortnight_id: expense.fortnight.id,
      fortnight_year: expense.fortnight.year,
      fortnight_month: expense.fortnight.month,
      fortnight_period: expense.fortnight.period,
      credit_installment_current: expense.credit_installment_current,
      credit_installment_total: expense.credit_installment_total,
    }));

  const lastStatementBalance = statementPurchases.reduce(
    (sum, expense) => sum + expense.amount,
    0,
  );
  const [afterCutoffAgg, paymentsAppliedToStatementTotal, currentCycleAgg] =
    paymentTotals;
  const paymentsAfterCutoffTotal = Number(afterCutoffAgg._sum.amount ?? 0);
  const currentCyclePurchasesTotal = currentCyclePurchases.reduce(
    (sum, expense) => sum + expense.amount,
    0,
  );
  const currentCyclePaymentsTotal = Number(currentCycleAgg._sum.amount ?? 0);
  const currentBalance = Number(card.amount);
  const creditLimit = card.credit_limit == null ? null : Number(card.credit_limit);
  const temporaryCreditLimit =
    card.temporary_credit_limit == null ? null : Number(card.temporary_credit_limit);

  const nextDuePayment = computeNextDuePayment({
    lastStatementBalance,
    paymentsAppliedToStatement: paymentsAppliedToStatementTotal,
    importedTotalDue,
    outstandingBalance: currentBalance,
    dueDay: card.due_day,
    cutoffDay: card.cutoff_day,
    currentCyclePurchasesTotal,
    currentCyclePaymentsTotal,
    asOfYmd: toDateOnlyString(normalizedAsOf),
    currentCycleEndYmd: toDateOnlyString(window.currentCycleEnd),
    allowOutstandingBalanceFallback:
      statementImports.length === 0 || recentImport != null,
  });

  return {
    credit_card_id: card.id,
    name: card.name,
    type: card.type,
    current_balance: currentBalance,
    credit_limit: creditLimit,
    temporary_credit_limit: temporaryCreditLimit,
    available_credit: getWalletAvailableCredit({
      amount: currentBalance,
      credit_limit: creditLimit,
      temporary_credit_limit: temporaryCreditLimit,
    }),
    cutoff_day: card.cutoff_day,
    due_day: card.due_day,
    statement_start: toDateOnlyString(window.statementStart),
    statement_end: toDateOnlyString(window.statementEnd),
    statement_due_date: recentImport?.payment_due_date
      ? toDateOnlyString(recentImport.payment_due_date)
      : toDateOnlyString(window.statementDueDate),
    current_cycle_start: toDateOnlyString(window.currentCycleStart),
    current_cycle_end: toDateOnlyString(window.currentCycleEnd),
    outstanding_balance: currentBalance,
    last_statement_balance: lastStatementBalance,
    payments_since_last_cutoff: paymentsAfterCutoffTotal,
    payments_applied_to_statement: paymentsAppliedToStatementTotal,
    imported_statement_total: importedTotalDue,
    next_due_payment: nextDuePayment,
    minimum_payment: importedMinimumPayment,
    current_cycle_purchases: currentCyclePurchasesTotal,
    current_cycle_payments: currentCyclePaymentsTotal,
    statement_purchases: statementPurchases.map((expense) => ({
      id: expense.id,
      description: expense.description,
      amount: expense.amount,
      payment_date: toDateOnlyString(expense.effectiveDate),
      category: expense.category?.name ?? '',
      categoryIcon: expense.category?.icon ?? null,
      fortnight_id: expense.fortnight.id,
      fortnight_year: expense.fortnight.year,
      fortnight_month: expense.fortnight.month,
      fortnight_period: expense.fortnight.period,
      credit_installment_current: expense.credit_installment_current,
      credit_installment_total: expense.credit_installment_total,
    })),
    current_cycle_purchase_items: currentCyclePurchases.map((expense) => ({
      id: expense.id,
      description: expense.description,
      amount: expense.amount,
      payment_date: toDateOnlyString(expense.effectiveDate),
      category: expense.category?.name ?? '',
      categoryIcon: expense.category?.icon ?? null,
      fortnight_id: expense.fortnight.id,
      fortnight_year: expense.fortnight.year,
      fortnight_month: expense.fortnight.month,
      fortnight_period: expense.fortnight.period,
      credit_installment_current: expense.credit_installment_current,
      credit_installment_total: expense.credit_installment_total,
    })),
    installment_active_purchases: installmentActivePurchases,
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

export type CreditCardStatementObligationBreakdown = {
  last_statement_balance: number;
  payments_applied_to_statement: number;
  next_due_payment: number;
};

/** Filas precargadas para proyección de liquidez (evita N consultas por periodo). */
export type CardLedgerExpenseRow = {
  wallet_id: number;
  amount: number;
  effectiveAt: Date;
};

export type CardLedgerPaymentRow = {
  credit_card_wallet_id: number;
  amount: number;
  paid_at: Date;
};

export type CreditCardStatementObligationWithCycle =
  CreditCardStatementObligationBreakdown & {
    current_cycle_purchases: number;
  };

/** Card metadata for {@link buildCardObligationsFromLedger} (shared obligation kernel). */
export type CardObligationFromLedgerInput = {
  walletId: number;
  walletName: string;
  walletType: string;
  outstandingBalance: number;
  cutoffDay: number;
  dueDay: number;
  importedTotalDue?: number | null;
};

export type StatementImportRow = {
  wallet_id: number;
  total_due: unknown;
  minimum_payment?: unknown;
  period_end: Date | null;
  payment_due_date?: Date | null;
  created_at: Date;
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const importMatchesStatementWindow = (
  row: StatementImportRow,
  window: CreditCardStatementWindow,
): boolean => {
  const windowEndMin = new Date(window.statementEnd.getTime() - SEVEN_DAYS_MS);
  const windowEndMax = new Date(window.statementEnd.getTime() + SEVEN_DAYS_MS);
  if (
    row.period_end != null &&
    row.period_end.getTime() >= windowEndMin.getTime() &&
    row.period_end.getTime() <= windowEndMax.getTime()
  ) {
    return true;
  }

  const dueDate = row.payment_due_date;
  if (dueDate == null) {
    return false;
  }
  const dueMin = new Date(window.statementDueDate.getTime() - SEVEN_DAYS_MS);
  const dueMax = new Date(window.statementDueDate.getTime() + SEVEN_DAYS_MS);
  return (
    dueDate.getTime() >= dueMin.getTime() &&
    dueDate.getTime() <= dueMax.getTime()
  );
};

/**
 * Statement imports are authoritative only for their matching statement/due
 * window. If several imports match the same window, the newest upload wins.
 */
export const resolveStatementImportForStatementWindow = <
  T extends StatementImportRow,
>(
  imports: T[],
  walletId: number,
  window: CreditCardStatementWindow,
): T | null => {
  return imports
    .filter((i) => i.wallet_id === walletId)
    .filter((i) => importMatchesStatementWindow(i, window))
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())[0] ?? null;
};

export const resolveImportedTotalDueForStatementWindow = (
  imports: StatementImportRow[],
  walletId: number,
  window: CreditCardStatementWindow,
): number | null => {
  const chosen = resolveStatementImportForStatementWindow(
    imports,
    walletId,
    window,
  );
  if (chosen?.total_due != null) {
    return Number(chosen.total_due);
  }
  return null;
};

const aggregateLedgerActivityForCard = (
  walletId: number,
  window: CreditCardStatementWindow,
  expenses: CardLedgerExpenseRow[],
  payments: CardLedgerPaymentRow[],
) => {
  const st = window.statementStart.getTime();
  const en = window.statementEnd.getTime();
  const ccs = window.currentCycleStart.getTime();
  const cce = window.currentCycleEnd.getTime();

  let lastStatementBalance = 0;
  let currentCyclePurchases = 0;
  let currentCyclePayments = 0;
  for (const e of expenses) {
    if (e.wallet_id !== walletId) continue;
    const t = e.effectiveAt.getTime();
    if (t >= st && t <= en) {
      lastStatementBalance += e.amount;
    }
    if (t >= ccs && t <= cce) {
      currentCyclePurchases += e.amount;
    }
  }
  let paymentsAppliedToStatement = 0;
  for (const p of payments) {
    if (p.credit_card_wallet_id !== walletId) continue;
    const pt = p.paid_at.getTime();
    if (
      paymentAppliesToStatementPeriod(
        p.paid_at,
        window.statementEnd,
        window.statementDueDate,
      )
    ) {
      paymentsAppliedToStatement += p.amount;
    }
    if (pt >= ccs && pt <= cce) {
      currentCyclePayments += p.amount;
    }
  }

  return {
    lastStatementBalance,
    paymentsAppliedToStatement,
    currentCyclePurchases,
    currentCyclePayments,
  };
};

/**
 * Builds canonical card obligations from a preloaded ledger (liquidity, batch projection).
 */
export const buildCardObligationsFromLedger = (
  cards: CardObligationFromLedgerInput[],
  window: CreditCardStatementWindow,
  expenses: CardLedgerExpenseRow[],
  payments: CardLedgerPaymentRow[],
  asOfYmd: string,
): Map<number, CreditCardStatementObligationWithCycle & { is_estimate?: boolean }> => {
  const result = new Map<
    number,
    CreditCardStatementObligationWithCycle & { is_estimate?: boolean }
  >();

  for (const card of cards) {
    const {
      lastStatementBalance,
      paymentsAppliedToStatement,
      currentCyclePurchases,
      currentCyclePayments,
    } = aggregateLedgerActivityForCard(
      card.walletId,
      window,
      expenses,
      payments,
    );

    const obligation = buildCardStatementObligation({
      walletId: card.walletId,
      walletName: card.walletName,
      walletType: card.walletType,
      cutoffDay: card.cutoffDay,
      dueDay: card.dueDay,
      window,
      lastStatementBalance,
      paymentsAppliedToStatement,
      importedTotalDue: card.importedTotalDue ?? null,
      outstandingBalance: card.outstandingBalance,
      currentCyclePurchasesTotal: currentCyclePurchases,
      currentCyclePaymentsTotal: currentCyclePayments,
      asOfYmd,
      plannedGrossAmount: null,
    });

    result.set(card.walletId, {
      last_statement_balance: obligation.lastStatementBalance,
      payments_applied_to_statement: obligation.paymentsAppliedToStatement,
      next_due_payment: obligation.remainingStatementDue,
      current_cycle_purchases: currentCyclePurchases,
      is_estimate: obligation.isEstimate,
    });
  }

  return result;
};

const expenseOwnerWhereSql = (ownerFilter: OwnerFilter) => {
  if (ownerFilter.user_id !== null) {
    return Prisma.sql`e."user_id" = ${ownerFilter.user_id} AND e."house_id" IS NULL`;
  }
  return Prisma.sql`e."user_id" IS NULL AND e."house_id" = ${ownerFilter.house_id}`;
};

const creditPaymentOwnerWhereSql = (ownerFilter: OwnerFilter) => {
  if (ownerFilter.user_id !== null) {
    return Prisma.sql`p."user_id" = ${ownerFilter.user_id} AND p."house_id" IS NULL`;
  }
  return Prisma.sql`p."user_id" IS NULL AND p."house_id" = ${ownerFilter.house_id}`;
};

/**
 * Carga compras pagadas y pagos a TC en un rango; {@link computeObligationBreakdownFromLedger}
 * reproduce la misma lógica que las agregaciones por ventana.
 */
export async function loadCreditCardActivityLedger(
  cardIds: number[],
  ownerFilter: OwnerFilter,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<{
  expenses: CardLedgerExpenseRow[];
  payments: CardLedgerPaymentRow[];
}> {
  if (cardIds.length === 0) {
    return { expenses: [], payments: [] };
  }

  const ownerExpense = expenseOwnerWhereSql(ownerFilter);
  const ownerPayment = creditPaymentOwnerWhereSql(ownerFilter);

  const [expenseRows, paymentRows] = await Promise.all([
    prisma.$queryRaw<
      Array<{ wallet_id: number; amount: unknown; eff: Date }>
    >`
      SELECT e."wallet_id", e."amount",
        COALESCE(e."payment_date", e."created_at") AS eff
      FROM "Expense" e
      WHERE e."is_paid" = true
        AND e."wallet_id" IN (${Prisma.join(cardIds)})
        AND COALESCE(e."payment_date", e."created_at") >= ${rangeStart}
        AND COALESCE(e."payment_date", e."created_at") <= ${rangeEnd}
        AND ${ownerExpense}
    `,
    prisma.$queryRaw<
      Array<{ credit_card_wallet_id: number; amount: unknown; paid_at: Date }>
    >`
      SELECT p."credit_card_wallet_id", p."amount", p."paid_at"
      FROM "CreditCardPayment" p
      WHERE p."credit_card_wallet_id" IN (${Prisma.join(cardIds)})
        AND p."paid_at" >= ${rangeStart}
        AND p."paid_at" <= ${rangeEnd}
        AND ${ownerPayment}
    `,
  ]);

  return {
    expenses: expenseRows.map((r) => ({
      wallet_id: r.wallet_id,
      amount: Number(r.amount),
      effectiveAt: r.eff,
    })),
    payments: paymentRows.map((r) => ({
      credit_card_wallet_id: r.credit_card_wallet_id,
      amount: Number(r.amount),
      paid_at: r.paid_at,
    })),
  };
}

export const computeObligationBreakdownFromLedger = (
  cardIds: number[],
  window: CreditCardStatementWindow,
  expenses: CardLedgerExpenseRow[],
  payments: CardLedgerPaymentRow[],
  options?: {
    cardsById?: Map<number, CardObligationFromLedgerInput>;
    asOfYmd?: string;
  },
): Map<number, CreditCardStatementObligationWithCycle> => {
  const asOfYmd =
    options?.asOfYmd ?? formatCalendarDate(window.statementEnd);
  const cards: CardObligationFromLedgerInput[] = cardIds.map((id) => {
    const meta = options?.cardsById?.get(id);
    if (meta) return meta;
    return {
      walletId: id,
      walletName: '',
      walletType: '',
      outstandingBalance: 0,
      cutoffDay: 0,
      dueDay: 0,
      importedTotalDue: null,
    };
  });
  return buildCardObligationsFromLedger(
    cards,
    window,
    expenses,
    payments,
    asOfYmd,
  );
};

/**
 * Statement-period obligation per card (same formula as {@link getCreditCardStatementByOwner}).
 * Used for liquidity projection across future cutoffs.
 */
export async function getStatementObligationBreakdownByWallet(
  cardIds: number[],
  window: CreditCardStatementWindow,
  ownerFilter: OwnerFilter,
): Promise<Map<number, CreditCardStatementObligationBreakdown>> {
  if (cardIds.length === 0) {
    return new Map();
  }

  const [purchases, payments] = await Promise.all([
    sumStatementPurchasesByWallet(cardIds, window, ownerFilter),
    sumPaymentsAppliedToStatementByWallet(cardIds, window, ownerFilter),
  ]);

  const result = new Map<number, CreditCardStatementObligationBreakdown>();
  for (const id of cardIds) {
    const lastStatementBalance = purchases.get(id) ?? 0;
    const paymentsAppliedToStatement = payments.get(id) ?? 0;
    const nextDuePayment = Math.max(
      lastStatementBalance - paymentsAppliedToStatement,
      0,
    );
    result.set(id, {
      last_statement_balance: lastStatementBalance,
      payments_applied_to_statement: paymentsAppliedToStatement,
      next_due_payment: nextDuePayment,
    });
  }
  return result;
}

const sumStatementPurchasesByWallet = async (
  cardIds: number[],
  window: CreditCardStatementWindow,
  ownerFilter: OwnerFilter,
) => {
  if (cardIds.length === 0) {
    return new Map<number, number>();
  }

  const ownerSql = expenseOwnerWhereSql(ownerFilter);
  const rows = await prisma.$queryRaw<Array<{ wallet_id: number; total: unknown }>>`
    SELECT e."wallet_id", COALESCE(SUM(e."amount"), 0) AS total
    FROM "Expense" e
    WHERE e."is_paid" = true
      AND e."wallet_id" IN (${Prisma.join(cardIds)})
      AND COALESCE(e."payment_date", e."created_at") >= ${window.statementStart}
      AND COALESCE(e."payment_date", e."created_at") <= ${window.statementEnd}
      AND ${ownerSql}
    GROUP BY e."wallet_id"
  `;

  const map = new Map<number, number>();
  for (const row of rows) {
    map.set(row.wallet_id, Number(row.total));
  }
  return map;
};

const sumCurrentCyclePurchasesByWallet = async (
  cardIds: number[],
  window: CreditCardStatementWindow,
  ownerFilter: OwnerFilter,
) => {
  if (cardIds.length === 0) {
    return new Map<number, number>();
  }

  const ownerSql = expenseOwnerWhereSql(ownerFilter);
  const rows = await prisma.$queryRaw<Array<{ wallet_id: number; total: unknown }>>`
    SELECT e."wallet_id", COALESCE(SUM(e."amount"), 0) AS total
    FROM "Expense" e
    WHERE e."is_paid" = true
      AND e."wallet_id" IN (${Prisma.join(cardIds)})
      AND COALESCE(e."payment_date", e."created_at") >= ${window.currentCycleStart}
      AND COALESCE(e."payment_date", e."created_at") <= ${window.currentCycleEnd}
      AND ${ownerSql}
    GROUP BY e."wallet_id"
  `;

  const map = new Map<number, number>();
  for (const row of rows) {
    map.set(row.wallet_id, Number(row.total));
  }
  return map;
};

const sumCurrentCyclePaymentsByWallet = async (
  cardIds: number[],
  window: CreditCardStatementWindow,
  ownerFilter: OwnerFilter,
) => {
  if (cardIds.length === 0) {
    return new Map<number, number>();
  }

  const ownerSql = creditPaymentOwnerWhereSql(ownerFilter);
  const rows = await prisma.$queryRaw<
    Array<{ credit_card_wallet_id: number; total: unknown }>
  >`
    SELECT p."credit_card_wallet_id", COALESCE(SUM(p."amount"), 0) AS total
    FROM "CreditCardPayment" p
    WHERE p."credit_card_wallet_id" IN (${Prisma.join(cardIds)})
      AND p."paid_at" >= ${window.currentCycleStart}
      AND p."paid_at" <= ${window.currentCycleEnd}
      AND ${ownerSql}
    GROUP BY p."credit_card_wallet_id"
  `;

  const map = new Map<number, number>();
  for (const row of rows) {
    map.set(row.credit_card_wallet_id, Number(row.total));
  }
  return map;
};

const sumPaymentsAppliedToStatementByWallet = async (
  cardIds: number[],
  window: CreditCardStatementWindow,
  ownerFilter: OwnerFilter,
) => {
  if (cardIds.length === 0) {
    return new Map<number, number>();
  }

  const ownerSql = creditPaymentOwnerWhereSql(ownerFilter);
  const paymentDueEnd = endOfDueCalendarDay(window.statementDueDate);
  const rows = await prisma.$queryRaw<
    Array<{ credit_card_wallet_id: number; total: unknown }>
  >`
    SELECT p."credit_card_wallet_id", COALESCE(SUM(p."amount"), 0) AS total
    FROM "CreditCardPayment" p
    WHERE p."credit_card_wallet_id" IN (${Prisma.join(cardIds)})
      AND p."paid_at" <= ${paymentDueEnd}
      AND (
        (p."paid_at" AT TIME ZONE 'UTC')::date
          > (${window.statementEnd} AT TIME ZONE 'UTC')::date
        OR (
          (p."paid_at" AT TIME ZONE 'UTC')::date
            = (${window.statementEnd} AT TIME ZONE 'UTC')::date
          AND p."paid_at" > ${window.statementEnd}
        )
      )
      AND ${ownerSql}
    GROUP BY p."credit_card_wallet_id"
  `;

  const map = new Map<number, number>();
  for (const row of rows) {
    map.set(row.credit_card_wallet_id, Number(row.total));
  }
  return map;
};

type DuePaymentsAsOfOptions = {
  /**
   * When true, keep rows with nextDuePayment === 0 (al corriente en el corte).
   * Always includes `cutoff_day` on each item.
   */
  includeZeroObligation?: boolean;
  asOfForCard?: (card: { due_day: number; cutoff_day: number }) => Date;
  includeProjectedInstallments?: boolean;
  allowOutstandingBalanceFallback?: boolean;
};

const statementCycleMonthDelta = (fromEnd: Date, toEnd: Date) =>
  (toEnd.getUTCFullYear() - fromEnd.getUTCFullYear()) * 12 +
  (toEnd.getUTCMonth() - fromEnd.getUTCMonth());

const installmentSeriesKey = (input: {
  walletId: number;
  description: string;
  amount: number;
  total: number;
}) =>
  [
    input.walletId,
    input.description.trim().toLocaleLowerCase('es-MX'),
    input.amount.toFixed(2),
    input.total,
  ].join('|');

async function sumProjectedStatementInstallmentsByWallet(
  ownerFilter: OwnerFilter,
  cardIds: number[],
  window: CreditCardStatementWindow,
  cutoffDay: number,
  dueDay: number,
): Promise<Map<number, number>> {
  if (cardIds.length === 0) {
    return new Map();
  }

  const rows = await prisma.expense.findMany({
    where: {
      ...ownerFilter,
      wallet_id: { in: cardIds },
      is_paid: true,
      credit_installment_current: { not: null },
      credit_installment_total: { not: null },
    },
    select: {
      wallet_id: true,
      description: true,
      amount: true,
      payment_date: true,
      created_at: true,
      credit_installment_current: true,
      credit_installment_total: true,
    },
  });

  const targetEndYmd = toDateOnlyString(window.statementEnd);
  const actualTargetInstallments = new Set<string>();
  const latestSourceBySeries = new Map<
    string,
    {
      walletId: number;
      amount: number;
      current: number;
      total: number;
      sourceEnd: Date;
    }
  >();

  for (const row of rows) {
    if (row.wallet_id == null || !isCreditInstallmentExpense(row)) {
      continue;
    }

    const effectiveDate = toEffectiveExpenseDate(row);
    const sourceWindow = resolveCreditCardStatementWindow(
      effectiveDate,
      cutoffDay,
      dueDay,
    );
    const sourceEndYmd = toDateOnlyString(sourceWindow.statementEnd);
    const amount = Number(row.amount);
    const current = row.credit_installment_current!;
    const total = row.credit_installment_total!;
    const series = installmentSeriesKey({
      walletId: row.wallet_id,
      description: row.description,
      amount,
      total,
    });

    if (sourceEndYmd === targetEndYmd) {
      actualTargetInstallments.add(`${series}|${current}`);
      continue;
    }

    if (sourceWindow.statementEnd >= window.statementEnd || current >= total) {
      continue;
    }

    const existing = latestSourceBySeries.get(series);
    if (!existing || sourceWindow.statementEnd > existing.sourceEnd) {
      latestSourceBySeries.set(series, {
        walletId: row.wallet_id,
        amount,
        current,
        total,
        sourceEnd: sourceWindow.statementEnd,
      });
    }
  }

  const sums = new Map<number, number>();
  for (const [series, source] of latestSourceBySeries) {
    const offset = statementCycleMonthDelta(source.sourceEnd, window.statementEnd);
    if (offset <= 0) {
      continue;
    }
    const expectedCurrent = source.current + offset;
    if (expectedCurrent > source.total) {
      continue;
    }
    if (actualTargetInstallments.has(`${series}|${expectedCurrent}`)) {
      continue;
    }
    sums.set(source.walletId, (sums.get(source.walletId) ?? 0) + source.amount);
  }

  return sums;
}

/**
 * Cards with positive balance and due-day matching `dueDayPredicate`, as of `asOf`.
 */
async function getDuePaymentsWithAsOf(
  ownerFilter: OwnerFilter,
  asOf: Date,
  dueDayPredicate: (dueDay: number) => boolean,
  options?: DuePaymentsAsOfOptions,
) {
  const cards = await prisma.wallet.findMany({
    where: {
      ...ownerFilter,
      active: true,
      type: { in: [PaymentMethodType.CREDIT_CARD, PaymentMethodType.DEPARTMENT_STORE_CARD] },
      cutoff_day: { not: null },
      due_day: { not: null },
    },
    select: {
      id: true,
      name: true,
      type: true,
      amount: true,
      cutoff_day: true,
      due_day: true,
    },
  });

  const dueCards = cards.filter((card) => {
    if (Number(card.amount) <= 0) return false;
    const dueDay = card.due_day!;
    return dueDayPredicate(dueDay);
  });

  if (dueCards.length === 0) return [];

  const groups = new Map<string, { asOf: Date; cards: typeof dueCards }>();
  for (const card of dueCards) {
    const cardAsOf =
      options?.asOfForCard?.({
        due_day: card.due_day!,
        cutoff_day: card.cutoff_day!,
      }) ?? asOf;
    const key = `${card.cutoff_day}-${card.due_day}-${cardAsOf.toISOString()}`;
    const existing = groups.get(key);
    if (existing) {
      existing.cards.push(card);
    } else {
      groups.set(key, { asOf: cardAsOf, cards: [card] });
    }
  }

  const purchaseSums = new Map<number, number>();
  const paymentSums = new Map<number, number>();
  const currentCyclePurchaseSums = new Map<number, number>();
  const currentCyclePaymentSums = new Map<number, number>();
  const importedTotalByWallet = new Map<number, number>();
  const hasAnyImportByWallet = new Map<number, boolean>();
  const hasAlignedImportByWallet = new Map<number, boolean>();
  const projectedInstallmentSums = new Map<number, number>();
  const statementDueByWallet = new Map<number, string>();
  const currentCycleEndByWallet = new Map<number, string>();
  const asOfYmdByWallet = new Map<number, string>();
  const windowByWallet = new Map<number, CreditCardStatementWindow>();

  for (const group of groups.values()) {
    const { asOf: groupAsOf, cards: cardsInGroup } = group;
    const head = cardsInGroup[0];
    const window = resolveCreditCardStatementWindow(
      groupAsOf,
      head.cutoff_day!,
      head.due_day!,
    );
    const cardIds = cardsInGroup.map((c) => c.id);
    const dueStr = toDateOnlyString(window.statementDueDate);
    const cycleEndStr = toDateOnlyString(window.currentCycleEnd);
    for (const id of cardIds) {
      statementDueByWallet.set(id, dueStr);
      currentCycleEndByWallet.set(id, cycleEndStr);
      windowByWallet.set(id, window);
    }

    // Avoid large burst fan-out against Postgres while rendering monthly planner.
    const purchases = await sumStatementPurchasesByWallet(cardIds, window, ownerFilter);
    const payments = await sumPaymentsAppliedToStatementByWallet(cardIds, window, ownerFilter);

    if (head.due_day! < head.cutoff_day!) {
      const [cyclePurchases, cyclePayments] = await Promise.all([
        sumCurrentCyclePurchasesByWallet(cardIds, window, ownerFilter),
        sumCurrentCyclePaymentsByWallet(cardIds, window, ownerFilter),
      ]);
      for (const [id, value] of cyclePurchases) {
        currentCyclePurchaseSums.set(id, value);
      }
      for (const [id, value] of cyclePayments) {
        currentCyclePaymentSums.set(id, value);
      }
    }

    const allImportsForGroup = await prisma.creditCardStatementImport.findMany({
      where: { wallet_id: { in: cardIds } },
      orderBy: { created_at: 'desc' },
      select: {
        wallet_id: true,
        total_due: true,
        period_end: true,
        payment_due_date: true,
        created_at: true,
      },
    });

    for (const wid of cardIds) {
      hasAnyImportByWallet.set(
        wid,
        allImportsForGroup.some((row) => row.wallet_id === wid),
      );
      const selectedImport = resolveStatementImportForStatementWindow(
        allImportsForGroup,
        wid,
        window,
      );
      if (selectedImport != null) {
        hasAlignedImportByWallet.set(wid, true);
      }
      if (selectedImport?.total_due != null) {
        importedTotalByWallet.set(wid, Number(selectedImport.total_due));
      }
    }

    if (options?.includeProjectedInstallments) {
      const projected = await sumProjectedStatementInstallmentsByWallet(
        ownerFilter,
        cardIds,
        window,
        head.cutoff_day!,
        head.due_day!,
      );
      for (const [id, value] of projected) {
        if (!hasAlignedImportByWallet.get(id)) {
          projectedInstallmentSums.set(id, value);
        }
      }
    }

    for (const [id, value] of purchases) {
      purchaseSums.set(id, value);
    }
    for (const [id, value] of payments) {
      paymentSums.set(id, value);
    }
    for (const id of cardIds) {
      asOfYmdByWallet.set(id, toDateOnlyString(groupAsOf));
    }
  }

  const items = dueCards.map((card) => {
    const lastStatementBalance = purchaseSums.get(card.id) ?? 0;
    const paymentsAppliedToStatement = paymentSums.get(card.id) ?? 0;
    const importedTotalDue = importedTotalByWallet.get(card.id) ?? null;
    const outstandingBalance = Number(card.amount);
    const window = windowByWallet.get(card.id)!;
    const asOfYmd = asOfYmdByWallet.get(card.id) ?? toDateOnlyString(asOf);
    const hasAnyImport = hasAnyImportByWallet.get(card.id) === true;
    const hasAlignedImport = hasAlignedImportByWallet.get(card.id) === true;
    const allowOutstandingBalanceFallback =
      (options?.allowOutstandingBalanceFallback ?? true) &&
      (!hasAnyImport || hasAlignedImport);

    const obligation = buildCardStatementObligation({
      walletId: card.id,
      walletName: card.name,
      walletType: card.type,
      cutoffDay: card.cutoff_day!,
      dueDay: card.due_day!,
      window,
      lastStatementBalance,
      paymentsAppliedToStatement,
      importedTotalDue,
      outstandingBalance,
      projectedStatementInstallmentsTotal:
        projectedInstallmentSums.get(card.id) ?? 0,
      currentCyclePurchasesTotal: currentCyclePurchaseSums.get(card.id) ?? 0,
      currentCyclePaymentsTotal: currentCyclePaymentSums.get(card.id) ?? 0,
      asOfYmd,
      plannedGrossAmount: null,
      allowOutstandingBalanceFallback,
    });

    const fields = toDuePaymentItemFields(obligation);

    return {
      walletId: card.id,
      walletName: card.name,
      walletType: card.type,
      dueDay: card.due_day!,
      cutoff_day: card.cutoff_day!,
      ...fields,
    };
  });

  if (options?.includeZeroObligation) {
    return items;
  }
  return items.filter((item) => item.nextDuePayment > 0);
}

export async function getDuePaymentsForCurrentFortnight(
  ownerFilter: OwnerFilter,
) {
  const now = new Date();
  const currentDay = now.getDate();
  const isFirstFortnight = currentDay <= 15;
  const items = await getDuePaymentsWithAsOf(
    ownerFilter,
    now,
    isFirstFortnight
      ? (dueDay) => dueDay >= 1 && dueDay <= 15
      : (dueDay) => dueDay >= 16,
  );
  const fortnightId = await resolveFortnightIdForDate(ownerFilter, now);
  await attachPlannedPaymentsToDueItems(items, fortnightId, ownerFilter);
  return items;
}

/** Due card payments for Planificación: primera vs segunda quincena del mes mostrado. */
export async function getDuePaymentsForPlannerMonth(
  ownerFilter: OwnerFilter,
  year: number,
  month: number,
) {
  const asOfForVisibleDueDate = (card: { due_day: number }) =>
    createCalendarDate(year, month, clampDayToMonth(year, month, card.due_day));

  // Fallback only; planner rows use each card's visible due date so cards with
  // due day before cutoff stay on the statement that is actually due this month.
  const asOfFirst = createCalendarDate(year, month, 14);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const asOfSecond = createCalendarDate(year, month, lastDay);
  const allowFirstDebtFallback =
    isCalendarFortnightCurrent(year, month, 'FIRST') ||
    isCalendarFortnightNext(year, month, 'FIRST');
  const allowSecondDebtFallback =
    isCalendarFortnightCurrent(year, month, 'SECOND') ||
    isCalendarFortnightNext(year, month, 'SECOND');

  const [first, second] = await Promise.all([
    getDuePaymentsWithAsOf(
      ownerFilter,
      asOfFirst,
      (dueDay) => dueDay >= 1 && dueDay <= 15,
      {
        includeZeroObligation: true,
        asOfForCard: asOfForVisibleDueDate,
        includeProjectedInstallments: true,
        allowOutstandingBalanceFallback: allowFirstDebtFallback,
      },
    ),
    getDuePaymentsWithAsOf(
      ownerFilter,
      asOfSecond,
      (dueDay) => dueDay >= 16,
      {
        includeZeroObligation: true,
        asOfForCard: asOfForVisibleDueDate,
        includeProjectedInstallments: true,
        allowOutstandingBalanceFallback: allowSecondDebtFallback,
      },
    ),
  ]);

  const [fortnightFirst, fortnightSecond] = await Promise.all([
    prisma.fortnight.findFirst({
      where: { ...ownerFilter, year, month, period: 'FIRST' },
      select: { id: true },
    }),
    prisma.fortnight.findFirst({
      where: { ...ownerFilter, year, month, period: 'SECOND' },
      select: { id: true },
    }),
  ]);

  await Promise.all([
    attachPlannedPaymentsToDueItems(first, fortnightFirst?.id, ownerFilter),
    attachPlannedPaymentsToDueItems(second, fortnightSecond?.id, ownerFilter),
  ]);

  return { first, second };
}

/** Suma `nextDuePayment` de tarjetas con corte en la quincena (misma lógica que planificación / due-payments). */
export async function sumPlannerCardDueForFortnight(
  ownerFilter: OwnerFilter,
  year: number,
  month: number,
  period: 'FIRST' | 'SECOND',
): Promise<{ total: number; cardCount: number }> {
  const { first, second } = await getDuePaymentsForPlannerMonth(
    ownerFilter,
    year,
    month,
  );
  const items = period === 'FIRST' ? first : second;
  const withDue = items.filter((i) => getEffectiveCardPaymentAmount(i) > 0);
  const total = withDue.reduce((s, i) => s + getEffectiveCardPaymentAmount(i), 0);
  return { total, cardCount: withDue.length };
}

/** Mes completo (vista mensual en panel): 1ª + 2ª quincena sin duplicar tarjetas (cada TC cae en una sola lista). */
export async function sumPlannerCardDueForMonth(
  ownerFilter: OwnerFilter,
  year: number,
  month: number,
): Promise<{ total: number; cardCount: number }> {
  const { first, second } = await getDuePaymentsForPlannerMonth(
    ownerFilter,
    year,
    month,
  );
  const withDue = [...first, ...second].filter(
    (i) => getEffectiveCardPaymentAmount(i) > 0,
  );
  const total = withDue.reduce((s, i) => s + getEffectiveCardPaymentAmount(i), 0);
  return { total, cardCount: withDue.length };
}

export async function sumPlannerCardDueForDashboardScope(
  ownerFilter: OwnerFilter,
  view: 'month' | 'biweekly',
  year: number,
  month: number,
  period: 'FIRST' | 'SECOND',
): Promise<{ total: number; cardCount: number }> {
  if (view === 'month') {
    return sumPlannerCardDueForMonth(ownerFilter, year, month);
  }
  return sumPlannerCardDueForFortnight(ownerFilter, year, month, period);
}
