import { describe, expect, it } from 'vitest';
import {
  buildMonthKeyRange,
  clampCustomChartRangeToAvailable,
  defaultCustomChartRange,
  parseStoredCustomChartRange,
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

  it('uses a custom from/to window and swaps inverted bounds', () => {
    const bounds = resolveLiquidityChartRange('custom', today, {
      fromMonthKey: '2026-09',
      toMonthKey: '2026-07',
    });
    expect(bounds.fromMonthKey).toBe('2026-07');
    expect(bounds.toMonthKey).toBe('2026-09');
    expect(bounds.monthKeys).toEqual(['2026-07', '2026-08', '2026-09']);
  });

  it('falls back to the current month plus two when custom has no bounds', () => {
    const bounds = resolveLiquidityChartRange('custom', today);
    expect(bounds.fromMonthKey).toBe('2026-08');
    expect(bounds.toMonthKey).toBe('2026-10');
  });
});

describe('custom chart range helpers', () => {
  it('parses stored JSON and rejects invalid payloads', () => {
    expect(parseStoredCustomChartRange('{"from":"2026-07","to":"2026-09"}')).toEqual({
      fromMonthKey: '2026-07',
      toMonthKey: '2026-09',
    });
    expect(parseStoredCustomChartRange('{')).toBeNull();
    expect(parseStoredCustomChartRange('{"from":"julio","to":"2026-09"}')).toBeNull();
  });

  it('defaults to the current month through two months ahead when available', () => {
    const available = ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
    expect(defaultCustomChartRange('2026-08-22', available)).toEqual({
      fromMonthKey: '2026-08',
      toMonthKey: '2026-10',
    });
  });

  it('clamps a stored range to months the projection actually has', () => {
    const clamped = clampCustomChartRangeToAvailable(
      { fromMonthKey: '2025-01', toMonthKey: '2028-12' },
      ['2026-07', '2026-08', '2026-09'],
    );
    expect(clamped).toEqual({ fromMonthKey: '2026-07', toMonthKey: '2026-09' });
  });
});

describe('shiftMonthKey', () => {
  it('moves across year boundaries', () => {
    expect(shiftMonthKey('2026-01', -1)).toBe('2025-12');
    expect(shiftMonthKey('2026-11', 3)).toBe('2027-02');
  });
});
