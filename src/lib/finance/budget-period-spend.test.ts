import { describe, expect, it, vi } from 'vitest';
import { endOfCalendarDay, startOfCalendarDay } from '@/lib/calendar-dates';
import {
  buildBudgetSpendExpenseWhere,
  computeEffectiveAllocated,
  computePeriodSpendByAllocations,
  daysInclusiveWallClock,
  getOverlapRatio,
  getPeriodOverlap,
} from './budget-period-spend';

const ownerFilter = { user_id: 1, house_id: null } as const;

describe('budget-period-spend helpers', () => {
  const period = {
    start_date: startOfCalendarDay('2026-06-01'),
    end_date: endOfCalendarDay('2026-06-07'),
  };

  it('counts inclusive wall-clock days', () => {
    expect(daysInclusiveWallClock(period.start_date, period.end_date)).toBe(7);
  });

  it('computes overlap with a fortnight scope', () => {
    const scope = {
      start_date: startOfCalendarDay('2026-06-01'),
      end_date: endOfCalendarDay('2026-06-15'),
    };
    const overlap = getPeriodOverlap(period, scope);
    expect(overlap).toEqual(period);
    expect(getOverlapRatio(period, overlap!)).toBe(1);
    expect(computeEffectiveAllocated(700, period, overlap!)).toBe(700);
  });

  it('pro-rates when only part of the period overlaps', () => {
    const scope = {
      start_date: startOfCalendarDay('2026-06-05'),
      end_date: endOfCalendarDay('2026-06-15'),
    };
    const overlap = getPeriodOverlap(period, scope)!;
    expect(daysInclusiveWallClock(overlap.start_date, overlap.end_date)).toBe(3);
    expect(computeEffectiveAllocated(700, period, overlap)).toBe(300);
  });
});

describe('buildBudgetSpendExpenseWhere', () => {
  const window = {
    start_date: startOfCalendarDay('2026-06-01'),
    end_date: endOfCalendarDay('2026-06-15'),
  };

  it('scopes to owner, paid expenses, wallet+category, and excludes installments', () => {
    const where = buildBudgetSpendExpenseWhere(
      ownerFilter,
      { wallet_id: 3, category_id: 7 },
      window,
    );

    expect(where).toMatchObject({
      user_id: 1,
      house_id: null,
      is_paid: true,
      wallet_id: 3,
      category_id: 7,
      payment_date: { gte: window.start_date, lte: window.end_date },
    });
    expect(where.OR).toEqual([
      { credit_installment_current: null },
      { credit_installment_total: null },
    ]);
  });
});

describe('computePeriodSpendByAllocations', () => {
  const window = {
    start_date: startOfCalendarDay('2026-06-01'),
    end_date: endOfCalendarDay('2026-06-15'),
  };

  it('runs one grouped query with owner-scoped paid-only filters and maps sums per allocation pair', async () => {
    const groupBy = vi.fn().mockResolvedValue([
      { wallet_id: 1, category_id: 10, _sum: { amount: 120 } },
      { wallet_id: 2, category_id: 20, _sum: { amount: 120 } },
      // Cross-product combo not present in the allocations; must be ignored.
      { wallet_id: 1, category_id: 20, _sum: { amount: 999 } },
    ]);
    const db = { expense: { groupBy } } as unknown as Parameters<
      typeof computePeriodSpendByAllocations
    >[0];

    const result = await computePeriodSpendByAllocations(
      db,
      [
        { wallet_id: 1, category_id: 10, amount: 500 },
        { wallet_id: 2, category_id: 20, amount: 300 },
      ],
      window,
      ownerFilter,
    );

    expect(result.total_spent).toBe(240);
    expect(result.by_allocation).toEqual([{ spent_amount: 120 }, { spent_amount: 120 }]);
    expect(groupBy).toHaveBeenCalledTimes(1);
    expect(groupBy.mock.calls[0][0]).toMatchObject({
      by: ['wallet_id', 'category_id'],
      where: {
        user_id: 1,
        is_paid: true,
        wallet_id: { in: [1, 2] },
        category_id: { in: [10, 20] },
        payment_date: { gte: window.start_date, lte: window.end_date },
        OR: [
          { credit_installment_current: null },
          { credit_installment_total: null },
        ],
      },
    });
  });

  it('returns zeros without querying when there are no allocations', async () => {
    const groupBy = vi.fn();
    const db = { expense: { groupBy } } as unknown as Parameters<
      typeof computePeriodSpendByAllocations
    >[0];

    const result = await computePeriodSpendByAllocations(
      db,
      [],
      window,
      ownerFilter,
    );

    expect(result).toEqual({ total_spent: 0, by_allocation: [] });
    expect(groupBy).not.toHaveBeenCalled();
  });

  it('rolls up child category spend into a parent allocation', async () => {
    const groupBy = vi.fn().mockResolvedValue([
      { wallet_id: 1, category_id: 10, _sum: { amount: 50 } },
      { wallet_id: 1, category_id: 11, _sum: { amount: 70 } },
    ]);
    const findMany = vi.fn().mockResolvedValue([
      { id: 11, parent_id: 10 },
    ]);
    const db = {
      expense: { groupBy },
      category: { findMany },
    } as unknown as Parameters<typeof computePeriodSpendByAllocations>[0];

    const result = await computePeriodSpendByAllocations(
      db,
      [{ wallet_id: 1, category_id: 10, amount: 500 }],
      window,
      ownerFilter,
    );

    expect(result.total_spent).toBe(120);
    expect(result.by_allocation).toEqual([{ spent_amount: 120 }]);
    expect(groupBy.mock.calls[0][0].where.category_id).toEqual({
      in: [10, 11],
    });
  });
});
