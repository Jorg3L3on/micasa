import prisma from '@/lib/prisma';
import { PaymentMethodType, Prisma } from '@/generated/prisma/client';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import { isCreditMsiInstallmentExpense } from '@/lib/finance/expense-planning-scope';
import {
  getWalletAvailableCredit,
  isCreditWalletType,
} from '@/lib/finance/wallet-accounting';

const MAX_PAYMENT_HISTORY = 25;

const createUtcDate = (year: number, month: number, day: number) =>
  new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));

const toDateOnlyString = (date: Date) => date.toISOString().split('T')[0];

/**
 * Pago que cuenta contra el corte: día UTC posterior al del cierre, o mismo día UTC con `paid_at`
 * estrictamente después del instante de cierre (evita excluir pagos el día del vencimiento del ciclo).
 */
const paymentAppliesToStatementPeriod = (
  paidAt: Date,
  statementEnd: Date,
  statementDueDate: Date,
): boolean => {
  const paidMs = paidAt.getTime();
  if (paidMs > endOfUtcCalendarDay(statementDueDate).getTime()) {
    return false;
  }
  const payDay = toDateOnlyString(paidAt);
  const endDay = toDateOnlyString(statementEnd);
  if (payDay > endDay) return true;
  if (payDay < endDay) return false;
  return paidMs > statementEnd.getTime();
};

/** Inclusive upper bound so any `paid_at` on the due calendar day (UTC) counts toward the statement. */
const endOfUtcCalendarDay = (date: Date) =>
  new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );

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

  // Most recent statement import whose period_end falls within ±7 days of
  // the statement window end — used to override next_due_payment and due date.
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const [purchases, payments, paymentTotals, recentImport] = await Promise.all([
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
        credit_msi_current: true,
        credit_msi_total: true,
        category: { select: { name: true } },
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
    prisma.creditCardStatementImport.findFirst({
      where: {
        wallet_id: creditCardId,
        period_end: {
          gte: new Date(window.statementEnd.getTime() - SEVEN_DAYS_MS),
          lte: new Date(window.statementEnd.getTime() + SEVEN_DAYS_MS),
        },
      },
      orderBy: { created_at: 'desc' },
      select: { total_due: true, payment_due_date: true, minimum_payment: true },
    }),
  ]);

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

  /** MSI con cuotas aún pendientes (cuota actual estrictamente menor al total). */
  const msiActivePurchases = purchases
    .filter(
      (e) =>
        isCreditMsiInstallmentExpense(e) &&
        e.credit_msi_current != null &&
        e.credit_msi_total != null &&
        e.credit_msi_current < e.credit_msi_total,
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
      fortnight_id: expense.fortnight.id,
      fortnight_year: expense.fortnight.year,
      fortnight_month: expense.fortnight.month,
      fortnight_period: expense.fortnight.period,
      credit_msi_current: expense.credit_msi_current,
      credit_msi_total: expense.credit_msi_total,
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
    next_due_payment: Math.max(
      (importedTotalDue ?? lastStatementBalance) - paymentsAppliedToStatementTotal,
      0,
    ),
    minimum_payment: importedMinimumPayment,
    current_cycle_purchases: currentCyclePurchasesTotal,
    current_cycle_payments: currentCyclePaymentsTotal,
    statement_purchases: statementPurchases.map((expense) => ({
      id: expense.id,
      description: expense.description,
      amount: expense.amount,
      payment_date: toDateOnlyString(expense.effectiveDate),
      category: expense.category?.name ?? '',
      fortnight_id: expense.fortnight.id,
      fortnight_year: expense.fortnight.year,
      fortnight_month: expense.fortnight.month,
      fortnight_period: expense.fortnight.period,
      credit_msi_current: expense.credit_msi_current,
      credit_msi_total: expense.credit_msi_total,
    })),
    current_cycle_purchase_items: currentCyclePurchases.map((expense) => ({
      id: expense.id,
      description: expense.description,
      amount: expense.amount,
      payment_date: toDateOnlyString(expense.effectiveDate),
      category: expense.category?.name ?? '',
      fortnight_id: expense.fortnight.id,
      fortnight_year: expense.fortnight.year,
      fortnight_month: expense.fortnight.month,
      fortnight_period: expense.fortnight.period,
      credit_msi_current: expense.credit_msi_current,
      credit_msi_total: expense.credit_msi_total,
    })),
    msi_active_purchases: msiActivePurchases,
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

export type CreditCardStatementWindow = ReturnType<
  typeof resolveCreditCardStatementWindow
>;

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
): Map<number, CreditCardStatementObligationWithCycle> => {
  const result = new Map<number, CreditCardStatementObligationWithCycle>();
  const st = window.statementStart.getTime();
  const en = window.statementEnd.getTime();
  const ccs = window.currentCycleStart.getTime();
  const cce = window.currentCycleEnd.getTime();
  for (const id of cardIds) {
    let lastStatementBalance = 0;
    let currentCyclePurchases = 0;
    for (const e of expenses) {
      if (e.wallet_id !== id) continue;
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
      if (p.credit_card_wallet_id !== id) continue;
      if (
        paymentAppliesToStatementPeriod(
          p.paid_at,
          window.statementEnd,
          window.statementDueDate,
        )
      ) {
        paymentsAppliedToStatement += p.amount;
      }
    }
    const nextDuePayment = Math.max(
      lastStatementBalance - paymentsAppliedToStatement,
      0,
    );
    result.set(id, {
      last_statement_balance: lastStatementBalance,
      payments_applied_to_statement: paymentsAppliedToStatement,
      next_due_payment: nextDuePayment,
      current_cycle_purchases: currentCyclePurchases,
    });
  }
  return result;
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

const sumPaymentsAppliedToStatementByWallet = async (
  cardIds: number[],
  window: CreditCardStatementWindow,
  ownerFilter: OwnerFilter,
) => {
  if (cardIds.length === 0) {
    return new Map<number, number>();
  }

  const ownerSql = creditPaymentOwnerWhereSql(ownerFilter);
  const paymentDueEnd = endOfUtcCalendarDay(window.statementDueDate);
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
};

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

  const groups = new Map<string, typeof dueCards>();
  for (const card of dueCards) {
    const key = `${card.cutoff_day}-${card.due_day}`;
    const existing = groups.get(key);
    if (existing) {
      existing.push(card);
    } else {
      groups.set(key, [card]);
    }
  }

  const purchaseSums = new Map<number, number>();
  const paymentSums = new Map<number, number>();
  const statementDueByWallet = new Map<number, string>();

  await Promise.all(
    [...groups.values()].map(async (cardsInGroup) => {
      const head = cardsInGroup[0];
      const window = resolveCreditCardStatementWindow(
        asOf,
        head.cutoff_day!,
        head.due_day!,
      );
      const cardIds = cardsInGroup.map((c) => c.id);
      const dueStr = toDateOnlyString(window.statementDueDate);
      for (const id of cardIds) {
        statementDueByWallet.set(id, dueStr);
      }

      const [purchases, payments] = await Promise.all([
        sumStatementPurchasesByWallet(cardIds, window, ownerFilter),
        sumPaymentsAppliedToStatementByWallet(cardIds, window, ownerFilter),
      ]);

      for (const [id, value] of purchases) {
        purchaseSums.set(id, value);
      }
      for (const [id, value] of payments) {
        paymentSums.set(id, value);
      }
    }),
  );

  const items = dueCards.map((card) => {
    const lastStatementBalance = purchaseSums.get(card.id) ?? 0;
    const paymentsAppliedToStatement = paymentSums.get(card.id) ?? 0;
    const nextDuePayment = Math.max(
      lastStatementBalance - paymentsAppliedToStatement,
      0,
    );
    return {
      walletId: card.id,
      walletName: card.name,
      walletType: card.type,
      dueDay: card.due_day!,
      cutoff_day: card.cutoff_day!,
      nextDuePayment,
      statementDueDate: statementDueByWallet.get(card.id)!,
      outstandingBalance: Number(card.amount),
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
  return getDuePaymentsWithAsOf(
    ownerFilter,
    now,
    isFirstFortnight
      ? (dueDay) => dueDay >= 1 && dueDay <= 15
      : (dueDay) => dueDay >= 16,
  );
}

/**
 * For a future statement window, sums the MSI installments that would appear
 * in that window. `monthOffset` is how many statement cycles ahead we are from
 * today's current cycle (1 = next statement, 2 = the one after, …).
 * A purchase with `remaining = total − current` covers offsets 1…remaining.
 */
async function getMsiProjectedBalance(
  ownerFilter: OwnerFilter,
  cardId: number,
  monthOffset: number,
): Promise<number> {
  if (monthOffset <= 0) return 0;
  const purchases = await prisma.expense.findMany({
    where: {
      ...ownerFilter,
      wallet_id: cardId,
      is_paid: true,
      credit_msi_current: { not: null },
      credit_msi_total: { not: null },
    },
    select: { amount: true, credit_msi_current: true, credit_msi_total: true },
  });
  return purchases
    .filter(
      (e) =>
        e.credit_msi_current != null &&
        e.credit_msi_total != null &&
        e.credit_msi_total - e.credit_msi_current >= monthOffset,
    )
    .reduce((sum, e) => sum + Number(e.amount), 0);
}

/** Due card payments for Planificación: primera vs segunda quincena del mes mostrado. */
export async function getDuePaymentsForPlannerMonth(
  ownerFilter: OwnerFilter,
  year: number,
  month: number,
) {
  const asOfFirst = createUtcDate(year, month, 15);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const asOfSecond = createUtcDate(year, month, lastDay);

  const [first, second] = await Promise.all([
    getDuePaymentsWithAsOf(
      ownerFilter,
      asOfFirst,
      (dueDay) => dueDay >= 1 && dueDay <= 15,
      { includeZeroObligation: true },
    ),
    getDuePaymentsWithAsOf(
      ownerFilter,
      asOfSecond,
      (dueDay) => dueDay >= 16,
      { includeZeroObligation: true },
    ),
  ]);

  // For future months, items with nextDuePayment === 0 but positive outstanding
  // balance have no recorded expenses in that statement window yet. Fill in
  // the projected MSI installments so the Pagos tarjeta tab shows real amounts.
  const today = new Date();
  if (asOfFirst > today) {
    const allItems = [...first, ...second];
    const itemsToFill = allItems.filter(
      (item) => item.nextDuePayment === 0 && item.outstandingBalance > 0,
    );
    await Promise.all(
      itemsToFill.map(async (item) => {
        const todayEnd = resolveCreditCardStatementWindow(
          today,
          item.cutoff_day,
          item.dueDay,
        ).statementEnd;
        const futureEnd = resolveCreditCardStatementWindow(
          asOfFirst,
          item.cutoff_day,
          item.dueDay,
        ).statementEnd;
        const monthOffset =
          (futureEnd.getUTCFullYear() - todayEnd.getUTCFullYear()) * 12 +
          (futureEnd.getUTCMonth() - todayEnd.getUTCMonth());
        if (monthOffset <= 0) return;
        const projected = await getMsiProjectedBalance(
          ownerFilter,
          item.walletId,
          monthOffset,
        );
        if (projected > 0) {
          item.nextDuePayment = projected;
        }
      }),
    );
  }

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
  const withDue = items.filter((i) => i.nextDuePayment > 0);
  const total = withDue.reduce((s, i) => s + i.nextDuePayment, 0);
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
  const withDue = [...first, ...second].filter((i) => i.nextDuePayment > 0);
  const total = withDue.reduce((s, i) => s + i.nextDuePayment, 0);
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
