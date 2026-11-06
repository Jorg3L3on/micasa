import { describe, expect, it } from 'vitest';
import {
  buildWalletPeriodAnalytics,
  estimateWalletRunwayDays,
  MIN_ELAPSED_DAYS_FOR_RUNWAY,
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
  });

  const june = { from: '2026-06-01', to: '2026-06-30' };

  it('spreads outflow over every elapsed day of a past period', () => {
    const analytics = buildWalletPeriodAnalytics(
      [movement({ amount: 300 })],
      june,
      '2026-11-05',
    );

    expect(analytics.elapsedDays).toBe(30);
    expect(analytics.averageDailyOutflow).toBe(10);
    expect(analytics.projectedMonthlyOutflow).toBe(300);
  });

  it('counts only the days so far in the current period', () => {
    const analytics = buildWalletPeriodAnalytics(
      [movement({ amount: 300 })],
      june,
      '2026-06-10',
    );

    expect(analytics.elapsedDays).toBe(10);
    expect(analytics.averageDailyOutflow).toBe(30);
  });

  it('does not count inactive days out of the rate', () => {
    const analytics = buildWalletPeriodAnalytics(
      [movement({ amount: 5000 })],
      june,
      '2026-06-20',
    );

    expect(analytics.activeDays).toBe(1);
    expect(analytics.averageDailyOutflow).toBe(250);
  });

  it('has no rate for a period that has not started', () => {
    const analytics = buildWalletPeriodAnalytics([], june, '2026-05-20');

    expect(analytics.elapsedDays).toBe(0);
    expect(analytics.averageDailyOutflow).toBe(0);
  });
});

describe('wallet period utility calculations', () => {
  it('estimates runway days from average outflow', () => {
    const current = { elapsedDays: 10, isCurrentPeriod: true };

    expect(
      estimateWalletRunwayDays({ ...current, balance: 1000, averageDailyOutflow: 125 }),
    ).toBe(8);
    expect(
      estimateWalletRunwayDays({ ...current, balance: 1000, averageDailyOutflow: 0 }),
    ).toBeNull();
    expect(
      estimateWalletRunwayDays({ ...current, balance: -10, averageDailyOutflow: 125 }),
    ).toBe(0);
  });

  it('keeps one large payment from reading as a day of coverage', () => {
    const { averageDailyOutflow, elapsedDays } = buildWalletPeriodAnalytics(
      [movement({ amount: 5000 })],
      { from: '2026-06-01', to: '2026-06-30' },
      '2026-06-20',
    );

    expect(
      estimateWalletRunwayDays({
        balance: 6000,
        averageDailyOutflow,
        elapsedDays,
        isCurrentPeriod: true,
      }),
    ).toBe(24);
  });

  it('gives no estimate before the minimum days', () => {
    const base = { balance: 1000, averageDailyOutflow: 125, isCurrentPeriod: true };

    expect(
      estimateWalletRunwayDays({
        ...base,
        elapsedDays: MIN_ELAPSED_DAYS_FOR_RUNWAY - 1,
      }),
    ).toBeNull();
    expect(
      estimateWalletRunwayDays({ ...base, elapsedDays: MIN_ELAPSED_DAYS_FOR_RUNWAY }),
    ).toBe(8);
  });

  it('gives no estimate for a past period', () => {
    expect(
      estimateWalletRunwayDays({
        balance: 1000,
        averageDailyOutflow: 125,
        elapsedDays: 30,
        isCurrentPeriod: false,
      }),
    ).toBeNull();
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
