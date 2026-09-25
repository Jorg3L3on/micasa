export const CASH_PLAN_ENGINE_VERSION = 'cash-plan-1';

/** Used when APR/CAT is missing and the policy is `assume_median`. */
export const ASSUMED_MEDIAN_APR = 0.36;

/** Used when APR/CAT is missing and the policy is `assume_high`. */
export const ASSUMED_HIGH_APR = 0.72;

export type PlanHorizon = 'quincena' | 'mes';

export type PlanMode = 'shortfall' | 'surplus' | 'balanced';

export type PlanConfidence = 'high' | 'medium' | 'low';

export type MissingAprPolicy = 'assume_high' | 'assume_median' | 'exclude_from_apr_rank';

export type ObligationKind = 'card_revolving' | 'card_msi' | 'loan' | 'bill';

export type ConsequenceTier = 1 | 2 | 3;

/**
 * `balanceTotal`, `statementDue`, and `msiInstallment` are different numbers.
 * MSI period cash is the installment, never the remaining plan balance.
 */
export type Obligation = {
  id: string;
  kind: ObligationKind;
  labelSynthetic: string;
  balanceTotal?: number;
  statementDue?: number;
  /** Null when the issuer minimum is unknown. Never copied from the statement payoff. */
  minimumDue?: number | null;
  msiInstallment?: number;
  aprAnnual?: number | null;
  catAnnual?: number | null;
  dueInHorizon: boolean;
  consequenceTier: ConsequenceTier;
  creditLimit?: number;
  /** Bill the household can move without touching housing, utilities, or payroll. */
  discretionary?: boolean;
};

export type BridgeSimInput = {
  aprAnnual: number;
  termMonths: number;
  feePct: number;
  /** Face amount. Defaults to the shortfall when omitted. */
  amount?: number;
};

export type ConsolidateSimInput = {
  aprAnnual: number;
  termMonths: number;
  feePct: number;
};

export type PlanInput = {
  horizon: PlanHorizon;
  /** Positive = shortfall, negative = surplus, near zero = balanced. */
  gapAmount: number;
  availableCash: number;
  obligations: Obligation[];
  untouchableIds?: string[];
  prefs?: {
    surplusStrategyDefault?: 'avalanche';
    allowBridgeSim?: boolean;
    allowConsolidateSim?: boolean;
    missingAprPolicy?: MissingAprPolicy;
  };
  bridgeSim?: BridgeSimInput | null;
  consolidateSim?: ConsolidateSimInput | null;
  /** Caller-supplied so the same input stays deterministic. */
  computedAt?: string;
  dataGaps?: DataGap[];
};

export type ActionTypeId =
  | 'pay_minimum'
  | 'pay_statement'
  | 'pay_msi_installment'
  | 'pay_off'
  | 'defer_nonessential'
  | 'split_hybrid'
  | 'bridge_loan'
  | 'consolidate'
  | 'extra_to_debt_avalanche'
  | 'extra_to_debt_snowball'
  | 'buffer_reserve';

export type RiskTag =
  | 'late_fee'
  | 'credit_report_30d'
  | 'interest_accrual'
  | 'liquidity_drain'
  | 'new_debt'
  | 'approval_uncertain'
  | 'msi_break'
  | 'untouchable_conflict';

export type ActionInstance = {
  type: ActionTypeId;
  obligationId?: string;
  label: string;
  detail?: string;
  /** Pesos. */
  amount?: number;
  riskTags: RiskTag[];
  warnings: string[];
  touchesUntouchable?: boolean;
};

export type ScoreVector = {
  /** 0–1. Shortfall: share of the hole closed. Surplus: share of extra assigned. */
  gapClosed: number;
  /** Expected interest + fees in pesos. Lower is better. */
  cost: number;
  /** 0–1. Lower is better. */
  risk: number;
  /** Periods of cash cushion after the plan. */
  liquidityRunway: number;
  /** 0–1. Higher keeps more unused credit line. */
  creditLimitPreservation: number;
  /** Higher is better. Weights live in `score.ts`. */
  composite: number;
};

export type PlanImpact = {
  monthsDelta: number;
  interestDelta: number;
};

export type PlanStrategyKey =
  | 'avalanche'
  | 'snowball'
  | 'buffer'
  | 'bridge'
  | 'consolidate'
  | 'minimums'
  | 'payoff'
  | 'defer'
  | 'other';

export type RankedPlan = {
  id: string;
  strategyKey: PlanStrategyKey;
  title: string;
  summary: string;
  actions: ActionInstance[];
  scores: ScoreVector;
  estimatedCost: number;
  estimatedRiskTags: RiskTag[];
  gapClosed?: number;
  surplusAllocated?: number;
  impact?: PlanImpact;
  warnings: string[];
  touchesUntouchable: boolean;
};

export type DataGapCode =
  | 'missing_apr'
  | 'missing_minimum'
  | 'income_monthly_only'
  | 'undated_obligation'
  | 'missing_statement';

export type DataGap = {
  code: DataGapCode;
  obligationId?: string;
  message: string;
};

export type ExplainTrace = {
  assumptions: string[];
  untouchableLabels: string[];
  scoreSummary: string;
};

export type PlanResult = {
  mode: PlanMode;
  primary: RankedPlan;
  alternatives: RankedPlan[];
  confidence: PlanConfidence;
  dataGaps: DataGap[];
  /** Top two eligible routes are close enough that the UI should ask. */
  tie: boolean;
  tiePlanId?: string;
  explainability: ExplainTrace;
  meta: {
    horizon: PlanHorizon;
    computedAt: string;
    engineVersion: string;
    assumptions: string[];
  };
};
