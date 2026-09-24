import {
  endOfCalendarDay,
  formatCalendarDate,
  parseCalendarDate,
  todayCalendarDate,
} from '@/lib/calendar-dates';

/** How the remaining statement due amount was derived. */
export type CardObligationAmountSource =
  | 'import'
  | 'ledger'
  | 'wallet_debt'
  | 'projection'
  | 'scheduled_calendar'
  | 'none';

/** Planner-facing payment status for a card statement obligation. */
export type CardStatementObligationStatus =
  | 'unpaid'
  | 'partial'
  | 'paid'
  | 'overdue'
  | 'no_obligation';

/** UI-facing planner status (Spanish labels in components). */
export type PlannerCardPaymentStatusUi =
  | 'pagado'
  | 'vencido'
  | 'por_pagar'
  | 'sin_cargo'
  | 'falta_dato';

/** Short hint when the corte amount is not from an imported statement. */
export const formatCardObligationAmountSourceHint = (
  source: CardObligationAmountSource | undefined,
  isEstimate?: boolean,
): string | null => {
  if (source === 'import' || source === 'none' || source == null) {
    return null;
  }
  if (source === 'ledger') {
    return isEstimate ? null : 'Según movimientos del corte';
  }
  if (source === 'wallet_debt') {
    return 'Estimado · deuda en billetera';
  }
  if (source === 'projection') {
    return 'Estimado · compras del ciclo abierto';
  }
  if (source === 'scheduled_calendar') {
    return 'Calendario de pagos';
  }
  return null;
};

export type CardStatementCycle = {
  statementStart: string;
  statementEnd: string;
  currentCycleStart: string;
  currentCycleEnd: string;
  statementDueDate: string;
};

/**
 * Canonical read model for a credit/store card statement obligation.
 * Consumed by planner, card detail, wallets, dashboard, reports, and liquidity.
 */
export type CardStatementObligationDto = {
  walletId: number;
  walletName: string;
  walletType: string;
  cutoffDay: number;
  dueDay: number;
  cycle: CardStatementCycle;
  lastStatementBalance: number;
  /** Imported statement total when available. */
  importedAmount: number | null;
  /** Ledger-derived statement balance before payments. */
  ledgerAmount: number;
  outstandingBalance: number;
  paymentsAppliedToStatement: number;
  /**
   * Pago del corte. `null` is unknown. `0` is an explicit figure
   * (import, ledger, or open cycle says nothing remains).
   * `remainingStatementDue` is the same number with null coerced to 0 for sums.
   */
  statementPayoff: number | null;
  /** Captured issuer minimum. Does not replace a known statement payoff. */
  minimumPayment: number | null;
  remainingStatementDue: number;
  plannedGrossAmount: number | null;
  remainingPlannedAmount: number | null;
  amountAlreadyPaid: number;
  obligationAmountSource: CardObligationAmountSource;
  status: CardStatementObligationStatus;
  /** True when the amount is an open-cycle projection, not a closed statement. */
  isEstimate: boolean;
};

export type CreditCardStatementWindow = {
  statementStart: Date;
  statementEnd: Date;
  currentCycleStart: Date;
  currentCycleEnd: Date;
  statementDueDate: Date;
};

export type ComputeNextDuePaymentInput = {
  lastStatementBalance: number;
  paymentsAppliedToStatement: number;
  importedTotalDue: number | null;
  outstandingBalance: number;
  dueDay: number;
  cutoffDay: number;
  projectedStatementInstallmentsTotal?: number;
  currentCyclePurchasesTotal?: number;
  currentCyclePaymentsTotal?: number;
  asOfYmd?: string;
  currentCycleEndYmd?: string;
  allowOutstandingBalanceFallback?: boolean;
};

export type BuildCardStatementObligationInput = {
  walletId: number;
  walletName: string;
  walletType: string;
  cutoffDay: number;
  dueDay: number;
  window: CreditCardStatementWindow;
  lastStatementBalance: number;
  paymentsAppliedToStatement: number;
  importedTotalDue: number | null;
  outstandingBalance: number;
  projectedStatementInstallmentsTotal?: number;
  currentCyclePurchasesTotal?: number;
  currentCyclePaymentsTotal?: number;
  asOfYmd?: string;
  plannedGrossAmount?: number | null;
  allowOutstandingBalanceFallback?: boolean;
  /** Captured issuer minimum for this window. Not a substitute for the statement. */
  minimumPayment?: number | null;
  /** Calendar YYYY-MM-DD for overdue check; defaults to today in Mexico City. */
  todayYmd?: string;
};

export type StatementPayoffResolution = {
  /** Null when no import, ledger charge, or open-cycle figure exists. */
  amount: number | null;
  source: CardObligationAmountSource;
};

/**
 * The only place a statement figure is born.
 * `amount: null` is unknown. `amount: 0` means a real source says nothing is due.
 * Total debt is never copied into `amount`.
 */
export const resolveStatementPayoff = ({
  lastStatementBalance,
  paymentsAppliedToStatement,
  importedTotalDue,
  outstandingBalance,
  dueDay,
  cutoffDay,
  projectedStatementInstallmentsTotal = 0,
  currentCyclePurchasesTotal = 0,
  currentCyclePaymentsTotal = 0,
  asOfYmd,
  currentCycleEndYmd,
  allowOutstandingBalanceFallback = true,
}: ComputeNextDuePaymentInput): StatementPayoffResolution => {
  const projectedInstallments = Math.max(projectedStatementInstallmentsTotal, 0);
  const statementBalance = lastStatementBalance + projectedInstallments;
  const ledgerDue = Math.max(statementBalance - paymentsAppliedToStatement, 0);
  const projectedOpenCycleDue =
    dueDay < cutoffDay &&
    currentCyclePurchasesTotal > 0 &&
    asOfYmd != null &&
    currentCycleEndYmd != null &&
    asOfYmd <= currentCycleEndYmd
      ? Math.max(currentCyclePurchasesTotal - currentCyclePaymentsTotal, 0)
      : 0;

  if (importedTotalDue != null) {
    if (outstandingBalance <= 0) {
      return { amount: 0, source: 'import' };
    }
    return {
      amount: Math.max(importedTotalDue - paymentsAppliedToStatement, 0),
      source: 'import',
    };
  }

  if (statementBalance > 0) {
    return {
      amount: ledgerDue,
      source: lastStatementBalance > 0 ? 'ledger' : 'projection',
    };
  }

  if (projectedOpenCycleDue > 0) {
    return { amount: projectedOpenCycleDue, source: 'projection' };
  }

  void allowOutstandingBalanceFallback;
  return { amount: null, source: 'none' };
};

const toDateOnlyString = (date: Date) => formatCalendarDate(date);

const createCalendarDate = (year: number, month: number, day: number) =>
  parseCalendarDate(
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
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
  return createCalendarDate(year, month, clampDayToMonth(year, month, targetDay));
};

const resolvePreviousOrSameCutoff = (asOf: Date, cutoffDay: number) => {
  const [asOfYear, asOfMonth] = formatCalendarDate(asOf).split('-').map(Number);
  const currentMonthCutoff = createCalendarDate(
    asOfYear,
    asOfMonth,
    clampDayToMonth(asOfYear, asOfMonth, cutoffDay),
  );

  if (asOf >= currentMonthCutoff) {
    return currentMonthCutoff;
  }

  return addMonths(currentMonthCutoff, -1, cutoffDay);
};

const resolveDueDate = (statementEnd: Date, dueDay: number) => {
  const [year, month] = formatCalendarDate(statementEnd).split('-').map(Number);
  const candidate = createCalendarDate(
    year,
    month,
    clampDayToMonth(year, month, dueDay),
  );

  if (candidate > statementEnd) {
    return candidate;
  }

  return addMonths(candidate, 1, dueDay);
};

/** Inclusive upper bound for the due calendar day in Mexico City. */
const endOfDueCalendarDay = (date: Date) =>
  endOfCalendarDay(formatCalendarDate(date));

/**
 * Pago que cuenta contra el corte: día UTC posterior al del cierre, o mismo día UTC con `paid_at`
 * estrictamente después del instante de cierre.
 */
export const paymentAppliesToStatementPeriod = (
  paidAt: Date,
  statementEnd: Date,
  statementDueDate: Date,
): boolean => {
  const paidMs = paidAt.getTime();
  if (paidMs > endOfDueCalendarDay(statementDueDate).getTime()) {
    return false;
  }
  const payDay = toDateOnlyString(paidAt);
  const endDay = toDateOnlyString(statementEnd);
  if (payDay > endDay) return true;
  if (payDay < endDay) return false;
  return paidMs > statementEnd.getTime();
};

export const resolveCreditCardStatementWindow = (
  asOfDate: Date,
  cutoffDay: number,
  dueDay: number,
): CreditCardStatementWindow => {
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

export const toCardStatementCycle = (
  window: CreditCardStatementWindow,
): CardStatementCycle => ({
  statementStart: toDateOnlyString(window.statementStart),
  statementEnd: toDateOnlyString(window.statementEnd),
  currentCycleStart: toDateOnlyString(window.currentCycleStart),
  currentCycleEnd: toDateOnlyString(window.currentCycleEnd),
  statementDueDate: toDateOnlyString(window.statementDueDate),
});

/**
 * Pago del corte / toca pagar for this statement.
 *
 * Priority:
 * 1. Imported "pago para no generar intereses", minus payments already applied.
 * 2. Ledger statement balance (posted charges, including a projected MSI cuota
 *    that belongs to this statement) minus payments.
 * 3. Open-cycle purchases when the due day precedes the cutoff.
 * 4. Otherwise null, returned here as 0 so existing numeric callers keep working.
 *    Period readers must use `resolveStatementPayoff` / `statementPayoff`.
 *
 * `outstandingBalance` is deuda total. It feeds utilization and the "wallet
 * paid off" check, and is never the period payment — even when
 * `allowOutstandingBalanceFallback` is true. Remaining MSI plan balance is
 * not an input here. An imported total of 0 stays an explicit zero, not null.
 */
export const computeNextDuePayment = (
  input: ComputeNextDuePaymentInput,
): number => resolveStatementPayoff(input).amount ?? 0;

export const deriveObligationAmountSource = (input: {
  importedTotalDue: number | null;
  lastStatementBalance: number;
  outstandingBalance: number;
  dueDay: number;
  cutoffDay: number;
  projectedStatementInstallmentsTotal?: number;
  currentCyclePurchasesTotal?: number;
  currentCyclePaymentsTotal?: number;
  paymentsAppliedToStatement?: number;
  asOfYmd?: string;
  currentCycleEndYmd?: string;
  remainingStatementDue: number;
  allowOutstandingBalanceFallback?: boolean;
}): CardObligationAmountSource =>
  resolveStatementPayoff({
    lastStatementBalance: input.lastStatementBalance,
    paymentsAppliedToStatement: input.paymentsAppliedToStatement ?? 0,
    importedTotalDue: input.importedTotalDue,
    outstandingBalance: input.outstandingBalance,
    dueDay: input.dueDay,
    cutoffDay: input.cutoffDay,
    projectedStatementInstallmentsTotal: input.projectedStatementInstallmentsTotal,
    currentCyclePurchasesTotal: input.currentCyclePurchasesTotal,
    currentCyclePaymentsTotal: input.currentCyclePaymentsTotal,
    asOfYmd: input.asOfYmd,
    currentCycleEndYmd: input.currentCycleEndYmd,
    allowOutstandingBalanceFallback: input.allowOutstandingBalanceFallback,
  }).source;

export const getRemainingPlannedAmount = (input: {
  plannedGrossAmount: number | null;
  paymentsAppliedToStatement: number;
  remainingStatementDue: number;
}): number | null => {
  if (input.plannedGrossAmount == null) {
    return null;
  }
  return Math.max(
    input.plannedGrossAmount - input.paymentsAppliedToStatement,
    0,
  );
};

export const deriveCardStatementObligationStatus = (input: {
  remainingStatementDue: number;
  remainingPlannedAmount: number | null;
  paymentsAppliedToStatement: number;
  statementDueDateYmd: string;
  todayYmd?: string;
}): CardStatementObligationStatus => {
  const effectiveRemaining =
    input.remainingPlannedAmount ?? input.remainingStatementDue;

  if (effectiveRemaining <= 0) {
    if (input.paymentsAppliedToStatement > 0) {
      return 'paid';
    }
    return 'no_obligation';
  }

  const today = input.todayYmd ?? todayCalendarDate();
  if (today > input.statementDueDateYmd) {
    return 'overdue';
  }

  if (input.paymentsAppliedToStatement > 0) {
    return 'partial';
  }

  return 'unpaid';
};

export const toPlannerCardPaymentStatusUi = (
  obligation: Pick<
    CardStatementObligationDto,
    'status' | 'remainingStatementDue' | 'remainingPlannedAmount'
  >,
): PlannerCardPaymentStatusUi => {
  const effectiveRemaining =
    obligation.remainingPlannedAmount ?? obligation.remainingStatementDue;
  if (effectiveRemaining <= 0) {
    if (obligation.status === 'paid') {
      return 'pagado';
    }
    return 'sin_cargo';
  }
  if (obligation.status === 'overdue') {
    return 'vencido';
  }
  return 'por_pagar';
};

export const toDuePaymentItemFields = (
  obligation: CardStatementObligationDto,
): {
  nextDuePayment: number;
  paymentsAppliedToStatement: number;
  statementDueDate: string;
  outstandingBalance: number;
  plannedPayment: number | null;
  effectiveAmount: number;
  plannerStatus: PlannerCardPaymentStatusUi;
  obligationAmountSource: CardObligationAmountSource;
  isEstimate: boolean;
  remainingPlannedAmount: number | null;
  statementPayoff: number | null;
  minimumPayment: number | null;
} => ({
  nextDuePayment: obligation.remainingStatementDue,
  paymentsAppliedToStatement: obligation.paymentsAppliedToStatement,
  statementDueDate: obligation.cycle.statementDueDate,
  outstandingBalance: obligation.outstandingBalance,
  plannedPayment: obligation.plannedGrossAmount,
  effectiveAmount:
    obligation.remainingPlannedAmount ?? obligation.remainingStatementDue,
  plannerStatus: toPlannerCardPaymentStatusUi(obligation),
  obligationAmountSource: obligation.obligationAmountSource,
  isEstimate: obligation.isEstimate,
  remainingPlannedAmount: obligation.remainingPlannedAmount,
  statementPayoff: obligation.statementPayoff,
  minimumPayment: obligation.minimumPayment,
});

export const reconcileDuePaymentItemCanonicalFields = (
  item: {
    nextDuePayment: number;
    paymentsAppliedToStatement: number;
    statementDueDate: string;
    plannedPayment?: number | null;
    obligationAmountSource?: CardObligationAmountSource;
    isEstimate?: boolean;
  },
  todayYmd?: string,
) => {
  const remainingPlannedAmount = getRemainingPlannedAmount({
    plannedGrossAmount: item.plannedPayment ?? null,
    paymentsAppliedToStatement: item.paymentsAppliedToStatement,
    remainingStatementDue: item.nextDuePayment,
  });
  const effectiveAmount = remainingPlannedAmount ?? item.nextDuePayment;
  const status = deriveCardStatementObligationStatus({
    remainingStatementDue: item.nextDuePayment,
    remainingPlannedAmount,
    paymentsAppliedToStatement: item.paymentsAppliedToStatement,
    statementDueDateYmd: item.statementDueDate,
    todayYmd,
  });
  return {
    plannedPayment: item.plannedPayment ?? null,
    remainingPlannedAmount,
    effectiveAmount,
    plannerStatus: toPlannerCardPaymentStatusUi({
      status,
      remainingStatementDue: item.nextDuePayment,
      remainingPlannedAmount,
    }),
    obligationAmountSource: item.obligationAmountSource,
    isEstimate: item.isEstimate,
  };
};

export const buildCardStatementObligation = (
  input: BuildCardStatementObligationInput,
): CardStatementObligationDto => {
  const cycle = toCardStatementCycle(input.window);
  const currentCycleEndYmd = cycle.currentCycleEnd;

  const payoff = resolveStatementPayoff({
    lastStatementBalance: input.lastStatementBalance,
    paymentsAppliedToStatement: input.paymentsAppliedToStatement,
    importedTotalDue: input.importedTotalDue,
    outstandingBalance: input.outstandingBalance,
    dueDay: input.dueDay,
    cutoffDay: input.cutoffDay,
    projectedStatementInstallmentsTotal:
      input.projectedStatementInstallmentsTotal ?? 0,
    currentCyclePurchasesTotal: input.currentCyclePurchasesTotal ?? 0,
    currentCyclePaymentsTotal: input.currentCyclePaymentsTotal ?? 0,
    asOfYmd: input.asOfYmd ?? todayCalendarDate(),
    currentCycleEndYmd,
    allowOutstandingBalanceFallback:
      input.allowOutstandingBalanceFallback ?? true,
  });
  const statementPayoff = payoff.amount;
  const remainingStatementDue = statementPayoff ?? 0;
  const obligationAmountSource = payoff.source;

  const plannedGrossAmount = input.plannedGrossAmount ?? null;
  const remainingPlannedAmount = getRemainingPlannedAmount({
    plannedGrossAmount,
    paymentsAppliedToStatement: input.paymentsAppliedToStatement,
    remainingStatementDue,
  });

  const status = deriveCardStatementObligationStatus({
    remainingStatementDue,
    remainingPlannedAmount,
    paymentsAppliedToStatement: input.paymentsAppliedToStatement,
    statementDueDateYmd: cycle.statementDueDate,
    todayYmd: input.todayYmd,
  });

  const isEstimate =
    obligationAmountSource === 'wallet_debt' ||
    obligationAmountSource === 'projection';

  return {
    walletId: input.walletId,
    walletName: input.walletName,
    walletType: input.walletType,
    cutoffDay: input.cutoffDay,
    dueDay: input.dueDay,
    cycle,
    lastStatementBalance: input.lastStatementBalance,
    importedAmount: input.importedTotalDue,
    ledgerAmount: input.lastStatementBalance,
    outstandingBalance: input.outstandingBalance,
    paymentsAppliedToStatement: input.paymentsAppliedToStatement,
    statementPayoff,
    minimumPayment:
      input.minimumPayment != null && input.minimumPayment > 0
        ? input.minimumPayment
        : null,
    remainingStatementDue,
    plannedGrossAmount,
    remainingPlannedAmount,
    amountAlreadyPaid: input.paymentsAppliedToStatement,
    obligationAmountSource,
    status,
    isEstimate,
  };
};

export type ScheduledCalendarDue = {
  amount: number;
  dueDate: string;
};

/**
 * When a user-defined payment calendar exists, prefer the nearest uncovered row
 * over a zero statement due, or whichever obligation is due sooner.
 */
export const mergeScheduledCalendarWithStatementDue = ({
  statementDue,
  statementDueDateYmd,
  scheduled,
}: {
  statementDue: number;
  statementDueDateYmd: string;
  scheduled: ScheduledCalendarDue | null;
}): {
  amount: number;
  dueDateYmd: string;
  usedScheduledCalendar: boolean;
} => {
  if (!scheduled) {
    return {
      amount: statementDue,
      dueDateYmd: statementDueDateYmd,
      usedScheduledCalendar: false,
    };
  }

  if (statementDue <= 0) {
    return {
      amount: scheduled.amount,
      dueDateYmd: scheduled.dueDate,
      usedScheduledCalendar: true,
    };
  }

  if (scheduled.dueDate < statementDueDateYmd) {
    return {
      amount: scheduled.amount,
      dueDateYmd: scheduled.dueDate,
      usedScheduledCalendar: true,
    };
  }

  return {
    amount: statementDue,
    dueDateYmd: statementDueDateYmd,
    usedScheduledCalendar: false,
  };
};
