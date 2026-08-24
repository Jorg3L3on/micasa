import { compareUtcDateOnly } from '@/lib/finance/liquidity-projection';
import type { LiquidityProjectionResult } from '@/lib/finance/liquidity-projection.service';

export type McpLiquidityGap = {
  date: string;
  shortfall: number;
  cumulative_due: number;
} | null;

export type McpLiquidityPayload = {
  as_of: string;
  until: string;
  funding_total: number;
  committed_obligations_total: number;
  net_liquidity: number;
  lasts_until: string | null;
  lasts_until_including_income: string | null;
  next_gap: McpLiquidityGap;
};

const isOnOrAfterAsOf = (dueDate: string, asOfYmd: string): boolean =>
  compareUtcDateOnly(dueDate, asOfYmd) >= 0;

const futureShortfallDate = (
  date: string | null | undefined,
  asOfYmd: string,
): string | null => {
  if (date == null) return null;
  return isOnOrAfterAsOf(date, asOfYmd) ? date : null;
};

/**
 * Maps getLiquidityProjection() to MCP fields aligned with the Liquidez page:
 * - Obligations counted from as_of forward (not past-due stacking).
 * - lasts_until / next_gap only on future milestone dates.
 */
export function buildMcpLiquidityPayload(
  projection: LiquidityProjectionResult,
  asOfYmd: string,
  untilYmd: string,
): McpLiquidityPayload {
  const futureMilestones = projection.milestones.filter((milestone) =>
    isOnOrAfterAsOf(milestone.due_date, asOfYmd),
  );

  const committedFromAsOf = futureMilestones.reduce(
    (sum, milestone) => sum + milestone.total_due,
    0,
  );

  const fundingTotal = projection.summary.funding_total;
  const netLiquidity = fundingTotal - committedFromAsOf;

  const nextGapMilestone = futureMilestones.find(
    (milestone) => milestone.liquidity_headroom < 0,
  );

  return {
    as_of: asOfYmd,
    until: untilYmd,
    funding_total: fundingTotal,
    committed_obligations_total: committedFromAsOf,
    net_liquidity: netLiquidity,
    lasts_until: nextGapMilestone?.due_date ?? null,
    lasts_until_including_income: futureShortfallDate(
      projection.summary.first_projected_shortfall_date,
      asOfYmd,
    ),
    next_gap: nextGapMilestone
      ? {
          date: nextGapMilestone.due_date,
          shortfall: Math.abs(nextGapMilestone.liquidity_headroom),
          cumulative_due: nextGapMilestone.cumulative_due_through_date,
        }
      : null,
  };
}
