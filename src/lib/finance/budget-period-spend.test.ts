import { describe, expect, it, vi } from 'vitest';
import { endOfCalendarDay, startOfCalendarDay } from '@/lib/calendar-dates';
import {
  buildBudgetSpendExpenseWhere,
  computeEffectiveAllocated,
  computePeriodSpendByAllocations,
  computePeriodSpendsByAllocations,
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

  it('omits wallet_id when the allocation is Cualquier cartera', () => {
    const where = buildBudgetSpendExpenseWhere(
      ownerFilter,
      { wallet_id: null, category_id: 7 },
      window,
    );

    expect(where.wallet_id).toBeUndefined();
    expect(where.category_id).toBe(7);
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

  it('counts Despensa from another wallet when the allocation has no wallet', async () => {
    const groupBy = vi.fn().mockResolvedValue([
      { wallet_id: 1, category_id: 10, _sum: { amount: 40 } },
      { wallet_id: 2, category_id: 10, _sum: { amount: 25 } },
      { wallet_id: 9, category_id: 20, _sum: { amount: 999 } },
    ]);
    const db = { expense: { groupBy } } as unknown as Parameters<
      typeof computePeriodSpendByAllocations
    >[0];

    const result = await computePeriodSpendByAllocations(
      db,
      [{ wallet_id: null, category_id: 10, amount: 500 }],
      window,
      ownerFilter,
    );

    expect(result.total_spent).toBe(65);
    expect(result.by_allocation).toEqual([{ spent_amount: 65 }]);
    expect(groupBy.mock.calls[0][0].where.wallet_id).toBeUndefined();
    expect(groupBy.mock.calls[0][0].where.category_id).toEqual({ in: [10] });
  });

  it('keeps a specific wallet from counting Despensa paid on another wallet', async () => {
    const groupBy = vi.fn().mockResolvedValue([
      { wallet_id: 1, category_id: 10, _sum: { amount: 40 } },
      { wallet_id: 2, category_id: 10, _sum: { amount: 25 } },
    ]);
    const db = { expense: { groupBy } } as unknown as Parameters<
      typeof computePeriodSpendByAllocations
    >[0];

    const result = await computePeriodSpendByAllocations(
      db,
      [{ wallet_id: 1, category_id: 10, amount: 500 }],
      window,
      ownerFilter,
    );

    expect(result.total_spent).toBe(40);
    expect(result.by_allocation).toEqual([{ spent_amount: 40 }]);
    expect(groupBy.mock.calls[0][0].where.wallet_id).toEqual({ in: [1] });
  });
});

describe('computePeriodSpendsByAllocations', () => {
  const first = {
    start_date: startOfCalendarDay('2026-05-31'),
    end_date: endOfCalendarDay('2026-06-14'),
  };
  const second = {
    start_date: startOfCalendarDay('2026-06-15'),
    end_date: endOfCalendarDay('2026-06-29'),
  };
  // Grouped by wallet, category and payment date over both windows.
  const rows = [
    { wallet_id: 1, category_id: 10, payment_date: startOfCalendarDay('2026-06-02'), _sum: { amount: 50 } },
    { wallet_id: 1, category_id: 11, payment_date: startOfCalendarDay('2026-06-03'), _sum: { amount: 70 } },
    { wallet_id: 1, category_id: 10, payment_date: startOfCalendarDay('2026-06-20'), _sum: { amount: 30 } },
    { wallet_id: 2, category_id: 10, payment_date: startOfCalendarDay('2026-06-21'), _sum: { amount: 25 } },
    { wallet_id: 2, category_id: 20, payment_date: startOfCalendarDay('2026-06-05'), _sum: { amount: 999 } },
  ];

  it('splits one grouped query per window and matches the per-period results', async () => {
    const groupBy = vi.fn().mockResolvedValue(rows);
    const findMany = vi.fn().mockResolvedValue([{ id: 11, parent_id: 10 }]);
    const db = { expense: { groupBy }, category: { findMany } } as unknown as Parameters<
      typeof computePeriodSpendsByAllocations
    >[0];

    const parent = [{ wallet_id: 1, category_id: 10, amount: 500 }];
    const anyWallet = [{ wallet_id: null, category_id: 10, amount: 300 }];
    const results = await computePeriodSpendsByAllocations(
      db,
      [
        { allocations: parent, window: first },
        { allocations: [], window: first },
        { allocations: parent, window: second },
        { allocations: anyWallet, window: second },
      ],
      ownerFilter,
    );

    expect(results).toEqual([
      { total_spent: 120, by_allocation: [{ spent_amount: 120 }] },
      { total_spent: 0, by_allocation: [] },
      { total_spent: 30, by_allocation: [{ spent_amount: 30 }] },
      { total_spent: 55, by_allocation: [{ spent_amount: 55 }] },
    ]);
    expect(groupBy).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(groupBy.mock.calls[0][0]).toMatchObject({
      by: ['wallet_id', 'category_id', 'payment_date'],
      where: {
        user_id: 1,
        is_paid: true,
        category_id: { in: [10, 11] },
        payment_date: { gte: first.start_date, lte: second.end_date },
      },
    });
    expect(groupBy.mock.calls[0][0].where.wallet_id).toBeUndefined();

    // Same answers as the per-period function on that window's rows.
    const perPeriod = async (allocations: typeof parent | typeof anyWallet, window: typeof first) => {
      const inWindow = rows
        .filter((r) => r.payment_date >= window.start_date && r.payment_date <= window.end_date)
        .reduce<Map<string, { wallet_id: number; category_id: number; _sum: { amount: number } }>>((map, r) => {
          const key = `${r.wallet_id}|${r.category_id}`;
          const prev = map.get(key);
          map.set(key, { wallet_id: r.wallet_id, category_id: r.category_id, _sum: { amount: (prev?._sum.amount ?? 0) + r._sum.amount } });
          return map;
        }, new Map());
      const single = {
        expense: { groupBy: vi.fn().mockResolvedValue([...inWindow.values()]) },
        category: { findMany: vi.fn().mockResolvedValue([{ id: 11, parent_id: 10 }]) },
      } as unknown as Parameters<typeof computePeriodSpendByAllocations>[0];
      return computePeriodSpendByAllocations(single, allocations, window, ownerFilter);
    };
    expect(results[0]).toEqual(await perPeriod(parent, first));
    expect(results[2]).toEqual(await perPeriod(parent, second));
    expect(results[3]).toEqual(await perPeriod(anyWallet, second));
  });

  it('does not query when no request has allocations', async () => {
    const groupBy = vi.fn();
    const db = { expense: { groupBy } } as unknown as Parameters<
      typeof computePeriodSpendsByAllocations
    >[0];
    const results = await computePeriodSpendsByAllocations(
      db,
      [{ allocations: [], window: first }],
      ownerFilter,
    );
    expect(results).toEqual([{ total_spent: 0, by_allocation: [] }]);
    expect(groupBy).not.toHaveBeenCalled();
  });
});

