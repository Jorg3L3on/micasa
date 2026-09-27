import { describe, expect, it } from 'vitest';
import {
  buildLiquidityPayoffProgress,
  monthsBetween,
} from '@/components/wallets/liquidity/liquidity-payoff-progress';

const months = [
  { month_key: '2026-09', outstanding_debt_total: 100_000 },
  { month_key: '2026-10', outstanding_debt_total: 60_000 },
  { month_key: '2026-11', outstanding_debt_total: 0 },
];

describe('monthsBetween', () => {
  it('counts months across a year boundary', () => {
    expect(monthsBetween('2026-11', '2027-02')).toBe(3);
    expect(monthsBetween('2026-09', '2026-09')).toBe(0);
  });
});

describe('buildLiquidityPayoffProgress', () => {
  it('returns null without months', () => {
    expect(
      buildLiquidityPayoffProgress({
        months: [],
        currentMonthKey: '2026-09',
        selectedMonthKey: '2026-09',
        payoffMonthKey: null,
      }),
    ).toBeNull();
  });

  it('measures how much of today’s debt is paid by the selected month', () => {
    const progress = buildLiquidityPayoffProgress({
      months,
      currentMonthKey: '2026-09',
      selectedMonthKey: '2026-10',
      payoffMonthKey: '2026-11',
    });
    expect(progress).toMatchObject({
      percent: 40,
      tone: 'active',
      title: '2 meses para liquidar',
      payoffInHorizon: true,
    });
  });

  it('counts this month’s payments as progress for the current month', () => {
    const progress = buildLiquidityPayoffProgress({
      months: [
        {
          month_key: '2026-09',
          outstanding_debt_total: 80_000,
          debt_items: [
            { id: 'loan-1', kind: 'loan', title: 'Préstamo', subtitle: '', amount: 80_000, payment_amount: 20_000 },
          ],
        },
        { month_key: '2026-10', outstanding_debt_total: 0 },
      ],
      currentMonthKey: '2026-09',
      selectedMonthKey: '2026-09',
      payoffMonthKey: '2026-10',
    });
    expect(progress?.percent).toBe(20);
    expect(progress?.title).toBe('1 mes para liquidar');
  });

  it('marks the payoff month as complete', () => {
    const progress = buildLiquidityPayoffProgress({
      months,
      currentMonthKey: '2026-09',
      selectedMonthKey: '2026-11',
      payoffMonthKey: '2026-11',
    });
    expect(progress?.percent).toBe(100);
    expect(progress?.tone).toBe('complete');
  });

  it('flags a payoff beyond the projection when debt remains in the last month', () => {
    const progress = buildLiquidityPayoffProgress({
      months: [
        { month_key: '2026-09', outstanding_debt_total: 100_000 },
        { month_key: '2026-10', outstanding_debt_total: 90_000 },
      ],
      currentMonthKey: '2026-09',
      selectedMonthKey: '2026-09',
      payoffMonthKey: '2026-10',
    });
    expect(progress?.payoffInHorizon).toBe(false);
    expect(progress?.title).toBe('Más de 1 mes');
  });

  it('reports no debt when today is already clear', () => {
    const progress = buildLiquidityPayoffProgress({
      months: [{ month_key: '2026-09', outstanding_debt_total: 0 }],
      currentMonthKey: '2026-09',
      selectedMonthKey: '2026-09',
      payoffMonthKey: null,
    });
    expect(progress).toMatchObject({ title: 'Sin deudas', tone: 'complete', percent: 100 });
  });
});
