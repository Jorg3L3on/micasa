import type {
  CardObligationAmountSource,
  PlannerCardPaymentStatusUi,
} from '@/lib/finance/card-statement-obligation';

/**
 * Single period obligation for a card.
 * `amount: null` is unknown. `amount: 0` is explicit (paid or nothing due).
 * Total debt is never copied into `amount`.
 */
export type CardPeriodObligationBasis =
  | 'statement_no_interest'
  | 'minimum'
  | 'msi_installments'
  | 'planned_override'
  | 'none_declared';

export type CardPeriodObligationConfidence = 'exact' | 'estimated' | 'missing';

export type CardPeriodObligationGap = 'missing_statement_payoff';

export type CardPeriodObligation = {
  amount: number | null;
  basis: CardPeriodObligationBasis;
  confidence: CardPeriodObligationConfidence;
  gaps: CardPeriodObligationGap[];
};

export type ResolveCardPeriodObligationInput = {
  /** Outstanding balance. Utilization only; never the period amount. */
  outstandingBalance: number;
  /** True when the payment date falls in the period being read. */
  dueInPeriod: boolean;
  /**
   * Remaining pago para no generar intereses, or a ledger/open-cycle
   * reconstruction of that figure. Null when no statement figure is known.
   * Zero means the statement (or reconstruction) says nothing is due.
   */
  statementPayoff?: number | null;
  statementIsEstimate?: boolean;
  /** Captured issuer minimum. Used only when statement payoff is unknown. */
  minimumPayment?: number | null;
  /** MSI installments due this period, when not already inside statement payoff. */
  msiInstallmentDue?: number | null;
  /** Scheduled calendar amount for this period (not a purchase). */
  scheduledAmount?: number | null;
  /** User override for this period. Positive amounts win over every other basis. */
  plannedOverride?: number | null;
  /** User declared this cycle is $0. Distinct from a missing figure and from clearing a plan. */
  explicitZero?: boolean;
  /**
   * Fortnight payments that are not already subtracted from `statementPayoff`.
   * Statement figures are net of statement payments; this avoids counting them twice.
   */
  paymentsNotInPayoff?: number;
  /** Payments already applied. A covered remainder is paid, not missing. */
  paymentsApplied?: number;
};

const roundMoney = (value: number): number =>
  Math.round((Number(value) || 0) * 100) / 100;

const paidZero = (
  basis: CardPeriodObligationBasis,
): CardPeriodObligation => ({
  amount: 0,
  basis,
  confidence: 'exact',
  gaps: [],
});

/**
 * Priority: planned override → declared $0 → statement → minimum →
 * MSI / calendar → paid zero → missing (debt + due date, no figure) → explicit zero.
 */
export const resolveCardPeriodObligation = (
  input: ResolveCardPeriodObligationInput,
): CardPeriodObligation => {
  const paymentsApplied = roundMoney(Math.max(0, input.paymentsApplied ?? 0));
  const outstandingBalance = roundMoney(Math.max(0, input.outstandingBalance));
  const planned =
    input.plannedOverride != null && input.plannedOverride > 0
      ? roundMoney(input.plannedOverride)
      : null;

  if (planned != null) {
    const remaining = roundMoney(Math.max(planned - paymentsApplied, 0));
    if (remaining <= 0 && paymentsApplied > 0) {
      return paidZero('planned_override');
    }
    return {
      amount: remaining,
      basis: 'planned_override',
      confidence: 'exact',
      gaps: [],
    };
  }

  if (input.explicitZero) {
    return paidZero('none_declared');
  }

  if (input.statementPayoff != null && Number.isFinite(input.statementPayoff)) {
    const unnetted = roundMoney(Math.max(0, input.paymentsNotInPayoff ?? 0));
    const remaining = roundMoney(
      Math.max(input.statementPayoff - unnetted, 0),
    );
    if (remaining <= 0 && paymentsApplied > 0) {
      return paidZero('statement_no_interest');
    }
    if (remaining > 0) {
      return {
        amount: remaining,
        basis: 'statement_no_interest',
        confidence: input.statementIsEstimate ? 'estimated' : 'exact',
        gaps: [],
      };
    }
    return {
      amount: 0,
      basis: 'none_declared',
      confidence: 'exact',
      gaps: [],
    };
  }

  if (input.minimumPayment != null && input.minimumPayment > 0) {
    const remaining = roundMoney(
      Math.max(input.minimumPayment - paymentsApplied, 0),
    );
    if (remaining <= 0 && paymentsApplied > 0) {
      return paidZero('minimum');
    }
    if (remaining > 0) {
      return {
        amount: remaining,
        basis: 'minimum',
        confidence: 'exact',
        gaps: [],
      };
    }
  }

  const installment = roundMoney(
    Math.max(0, input.msiInstallmentDue ?? 0) +
      Math.max(0, input.scheduledAmount ?? 0),
  );
  if (installment > 0) {
    const remaining = roundMoney(Math.max(installment - paymentsApplied, 0));
    if (remaining <= 0 && paymentsApplied > 0) {
      return paidZero('msi_installments');
    }
    if (remaining > 0) {
      const fromCalendar =
        input.scheduledAmount != null && input.scheduledAmount > 0;
      return {
        amount: remaining,
        basis: 'msi_installments',
        confidence: fromCalendar ? 'exact' : 'estimated',
        gaps: [],
      };
    }
  }

  if (paymentsApplied > 0) {
    return paidZero('none_declared');
  }

  if (outstandingBalance > 0 && input.dueInPeriod) {
    return {
      amount: null,
      basis: 'none_declared',
      confidence: 'missing',
      gaps: ['missing_statement_payoff'],
    };
  }

  return {
    amount: 0,
    basis: 'none_declared',
    confidence: 'exact',
    gaps: [],
  };
};

/** Last positive write wins. A later period without a write does not erase it. */
export const lastPlannedOverrideWrite = (
  writes: readonly number[],
): number | null => {
  for (let index = writes.length - 1; index >= 0; index -= 1) {
    const amount = writes[index];
    if (amount != null && amount > 0) return roundMoney(amount);
  }
  return null;
};

export type DueItemObligationSource = {
  outstandingBalance?: number;
  nextDuePayment?: number;
  /** Null is unknown. Zero is an explicit corte figure. Omit to fall back to source. */
  statementPayoff?: number | null;
  obligationAmountSource?: CardObligationAmountSource;
  isEstimate?: boolean;
  plannedPayment?: number | null;
  declaredZero?: boolean;
  paymentsAppliedToStatement?: number;
  paymentsAppliedToFortnight?: number;
  minimumPayment?: number | null;
};

const statementSource = (
  source: CardObligationAmountSource | undefined,
): boolean =>
  source === 'import' || source === 'ledger' || source === 'projection';

/** Read model used by planner rows, liquidity, and MCP. */
export const dueItemToPeriodObligation = (
  item: DueItemObligationSource,
): CardPeriodObligation => {
  const source = item.obligationAmountSource;
  const statementPaid = item.paymentsAppliedToStatement ?? 0;
  const fortnightPaid = item.paymentsAppliedToFortnight ?? 0;
  const paymentsApplied = Math.max(statementPaid, fortnightPaid);
  const knownStatement = statementSource(source);
  const statementPayoff =
    source === 'scheduled_calendar'
      ? null
      : item.statementPayoff !== undefined
        ? item.statementPayoff
        : knownStatement
          ? (item.nextDuePayment ?? 0)
          : null;

  return resolveCardPeriodObligation({
    outstandingBalance: item.outstandingBalance ?? 0,
    dueInPeriod: true,
    statementPayoff,
    statementIsEstimate:
      source === 'ledger' ||
      source === 'projection' ||
      item.isEstimate === true,
    minimumPayment:
      source === 'scheduled_calendar' ? null : (item.minimumPayment ?? null),
    scheduledAmount:
      source === 'scheduled_calendar' ? (item.nextDuePayment ?? 0) : null,
    plannedOverride: item.plannedPayment ?? null,
    explicitZero: item.declaredZero === true,
    paymentsNotInPayoff: Math.max(0, fortnightPaid - statementPaid),
    paymentsApplied,
  });
};

export const periodObligationAmountOrZero = (
  obligation: CardPeriodObligation,
): number => (obligation.confidence === 'missing' ? 0 : (obligation.amount ?? 0));

/**
 * Prefill for Pagar / Registrar pago.
 * Missing stays empty (`null`). Explicit `0` is a real amount, never invented debt.
 */
export const periodObligationPrefillAmount = (
  obligation:
    | Pick<CardPeriodObligation, 'amount' | 'confidence'>
    | null
    | undefined,
): number | null => {
  if (obligation == null || obligation.confidence === 'missing') return null;
  if (obligation.amount == null) return null;
  return obligation.amount;
};

type ObligationCarrier = DueItemObligationSource & {
  plannerStatus?: PlannerCardPaymentStatusUi;
  effectiveAmount?: number;
  remainingPlannerAmount?: number;
  periodObligation?: CardPeriodObligation;
};

/** Writes the shared obligation and turns an unknown due into falta_dato. */
export const applyPeriodObligation = <T extends ObligationCarrier>(
  item: T,
): CardPeriodObligation => {
  const periodObligation = dueItemToPeriodObligation(item);
  item.periodObligation = periodObligation;
  const amount = periodObligation.amount ?? 0;
  if (periodObligation.confidence === 'missing') {
    item.plannerStatus = 'falta_dato';
    item.effectiveAmount = 0;
    item.remainingPlannerAmount = 0;
    return periodObligation;
  }

  item.effectiveAmount = amount;
  item.remainingPlannerAmount = amount;
  if (amount <= 0) {
    const paid =
      (item.paymentsAppliedToFortnight ?? 0) > 0 ||
      (item.paymentsAppliedToStatement ?? 0) > 0;
    item.plannerStatus = paid ? 'pagado' : 'sin_cargo';
  } else if (
    item.plannerStatus == null ||
    item.plannerStatus === 'falta_dato' ||
    item.plannerStatus === 'sin_cargo' ||
    item.plannerStatus === 'pagado'
  ) {
    item.plannerStatus = 'por_pagar';
  }
  return periodObligation;
};
