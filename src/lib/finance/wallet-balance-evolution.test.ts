import { describe, expect, it } from 'vitest';
import {
  balanceAtDate,
  buildRecentMonthAsOfDates,
  buildWalletBalanceMetrics,
  signedMovementDelta,
} from '@/lib/finance/wallet-balance-evolution';
import type { WalletMovement } from '@/types/wallet-movements';

const movement = (
  partial: Pick<WalletMovement, 'date' | 'direction' | 'amount'>,
): WalletMovement => ({
  id: 1,
  kind: 'expense',
  description: 'x',
  category: null,
  categoryIcon: null,
  fortnightYear: null,
  fortnightMonth: null,
  fortnightPeriod: null,
  ...partial,
});

describe('signedMovementDelta', () => {
  it('increases funding balance on inflow', () => {
    expect(signedMovementDelta('in', 100, false)).toBe(100);
    expect(signedMovementDelta('out', 100, false)).toBe(-100);
  });

  it('decreases credit debt on payment inflow', () => {
    expect(signedMovementDelta('in', 100, true)).toBe(-100);
    expect(signedMovementDelta('out', 100, true)).toBe(100);
  });
});

describe('balanceAtDate', () => {
  it('reconstructs funding balance before later movements', () => {
    const movements = [
      movement({ date: '2026-07-10', direction: 'in', amount: 200 }),
      movement({ date: '2026-07-15', direction: 'out', amount: 50 }),
    ];
    expect(balanceAtDate(950, movements, '2026-07-14', false)).toBe(1000);
  });

  it('reconstructs credit debt before later movements', () => {
    const movements = [
      movement({ date: '2026-07-10', direction: 'out', amount: 300 }),
      movement({ date: '2026-07-15', direction: 'in', amount: 100 }),
    ];
    expect(balanceAtDate(900, movements, '2026-07-14', true)).toBe(1000);
  });
});

describe('buildRecentMonthAsOfDates', () => {
  it('returns month ends with today as the latest point', () => {
    expect(buildRecentMonthAsOfDates(3, '2026-07-21')).toEqual([
      '2026-05-31',
      '2026-06-30',
      '2026-07-21',
    ]);
  });
});

describe('buildWalletBalanceMetrics', () => {
  it('derives diff vs previous month', () => {
    const metrics = buildWalletBalanceMetrics(
      1000,
      [movement({ date: '2026-07-05', direction: 'in', amount: 100 })],
      'CASH',
      2,
      '2026-07-21',
    );
    expect(metrics.history).toHaveLength(2);
    expect(metrics.current_balance).toBe(1000);
    expect(metrics.previous_balance).toBe(900);
    expect(metrics.diff).toBe(100);
  });
});
