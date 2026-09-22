import type { RiskTag } from '@/lib/finance/cash-plan/types';

/**
 * Shortfall weights. Surplus adds explicit bonuses in `build-cash-plan.ts`
 * (low runway → buffer, near-equal APR → snowball momentum).
 * Changing these numbers should be reviewed against `golden/`.
 */
export const SHORTFALL_WEIGHTS = {
  gapClosed: 0.45,
  cost: 0.25,
  risk: 0.2,
  runway: 0.06,
  credit: 0.04,
} as const;

/** Two eligible routes within this composite gap are a tie. */
export const TIE_COMPOSITE_EPS = 0.03;

export const RISK_TAG_WEIGHTS = {
  late_fee: 0.35,
  credit_report_30d: 0.45,
  interest_accrual: 0.15,
  liquidity_drain: 0.2,
  new_debt: 0.25,
  approval_uncertain: 0.2,
  msi_break: 0.4,
  untouchable_conflict: 0.7,
} as const;

export const riskScore = (tags: readonly RiskTag[]): number => {
  const unique = [...new Set(tags)];
  const sum = unique.reduce((total, tag) => total + RISK_TAG_WEIGHTS[tag], 0);
  return Math.min(1, sum);
};

export const costScore = (costCents: number, scaleCents: number): number => {
  const cost = Math.max(0, costCents);
  const scale = Math.max(1, scaleCents);
  return cost / (cost + scale);
};

export const compositeScore = (input: {
  gapClosed: number;
  costCents: number;
  scaleCents: number;
  risk: number;
  runwayPeriods: number;
  credit: number;
}): number => {
  const runwayScore = Math.min(1, Math.max(0, input.runwayPeriods) / 3);
  return (
    SHORTFALL_WEIGHTS.gapClosed * input.gapClosed -
    SHORTFALL_WEIGHTS.cost * costScore(input.costCents, input.scaleCents) -
    SHORTFALL_WEIGHTS.risk * input.risk +
    SHORTFALL_WEIGHTS.runway * runwayScore +
    SHORTFALL_WEIGHTS.credit * input.credit
  );
};
