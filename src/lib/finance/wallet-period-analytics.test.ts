import { describe, expect, it } from 'vitest';
import {
  buildWalletPeriodAnalytics,
  estimateWalletRunwayDays,
  walletMovementNet,
} from '@/lib/finance/wallet-period-analytics';
import type { WalletMovement } from '@/types/wallet-movements';

const movement = (
  overrides: Partial<WalletMovement>,
): WalletMovement => ({
  id: 1,
  kind: 'expense',
  date: '2026-06-02',
  description: 'Despensa',
  amount: 100,
  direction: 'out',
  category: 'Despensa',
  categoryIcon: 'SHOPPING_CART',
  fortnightYear: 2026,
  fortnightMonth: 6,
  fortnightPeriod: 'FIRST',
  ...overrides,
});

describe('buildWalletPeriodAnalytics', () => {
  it('builds daily flow, movement mix, and cumulative net', () => {
    const analytics = buildWalletPeriodAnalytics(
      [
        movement({ id: 1, date: '2026-06-01', amount: 500, direction: 'in', kind: 'income', category: null }),
        movement({ id: 2, date: '2026-06-02', amount: 120 }),
        movement({ id: 3, date: '2026-06-02', amount: 80, category: 'Transporte', categoryIcon: 'CAR' }),
        movement({ id: 4, date: '2026-06-03', amount: 200, kind: 'card_payment', category: 'Pago a tarjeta', categoryIcon: 'CREDIT_CARD' }),
      ],
      { from: '2026-06-01', to: '2026-06-03' },
    );

    expect(analytics.dailyFlow).toEqual([
      {
        date: '2026-06-01',
        label: '1',
        inflow: 500,
        outflow: 0,
        net: 500,
        cumulativeNet: 500,
      },
      {
        date: '2026-06-02',
        label: '2',
        inflow: 0,
        outflow: 200,
        net: -200,
        cumulativeNet: 300,
      },
      {
        date: '2026-06-03',
        label: '3',
        inflow: 0,
        outflow: 200,
        net: -200,
        cumulativeNet: 100,
      },
    ]);
    expect(analytics.movementMix).toEqual({
      income: 500,
      expense: 200,
      cardPaymentIn: 0,
      cardPaymentOut: 200,
    });
  });

  it('sorts outflow categories and computes percentages', () => {
    const analytics = buildWalletPeriodAnalytics(
      [
        movement({ id: 1, amount: 300, category: 'Despensa' }),
        movement({ id: 2, amount: 100, category: 'Transporte', categoryIcon: 'CAR' }),
      ],
      { from: '2026-06-01', to: '2026-06-30' },
    );

    expect(analytics.categoryBreakdown.map((row) => row.category)).toEqual([
      'Despensa',
      'Transporte',
    ]);
    expect(analytics.categoryBreakdown[0].pct).toBe(75);
    expect(analytics.averageDailyOutflow).toBe(400);
    expect(analytics.projectedMonthlyOutflow).toBe(12000);
  });
});

describe('wallet period utility calculations', () => {
  it('estimates runway days from average outflow', () => {
    expect(estimateWalletRunwayDays(1000, 125)).toBe(8);
    expect(estimateWalletRunwayDays(1000, 0)).toBeNull();
    expect(estimateWalletRunwayDays(-10, 125)).toBe(0);
  });

  it('returns signed net for movements', () => {
    expect(
      walletMovementNet([
        movement({ id: 1, amount: 300, direction: 'in', kind: 'income' }),
        movement({ id: 2, amount: 125, direction: 'out', kind: 'expense' }),
      ]),
    ).toBe(175);
  });
});
