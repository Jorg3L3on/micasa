import type { PlanResult, PlanStrategyKey, RankedPlan, RiskTag } from '@/lib/finance/cash-plan/types';

export type TiePreference = 'cost' | 'risk';

/** Of the primary and its tie partner, the one with lower cost or lower risk. */
export const pickTiePlan = (
  primary: RankedPlan,
  other: RankedPlan | undefined,
  preference: TiePreference,
): RankedPlan => {
  if (!other) return primary;
  const pair = [primary, other];
  if (preference === 'cost') {
    return [...pair].sort((left, right) => left.scores.cost - right.scores.cost || left.id.localeCompare(right.id))[0] ?? primary;
  }
  return [...pair].sort((left, right) => left.scores.risk - right.scores.risk || left.id.localeCompare(right.id))[0] ?? primary;
};

/** Every route in the engine's rank order: primary first, then alternatives. */
export const rankedRoutes = (plan: PlanResult): RankedPlan[] => [plan.primary, ...plan.alternatives];

/** The route the screen features: the one picked, else the tie choice, else the primary. */
export const resolveFeaturedPlan = (
  plan: PlanResult,
  selectedPlanId: string | null,
  tiePreference: TiePreference | null,
): RankedPlan => {
  const routes = rankedRoutes(plan);
  const tieOther = plan.tiePlanId ? routes.find((item) => item.id === plan.tiePlanId) : undefined;
  const tieFeatured = plan.tie && tiePreference ? pickTiePlan(plan.primary, tieOther, tiePreference) : plan.primary;
  if (!selectedPlanId) return tieFeatured;
  return routes.find((item) => item.id === selectedPlanId) ?? tieFeatured;
};

export const METHOD_LABELS: Partial<Record<PlanStrategyKey, string>> = {
  avalanche: 'Avalancha',
  snowball: 'Bola de nieve',
  buffer: 'Colchón',
  minimums: 'Mínimos',
  defer: 'Aplazar',
  bridge: 'Préstamo',
  consolidate: 'Consolidación',
  payoff: 'Liquidar',
};

/** Routes the engine only simulates with numbers the user typed. */
export const isSimulatedRoute = (route: RankedPlan): boolean =>
  route.strategyKey === 'bridge' || route.strategyKey === 'consolidate';

/** Most serious first; the card shows one chip. */
const RISK_SEVERITY: readonly RiskTag[] = [
  'untouchable_conflict',
  'credit_report_30d',
  'late_fee',
  'msi_break',
  'new_debt',
  'approval_uncertain',
  'liquidity_drain',
  'interest_accrual',
];

export const topRiskTag = (tags: readonly RiskTag[]): RiskTag | null =>
  RISK_SEVERITY.find((tag) => tags.includes(tag)) ?? null;

export type RiskLevel = 'low' | 'medium' | 'high';

export const riskLevel = (risk: number): RiskLevel => {
  if (risk < 1 / 3) return 'low';
  if (risk < 2 / 3) return 'medium';
  return 'high';
};

/** Cash set aside by the route (buffer routes only). */
export const cushionAfter = (route: RankedPlan): number => {
  if (route.strategyKey !== 'buffer') return 0;
  return route.actions
    .filter((action) => action.type === 'buffer_reserve')
    .reduce((sum, action) => sum + (action.amount ?? 0), 0);
};
