import { resolveCardPeriodObligation } from '@/lib/finance/card-period-obligation';

/**
 * Separates three card figures that must not be mixed:
 * - deuda total: outstanding balance (utilization / available credit only)
 * - pago del corte: what is due this period
 * - saldo del plan: remaining MSI balance (informative; not billed now)
 *
 * Period due priority:
 * 1. Issuer statement payoff ("pago para no generar intereses"), minus payments
 *    already applied. That figure already includes this period's MSI installment
 *    and regular charges — do not add them again.
 * 2. Otherwise, regular charges of the period plus MSI installments due now.
 * 3. When neither exists, there is no period figure (not $0 from total debt). Total debt is not
 *    a fallback, and neither is the remaining plan balance.
 */

export const roundMoney = (value: number): number =>
  Math.round((Number(value) || 0) * 100) / 100;

export type MsiPlanSlice = {
  /** Mensualidad due this period. */
  installmentAmount: number;
  /**
   * Remaining plan balance. Informative only.
   * Prefer the sum of issuer-stated remaining cuotas (exact cents).
   */
  remainingBalance: number;
};

export type CardPeriodDueSource = 'statement' | 'components' | 'none' | 'missing';

export type ResolveCardPeriodDueInput = {
  /** Outstanding on the card. Never copied into `periodDue`. */
  totalDebt: number;
  /**
   * Pago para no generar intereses, when the statement states it.
   * Null when no statement payoff is known.
   */
  statementPayoff: number | null;
  paymentsApplied?: number;
  /** Regular (non-plan) charges of this period when there is no statement payoff. */
  regularCharges?: number;
  msi?: readonly MsiPlanSlice[];
  /** Debt with a due date in the period and no figure is missing, not $0. */
  dueInPeriod?: boolean;
};

export type ResolveCardPeriodDueResult = {
  totalDebt: number;
  /** Toca pagar este corte. Null when the figure is missing. */
  periodDue: number | null;
  /** Sum of plan balances. Informative; not included in `periodDue`. */
  planRemainingBalance: number;
  /** Sum of installments that belong to this period. */
  installmentDue: number;
  source: CardPeriodDueSource;
};

export const sumExactAmounts = (amounts: readonly number[]): number =>
  roundMoney(amounts.reduce((sum, amount) => sum + (Number(amount) || 0), 0));

/**
 * Remaining balance from issuer-stated cuota amounts.
 * Falls back to `mensualidad × remaining months` only when no exact schedule exists.
 */
export const resolvePlanRemainingBalance = (input: {
  scheduledAmounts?: readonly number[] | null;
  monthlyAmount?: number;
  remainingCount?: number;
}): number => {
  if (input.scheduledAmounts != null && input.scheduledAmounts.length > 0) {
    return sumExactAmounts(input.scheduledAmounts);
  }
  const count = Math.max(0, Math.trunc(input.remainingCount ?? 0));
  return roundMoney((Number(input.monthlyAmount) || 0) * count);
};

/**
 * Unpaid cuota amounts. When the issuer remaining balance is not exactly
 * `mensualidad × cuotas`, the last unpaid cuota absorbs the cents.
 * Earlier unpaid cuotas stay at the stated installment.
 */
export const allocateUnpaidInstallmentAmounts = (input: {
  installmentAmount: number;
  unpaidCount: number;
  issuerRemainingBalance?: number | null;
}): number[] => {
  const count = Math.max(0, Math.trunc(input.unpaidCount));
  if (count === 0) return [];

  const monthly = roundMoney(input.installmentAmount);
  const equal = Array.from({ length: count }, () => monthly);
  const issuer = input.issuerRemainingBalance;
  if (issuer == null || !Number.isFinite(issuer)) return equal;

  const target = roundMoney(issuer);
  const naive = roundMoney(monthly * count);
  if (target === naive) return equal;
  if (count === 1) return target > 0 ? [target] : equal;

  const headSum = roundMoney(monthly * (count - 1));
  const last = roundMoney(target - headSum);
  if (last <= 0) return equal;
  return [...equal.slice(0, -1), last];
};

export const issuerRemainingFitsSchedule = (input: {
  installmentAmount: number;
  unpaidCount: number;
  issuerRemainingBalance: number;
}): boolean => {
  const amounts = allocateUnpaidInstallmentAmounts(input);
  return (
    amounts.every((amount) => amount > 0) &&
    sumExactAmounts(amounts) === roundMoney(input.issuerRemainingBalance)
  );
};

export const resolveCardPeriodDue = (
  input: ResolveCardPeriodDueInput,
): ResolveCardPeriodDueResult => {
  const plans = input.msi ?? [];
  const planRemainingBalance = sumExactAmounts(
    plans.map((plan) => Math.max(0, plan.remainingBalance)),
  );
  const installmentDue = sumExactAmounts(
    plans.map((plan) => Math.max(0, plan.installmentAmount)),
  );
  const totalDebt = roundMoney(Math.max(0, input.totalDebt));
  const paymentsApplied = roundMoney(Math.max(0, input.paymentsApplied ?? 0));
  const obligation = resolveCardPeriodObligation({
    outstandingBalance: totalDebt,
    dueInPeriod: input.dueInPeriod ?? true,
    statementPayoff: input.statementPayoff,
    msiInstallmentDue: installmentDue,
    scheduledAmount: input.regularCharges ?? null,
    paymentsApplied,
  });

  if (obligation.confidence === 'missing') {
    return {
      totalDebt,
      periodDue: null,
      planRemainingBalance,
      installmentDue,
      source: 'missing',
    };
  }

  const periodDue = obligation.amount ?? 0;
  const source: CardPeriodDueSource =
    obligation.basis === 'statement_no_interest'
      ? 'statement'
      : obligation.basis === 'msi_installments'
        ? 'components'
        : 'none';

  return {
    totalDebt,
    periodDue,
    planRemainingBalance,
    installmentDue,
    source,
  };
};

/**
 * Aggregated card payment + MSI installment on the same due, counted once.
 * Remaining plan balance is not an input.
 *
 * When the aggregated figure already embeds the installment (statement payoff
 * or ledger), the revolving leftover is `aggregated − installment`.
 * A scheduled-calendar row is separate and is not reduced by the installment.
 */
export const splitAggregatedDueAndInstallment = (input: {
  aggregatedDue: number;
  installmentDue: number;
  aggregatedExcludesInstallment?: boolean;
}): {
  periodDue: number;
  revolvingLeftover: number;
  installmentDue: number;
} => {
  const installmentDue = roundMoney(Math.max(0, input.installmentDue));
  const aggregated = roundMoney(Math.max(0, input.aggregatedDue));

  if (input.aggregatedExcludesInstallment) {
    return {
      revolvingLeftover: aggregated,
      installmentDue,
      periodDue: roundMoney(aggregated + installmentDue),
    };
  }

  const revolvingLeftover = roundMoney(Math.max(0, aggregated - installmentDue));
  return {
    revolvingLeftover,
    installmentDue,
    periodDue: roundMoney(revolvingLeftover + installmentDue),
  };
};
