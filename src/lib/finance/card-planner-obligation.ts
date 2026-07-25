import { todayCalendarDate } from '@/lib/calendar-dates';
import type {
  CardObligationAmountSource,
  CardStatementObligationDto,
  PlannerCardPaymentStatusUi,
} from '@/lib/finance/card-statement-obligation';

/**
 * Fortnight-scoped planner read model. Drives Pagos tarjeta and wallet Compromisos.
 * Separate from statement reconciliation (card hero, liquidity).
 */
export type CardPlannerObligationDto = {
  fortnightId: number;
  /** Planned gross or suggested statement due when no custom plan. */
  targetAmount: number;
  paymentsAppliedToFortnight: number;
  remainingPlannerAmount: number;
  plannerStatus: PlannerCardPaymentStatusUi;
  visibleDueDate: string;
  suggestedStatementAmount: number;
  paymentsAppliedToStatement: number;
  remainingStatementDue: number;
  plannedPayment: number | null;
  obligationAmountSource: CardObligationAmountSource;
  isEstimate: boolean;
  outstandingBalance: number;
  isStaleFullyCoveredPlan: boolean;
};

export const derivePlannerStatus = (input: {
  remainingPlannerAmount: number;
  paymentsAppliedToFortnight: number;
  paymentsAppliedToStatement?: number;
  targetAmount?: number;
  outstandingBalance?: number;
  visibleDueDate: string;
  todayYmd?: string;
}): PlannerCardPaymentStatusUi => {
  const today = input.todayYmd ?? todayCalendarDate();
  const target = input.targetAmount ?? 0;
  const statementPaid = input.paymentsAppliedToStatement ?? 0;

  if (input.remainingPlannerAmount <= 0) {
    // Pagado only when money was actually applied.
    if (input.paymentsAppliedToFortnight > 0) {
      return 'pagado';
    }
    if (target <= 0 && statementPaid > 0) {
      return 'pagado';
    }
    // Nothing due this cycle (with or without leftover wallet debt).
    // Current/next fortnights restore a wallet-debt estimate before this runs;
    // do not invent actionable por_pagar/vencido at $0.
    return 'sin_cargo';
  }

  if (today > input.visibleDueDate) {
    return 'vencido';
  }
  return 'por_pagar';
};

export const isPlannerPlanStale = (input: {
  plannedGrossAmount: number | null;
  remainingPlannerAmount: number;
  paymentsAppliedToFortnight: number;
}): boolean =>
  input.plannedGrossAmount != null &&
  input.plannedGrossAmount > 0 &&
  input.remainingPlannerAmount <= 0 &&
  input.paymentsAppliedToFortnight > 0;

export const buildCardPlannerObligation = (input: {
  fortnightId: number;
  statement: CardStatementObligationDto;
  plannedGrossAmount: number | null;
  paymentsAppliedToFortnight: number;
  todayYmd?: string;
}): CardPlannerObligationDto => {
  const suggestedAmount = input.statement.remainingStatementDue;
  // Legacy $0 plans must not override the suggested due (treat as no plan).
  const plannedGross =
    input.plannedGrossAmount != null && input.plannedGrossAmount > 0
      ? input.plannedGrossAmount
      : null;
  const targetAmount = plannedGross ?? suggestedAmount;
  const remainingPlannerAmount = Math.max(
    targetAmount - input.paymentsAppliedToFortnight,
    0,
  );
  const visibleDueDate = input.statement.cycle.statementDueDate;
  const plannerStatus = derivePlannerStatus({
    remainingPlannerAmount,
    paymentsAppliedToFortnight: input.paymentsAppliedToFortnight,
    paymentsAppliedToStatement: input.statement.paymentsAppliedToStatement,
    targetAmount,
    outstandingBalance: input.statement.outstandingBalance,
    visibleDueDate,
    todayYmd: input.todayYmd,
  });

  return {
    fortnightId: input.fortnightId,
    targetAmount,
    paymentsAppliedToFortnight: input.paymentsAppliedToFortnight,
    remainingPlannerAmount,
    plannerStatus,
    visibleDueDate,
    suggestedStatementAmount: input.statement.suggestedStatementAmount,
    paymentsAppliedToStatement: input.statement.paymentsAppliedToStatement,
    remainingStatementDue: input.statement.remainingStatementDue,
    plannedPayment: plannedGross,
    obligationAmountSource: input.statement.obligationAmountSource,
    isEstimate: input.statement.isEstimate,
    outstandingBalance: input.statement.outstandingBalance,
    isStaleFullyCoveredPlan: isPlannerPlanStale({
      plannedGrossAmount: plannedGross,
      remainingPlannerAmount,
      paymentsAppliedToFortnight: input.paymentsAppliedToFortnight,
    }),
  };
};

export type PlannerDuePaymentFields = {
  nextDuePayment: number;
  paymentsAppliedToStatement: number;
  paymentsAppliedToFortnight: number;
  statementDueDate: string;
  visibleDueDate: string;
  outstandingBalance: number;
  plannedPayment: number | null;
  effectiveAmount: number;
  remainingPlannerAmount: number;
  plannerStatus: PlannerCardPaymentStatusUi;
  obligationAmountSource: CardObligationAmountSource;
  isEstimate: boolean;
  isStaleFullyCoveredPlan: boolean;
  targetAmount: number;
};

export const toPlannerDuePaymentFields = (
  planner: CardPlannerObligationDto,
): PlannerDuePaymentFields => ({
  nextDuePayment: planner.remainingStatementDue,
  paymentsAppliedToStatement: planner.paymentsAppliedToStatement,
  paymentsAppliedToFortnight: planner.paymentsAppliedToFortnight,
  statementDueDate: planner.visibleDueDate,
  visibleDueDate: planner.visibleDueDate,
  outstandingBalance: planner.outstandingBalance,
  plannedPayment: planner.plannedPayment,
  effectiveAmount: planner.remainingPlannerAmount,
  remainingPlannerAmount: planner.remainingPlannerAmount,
  plannerStatus: planner.plannerStatus,
  obligationAmountSource: planner.obligationAmountSource,
  isEstimate: planner.isEstimate,
  isStaleFullyCoveredPlan: planner.isStaleFullyCoveredPlan,
  targetAmount: planner.targetAmount,
});
