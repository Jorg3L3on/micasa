import { describe, expect, it } from 'vitest';
import {
  buildMonthKeyRange,
  resolveLiquidityChartRange,
  shiftMonthKey,
} from '@/lib/finance/liquidity-chart-range';

describe('resolveLiquidityChartRange', () => {
  const today = '2026-08-22';

  it('builds year-to-date through the current month', () => {
    const bounds = resolveLiquidityChartRange('ytd', today);
    expect(bounds.fromMonthKey).toBe('2026-01');
    expect(bounds.toMonthKey).toBe('2026-08');
    expect(bounds.monthKeys).toEqual(buildMonthKeyRange('2026-01', '2026-08'));
  });

  it('centers ±3 months around the current month', () => {
    const bounds = resolveLiquidityChartRange('plus_minus_3', today);
    expect(bounds.fromMonthKey).toBe('2026-05');
    expect(bounds.toMonthKey).toBe('2026-11');
    expect(bounds.monthKeys).toHaveLength(7);
    expect(bounds.monthKeys[3]).toBe('2026-08');
  });

  it('spans the full calendar year', () => {
    const bounds = resolveLiquidityChartRange('calendar_year', today);
    expect(bounds.fromMonthKey).toBe('2026-01');
    expect(bounds.toMonthKey).toBe('2026-12');
  });

  it('spans January through June of the next year', () => {
    const bounds = resolveLiquidityChartRange('year_and_half', today);
    expect(bounds.fromMonthKey).toBe('2026-01');
    expect(bounds.toMonthKey).toBe('2027-06');
  });
});

describe('shiftMonthKey', () => {
  it('moves across year boundaries', () => {
    expect(shiftMonthKey('2026-01', -1)).toBe('2025-12');
    expect(shiftMonthKey('2026-11', 3)).toBe('2027-02');
  });
});
