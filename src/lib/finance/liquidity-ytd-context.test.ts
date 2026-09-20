import { describe, expect, it } from 'vitest';
import { buildLiquidityYtdContext } from '@/lib/finance/liquidity-ytd-context';

describe('buildLiquidityYtdContext', () => {
  it('sums calendar-year debt payments through the current month', () => {
    const result = buildLiquidityYtdContext({
      asOfYmd: '2026-05-15',
      monthlySummary: [
        { year: 2025, month: 12, expense: 999 },
        { year: 2026, month: 1, expense: 1000 },
        { year: 2026, month: 4, expense: 2500 },
        { year: 2026, month: 5, expense: 1800 },
        { year: 2026, month: 6, expense: 500 },
      ],
      totalSpentYtd: 48000,
    });

    expect(result.currentYear).toBe(2026);
    expect(result.debtPaidYtd).toBe(5300);
    expect(result.spentYtd).toBe(48000);
    expect(result.ratioLabel).toContain('11%');
  });

  it('ignores future months within the same calendar year', () => {
    const result = buildLiquidityYtdContext({
      asOfYmd: '2026-03-10',
      monthlySummary: [
        { year: 2026, month: 2, expense: 400 },
        { year: 2026, month: 3, expense: 600 },
        { year: 2026, month: 4, expense: 9000 },
      ],
      totalSpentYtd: 12000,
    });

    expect(result.debtPaidYtd).toBe(1000);
  });

  it('returns null ratio when there is no spending or debt data', () => {
    const result = buildLiquidityYtdContext({
      asOfYmd: '2026-08-01',
      monthlySummary: [],
      totalSpentYtd: 0,
    });

    expect(result.debtPaidYtd).toBe(0);
    expect(result.spentYtd).toBe(0);
    expect(result.ratioLabel).toBeNull();
  });
});
