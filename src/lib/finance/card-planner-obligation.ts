import { todayCalendarDate } from '@/lib/calendar-dates';
import { getCardPeriodObligation } from '@/lib/finance/card-period-surfaces';
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
  /** Planned gross, or the statement payoff when there is no custom plan. */
  targetAmount: number;
  paymentsAppliedToFortnight: number;
  remainingPlannerAmount: number;
  plannerStatus: PlannerCardPaymentStatusUi;
  visibleDueDate: string;
  paymentsAppliedToStatement: number;
  remainingStatementDue: number;
  plannedPayment: number | null;
  obligationAmountSource: CardObligationAmountSource;
  isEstimate: boolean;
  outstandingBalance: number;
  isStaleFullyCoveredPlan: boolean;
  statementPayoff: number | null;
  minimumPayment: number | null;
  declaredZero: boolean;
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
    if (input.paymentsAppliedToFortnight > 0) {
      return 'pagado';
    }
    if (target <= 0 && statementPaid > 0) {
      return 'pagado';
    }
    const debt = input.outstandingBalance ?? 0;
    if (target <= 0 && debt > 0) {
      return 'falta_dato';
    }
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
  explicitZero?: boolean;
}): CardPlannerObligationDto => {
  // Legacy $0 plans must not override the corte (treat as no plan).
  const plannedGross =
    input.plannedGrossAmount != null && input.plannedGrossAmount > 0
      ? input.plannedGrossAmount
      : null;
  const visibleDueDate = input.statement.cycle.statementDueDate;
  const periodObligation = getCardPeriodObligation({
    outstandingBalance: input.statement.outstandingBalance,
    dueInPeriod: true,
    statementPayoff: input.statement.statementPayoff,
    statementIsEstimate: input.statement.isEstimate,
    minimumPayment: input.statement.minimumPayment,
    plannedOverride: plannedGross,
    paymentsNotInPayoff: Math.max(
      0,
      input.paymentsAppliedToFortnight -
        input.statement.paymentsAppliedToStatement,
    ),
    paymentsApplied: Math.max(
      input.paymentsAppliedToFortnight,
      input.statement.paymentsAppliedToStatement,
    ),
    explicitZero: input.explicitZero === true,
  });
  const targetAmount =
    plannedGross ??
    input.statement.statementPayoff ??
    input.statement.remainingStatementDue;
  const remainingPlannerAmount =
    periodObligation.confidence === 'missing'
      ? 0
      : (periodObligation.amount ?? 0);
  const plannerStatus =
    periodObligation.confidence === 'missing'
      ? 'falta_dato'
      : derivePlannerStatus({
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
    paymentsAppliedToStatement: input.statement.paymentsAppliedToStatement,
    remainingStatementDue: input.statement.remainingStatementDue,
    plannedPayment: plannedGross,
    obligationAmountSource: input.statement.obligationAmountSource,
    isEstimate: input.statement.isEstimate,
    outstandingBalance: input.statement.outstandingBalance,
    statementPayoff: input.statement.statementPayoff,
    minimumPayment: input.statement.minimumPayment,
    declaredZero: input.explicitZero === true,
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
  statementPayoff: number | null;
  minimumPayment: number | null;
  declaredZero: boolean;
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
  statementPayoff: planner.statementPayoff,
  minimumPayment: planner.minimumPayment,
  declaredZero: planner.declaredZero,
});
