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
  | 'none';

/** Planner-facing payment status for a card statement obligation. */
export type CardStatementObligationStatus =
  | 'unpaid'
  | 'partial'
  | 'paid'
  | 'overdue'
  | 'no_obligation';

/** UI-facing planner status (Spanish labels in components). */
export type PlannerCardPaymentStatusUi = 'pagado' | 'vencido' | 'por_pagar';

/** Short hint when the suggested amount is not from an imported statement. */
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
  /** Raw suggested amount before user plan overlay (same as remaining when no plan). */
  suggestedStatementAmount: number;
  remainingStatementDue: number;
  plannedGrossAmount: number | null;
  remainingPlannedAmount: number | null;
  amountAlreadyPaid: number;
  obligationAmountSource: CardObligationAmountSource;
  status: CardStatementObligationStatus;
  /** True when amount comes from wallet debt or open-cycle projection fallback. */
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
  currentCyclePurchasesTotal?: number;
  currentCyclePaymentsTotal?: number;
  asOfYmd?: string;
  currentCycleEndYmd?: string;
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
  currentCyclePurchasesTotal?: number;
  currentCyclePaymentsTotal?: number;
  asOfYmd?: string;
  plannedGrossAmount?: number | null;
  /** Calendar YYYY-MM-DD for overdue check; defaults to today in Mexico City. */
  todayYmd?: string;
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
 * Monto sugerido a pagar al próximo vencimiento.
 */
export const computeNextDuePayment = ({
  lastStatementBalance,
  paymentsAppliedToStatement,
  importedTotalDue,
  outstandingBalance,
  dueDay,
  cutoffDay,
  currentCyclePurchasesTotal = 0,
  currentCyclePaymentsTotal = 0,
  asOfYmd,
  currentCycleEndYmd,
}: ComputeNextDuePaymentInput): number => {
  const ledgerDue = Math.max(
    lastStatementBalance - paymentsAppliedToStatement,
    0,
  );
  const outstandingDue = Math.max(
    outstandingBalance - paymentsAppliedToStatement,
    0,
  );

  let nextDuePayment: number;
  if (importedTotalDue != null) {
    nextDuePayment = Math.max(importedTotalDue - paymentsAppliedToStatement, 0);
  } else if (ledgerDue <= 0 && outstandingDue > 0) {
    nextDuePayment = outstandingDue;
  } else {
    nextDuePayment = ledgerDue;
  }

  if (
    dueDay < cutoffDay &&
    nextDuePayment === 0 &&
    currentCyclePurchasesTotal > 0 &&
    asOfYmd != null &&
    currentCycleEndYmd != null &&
    asOfYmd <= currentCycleEndYmd
  ) {
    nextDuePayment = Math.max(
      currentCyclePurchasesTotal - currentCyclePaymentsTotal,
      0,
    );
  }

  return nextDuePayment;
};

export const deriveObligationAmountSource = (input: {
  importedTotalDue: number | null;
  lastStatementBalance: number;
  outstandingBalance: number;
  dueDay: number;
  cutoffDay: number;
  currentCyclePurchasesTotal?: number;
  asOfYmd?: string;
  currentCycleEndYmd?: string;
  remainingStatementDue: number;
}): CardObligationAmountSource => {
  if (input.remainingStatementDue <= 0) {
    return 'none';
  }
  if (input.importedTotalDue != null) {
    return 'import';
  }
  const ledgerDue = Math.max(input.lastStatementBalance, 0);
  if (ledgerDue > 0) {
    return 'ledger';
  }
  if (input.outstandingBalance > 0) {
    return 'wallet_debt';
  }
  if (
    input.dueDay < input.cutoffDay &&
    (input.currentCyclePurchasesTotal ?? 0) > 0 &&
    input.asOfYmd != null &&
    input.currentCycleEndYmd != null &&
    input.asOfYmd <= input.currentCycleEndYmd
  ) {
    return 'projection';
  }
  return 'none';
};

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
    return 'pagado';
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

  const remainingStatementDue = computeNextDuePayment({
    lastStatementBalance: input.lastStatementBalance,
    paymentsAppliedToStatement: input.paymentsAppliedToStatement,
    importedTotalDue: input.importedTotalDue,
    outstandingBalance: input.outstandingBalance,
    dueDay: input.dueDay,
    cutoffDay: input.cutoffDay,
    currentCyclePurchasesTotal: input.currentCyclePurchasesTotal ?? 0,
    currentCyclePaymentsTotal: input.currentCyclePaymentsTotal ?? 0,
    asOfYmd: input.asOfYmd ?? todayCalendarDate(),
    currentCycleEndYmd,
  });

  const obligationAmountSource = deriveObligationAmountSource({
    importedTotalDue: input.importedTotalDue,
    lastStatementBalance: input.lastStatementBalance,
    outstandingBalance: input.outstandingBalance,
    dueDay: input.dueDay,
    cutoffDay: input.cutoffDay,
    currentCyclePurchasesTotal: input.currentCyclePurchasesTotal,
    asOfYmd: input.asOfYmd,
    currentCycleEndYmd,
    remainingStatementDue,
  });

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

  const suggestedBeforePayments =
    input.importedTotalDue ??
    (input.lastStatementBalance > 0
      ? input.lastStatementBalance
      : obligationAmountSource === 'projection'
        ? (input.currentCyclePurchasesTotal ?? 0)
        : input.outstandingBalance);

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
    suggestedStatementAmount: suggestedBeforePayments,
    remainingStatementDue,
    plannedGrossAmount,
    remainingPlannedAmount,
    amountAlreadyPaid: input.paymentsAppliedToStatement,
    obligationAmountSource,
    status,
    isEstimate,
  };
};
