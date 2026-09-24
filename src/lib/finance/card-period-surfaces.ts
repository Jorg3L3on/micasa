import {
  dueItemToPeriodObligation,
  minimumPaymentForPeriod,
  resolveCardPeriodObligation,
  type CardPeriodObligation,
  type CardPeriodObligationBasis,
  type CardPeriodObligationConfidence,
  type CardPeriodObligationGap,
  type DueItemObligationSource,
  type ResolveCardPeriodObligationInput,
} from '@/lib/finance/card-period-obligation';
import {
  selectActivePlannedOverride,
  type StatementCycleRef,
  type StoredPaymentPlanWrite,
} from '@/lib/finance/card-payment-plan-scope';
import type { PlannerCardPaymentStatusUi } from '@/lib/finance/card-statement-obligation';

/**
 * Single reader for Panel, Liquidez and MCP.
 * Plan writes go through `selectActivePlannedOverride` before the resolver.
 */
export type GetCardPeriodObligationInput = ResolveCardPeriodObligationInput & {
  statementMinimum?: number | null;
  persistedMinimum?: number | null;
  planWrites?: readonly StoredPaymentPlanWrite[];
  cycle?: StatementCycleRef;
  cutoffDay?: number;
  dueDay?: number;
};

export const getCardPeriodObligation = (
  input: GetCardPeriodObligationInput,
): CardPeriodObligation => {
  let plannedOverride = input.plannedOverride ?? null;
  let explicitZero = input.explicitZero === true;

  if (
    input.planWrites != null &&
    input.cycle != null &&
    input.cutoffDay != null &&
    input.dueDay != null
  ) {
    const active = selectActivePlannedOverride(input.planWrites, input.cycle, {
      cutoffDay: input.cutoffDay,
      dueDay: input.dueDay,
    });
    plannedOverride = active.plannedOverride;
    explicitZero = active.explicitZero;
  }

  const statementPayoff = input.statementPayoff;
  const minimumPayment =
    input.minimumPayment !== undefined
      ? input.minimumPayment
      : minimumPaymentForPeriod({
          statementPayoff,
          statementMinimum: input.statementMinimum,
          persistedMinimum: input.persistedMinimum,
        });

  return resolveCardPeriodObligation({
    outstandingBalance: input.outstandingBalance,
    dueInPeriod: input.dueInPeriod,
    statementPayoff,
    statementIsEstimate: input.statementIsEstimate,
    minimumPayment,
    msiInstallmentDue: input.msiInstallmentDue,
    scheduledAmount: input.scheduledAmount,
    plannedOverride,
    explicitZero,
    paymentsNotInPayoff: input.paymentsNotInPayoff,
    paymentsApplied: input.paymentsApplied,
  });
};

export type CardObligationSurfaceSnapshot = {
  amount: number | null;
  basis: CardPeriodObligationBasis;
  confidence: CardPeriodObligationConfidence;
  gaps: CardPeriodObligationGap[];
  /** Cash figure. Missing is excluded, never stored as 0. */
  knownCashAmount: number | null;
  countsInKnownTotal: boolean;
  countsAsGap: boolean;
  countsAsPending: boolean;
  plannerStatus: PlannerCardPaymentStatusUi;
  /** Missing never paints ALCANZA. */
  entersAlcanza: boolean;
};

const plannerStatusFor = (
  obligation: CardPeriodObligation,
  paymentsApplied: number,
): PlannerCardPaymentStatusUi => {
  if (obligation.confidence === 'missing') return 'falta_dato';
  const amount = obligation.amount ?? 0;
  if (amount <= 0) return paymentsApplied > 0 ? 'pagado' : 'sin_cargo';
  return 'por_pagar';
};

/** Same snapshot for every surface. Missing is a gap, not $0. */
export const snapshotFromObligation = (
  obligation: CardPeriodObligation,
  paymentsApplied = 0,
): CardObligationSurfaceSnapshot => {
  const missing = obligation.confidence === 'missing';
  const amount = missing ? null : obligation.amount;
  const known = amount != null && amount > 0;
  return {
    amount,
    basis: obligation.basis,
    confidence: obligation.confidence,
    gaps: obligation.gaps,
    knownCashAmount: missing ? null : (amount ?? 0),
    countsInKnownTotal: known,
    countsAsGap: missing,
    countsAsPending: missing || known,
    plannerStatus: plannerStatusFor(obligation, paymentsApplied),
    entersAlcanza: !missing,
  };
};

export const panelSnapshotFromDueItem = (
  item: DueItemObligationSource,
): CardObligationSurfaceSnapshot =>
  snapshotFromObligation(
    dueItemToPeriodObligation(item),
    Math.max(
      item.paymentsAppliedToStatement ?? 0,
      item.paymentsAppliedToFortnight ?? 0,
    ),
  );

export const liquiditySnapshotFromQuery = (
  input: GetCardPeriodObligationInput,
): CardObligationSurfaceSnapshot =>
  snapshotFromObligation(
    getCardPeriodObligation(input),
    input.paymentsApplied ?? 0,
  );

export const mcpSnapshotFromDueItem = (
  item: DueItemObligationSource,
): CardObligationSurfaceSnapshot => panelSnapshotFromDueItem(item);

/** Plan must not treat a missing corte as statement due of $0. */
export const planContributionFromObligation = (
  obligation: CardPeriodObligation,
): { statementDue: number | null; gap: 'missing_statement' | null } => {
  if (obligation.confidence === 'missing' || obligation.amount == null) {
    return { statementDue: null, gap: 'missing_statement' };
  }
  return { statementDue: obligation.amount, gap: null };
};
