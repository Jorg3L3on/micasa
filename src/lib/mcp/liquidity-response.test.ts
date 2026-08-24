import { describe, expect, it } from 'vitest';
import { buildMcpLiquidityPayload } from '@/lib/mcp/liquidity-response';
import type { LiquidityProjectionResult } from '@/lib/finance/liquidity-projection.service';

const baseProjection = (
  overrides: Partial<LiquidityProjectionResult> = {},
): LiquidityProjectionResult => ({
  as_of: '2026-06-01',
  until: '2026-08-01',
  funding_wallets: [{ id: 1, name: 'Efectivo', type: 'CASH', balance: 5000 }],
  milestones: [],
  summary: {
    total_obligations_due_on_or_before_until: 0,
    funding_total: 5000,
    expected_income_total_on_or_before_until: 0,
    net_liquidity_versus_obligations: 5000,
    shortfall_versus_funding: 0,
    first_cumulative_shortfall_date: null,
    net_liquidity_versus_obligations_including_income: 5000,
    shortfall_versus_funding_and_income: 0,
    first_projected_shortfall_date: null,
  },
  assumptions: [],
  options: {
    stress_cycle_percent: 0,
    include_unpaid_expenses: true,
    include_expense_templates: false,
  },
  monthly_series: [],
  projection_events: [],
  projection_tracks: [],
  card_utilization_summary: {
    cards: [],
    dangerous_count: 0,
    unrated_count: 0,
  },
  ...overrides,
});

describe('buildMcpLiquidityPayload', () => {
  it('ignores past shortfall dates and counts obligations from as_of forward', () => {
    const projection = baseProjection({
      milestones: [
        {
          due_date: '2026-05-15',
          is_past_due: true,
          obligations: [],
          total_due: 8000,
          cumulative_due_through_date: 8000,
          funding_total: 5000,
          liquidity_headroom: -3000,
        },
        {
          due_date: '2026-07-01',
          is_past_due: false,
          obligations: [],
          total_due: 1200,
          cumulative_due_through_date: 9200,
          funding_total: 5000,
          liquidity_headroom: -4200,
        },
      ],
      summary: {
        total_obligations_due_on_or_before_until: 9200,
        funding_total: 5000,
        expected_income_total_on_or_before_until: 0,
        net_liquidity_versus_obligations: -4200,
        shortfall_versus_funding: 4200,
        first_cumulative_shortfall_date: '2026-05-15',
        net_liquidity_versus_obligations_including_income: -4200,
        shortfall_versus_funding_and_income: 4200,
        first_projected_shortfall_date: '2026-07-01',
      },
    });

    const payload = buildMcpLiquidityPayload(projection, '2026-06-01', '2026-08-01');

    expect(payload.committed_obligations_total).toBe(1200);
    expect(payload.net_liquidity).toBe(3800);
    expect(payload.lasts_until).toBe('2026-07-01');
    expect(payload.lasts_until_including_income).toBe('2026-07-01');
    expect(payload.next_gap?.date).toBe('2026-07-01');
  });

  it('returns null lasts_until when cash covers the forward horizon', () => {
    const projection = baseProjection({
      milestones: [
        {
          due_date: '2026-07-01',
          is_past_due: false,
          obligations: [],
          total_due: 800,
          cumulative_due_through_date: 800,
          funding_total: 5000,
          liquidity_headroom: 4200,
        },
      ],
      summary: {
        total_obligations_due_on_or_before_until: 800,
        funding_total: 5000,
        expected_income_total_on_or_before_until: 0,
        net_liquidity_versus_obligations: 4200,
        shortfall_versus_funding: 0,
        first_cumulative_shortfall_date: null,
        net_liquidity_versus_obligations_including_income: 4200,
        shortfall_versus_funding_and_income: 0,
        first_projected_shortfall_date: null,
      },
    });

    const payload = buildMcpLiquidityPayload(projection, '2026-06-01', '2026-08-01');

    expect(payload.lasts_until).toBeNull();
    expect(payload.next_gap).toBeNull();
    expect(payload.committed_obligations_total).toBe(800);
  });
});
