import { describe, expect, it } from 'vitest';
import {
  buildMonthKeyRange,
  clampCustomChartRangeToAvailable,
  defaultCustomChartRange,
  parseStoredCustomChartRange,
  resolveDebtPayoffMonthKey,
  resolveLiquidityChartRange,
  resolveLiquidityFetchWindow,
  shiftMonthKey,
} from '@/lib/finance/liquidity-chart-range';

describe('resolveLiquidityChartRange', () => {
  const today = '2026-08-22';

  it('looks 3, 6 and 12 months ahead starting this month', () => {
    expect(resolveLiquidityChartRange('next_3', today).monthKeys).toEqual(
      buildMonthKeyRange('2026-08', '2026-10'),
    );
    expect(resolveLiquidityChartRange('next_6', today).toMonthKey).toBe('2027-01');
    const year = resolveLiquidityChartRange('next_12', today);
    expect(year.fromMonthKey).toBe('2026-08');
    expect(year.toMonthKey).toBe('2027-07');
    expect(year.monthKeys).toHaveLength(12);
  });

  it('runs "Hasta liquidar" through the last scheduled payment', () => {
    const bounds = resolveLiquidityChartRange('payoff', today, null, '2027-03');
    expect(bounds.fromMonthKey).toBe('2026-08');
    expect(bounds.toMonthKey).toBe('2027-03');
  });

  it('keeps at least three months when the payoff is imminent', () => {
    const bounds = resolveLiquidityChartRange('payoff', today, null, '2026-08');
    expect(bounds.toMonthKey).toBe('2026-10');
  });

  it('shows six months when there is no debt left', () => {
    const bounds = resolveLiquidityChartRange('payoff', today, null, null);
    expect(bounds.toMonthKey).toBe('2027-01');
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

describe('resolveDebtPayoffMonthKey', () => {
  it('returns the last month with a payment due', () => {
    expect(
      resolveDebtPayoffMonthKey([
        { monthKey: '2026-08', paymentsDue: 500 },
        { monthKey: '2026-12', paymentsDue: 120 },
        { monthKey: '2027-01', paymentsDue: 0 },
      ]),
    ).toBe('2026-12');
  });

  it('returns null when nothing is due', () => {
    expect(resolveDebtPayoffMonthKey([{ monthKey: '2026-08', paymentsDue: 0 }])).toBeNull();
  });
});

describe('resolveLiquidityFetchWindow', () => {
  it('covers January through June of next year early in the year', () => {
    expect(resolveLiquidityFetchWindow('2026-03-10')).toEqual({
      fromMonthKey: '2026-01',
      toMonthKey: '2027-06',
    });
  });

  it('extends past June so the 1A preset is fully covered', () => {
    expect(resolveLiquidityFetchWindow('2026-09-27')).toEqual({
      fromMonthKey: '2026-01',
      toMonthKey: '2027-08',
    });
  });
});

describe('shiftMonthKey', () => {
  it('moves across year boundaries', () => {
    expect(shiftMonthKey('2026-01', -1)).toBe('2025-12');
    expect(shiftMonthKey('2026-11', 3)).toBe('2027-02');
  });
});
