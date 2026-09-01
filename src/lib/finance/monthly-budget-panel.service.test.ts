import { beforeEach, describe, expect, it, vi } from 'vitest';
import { endOfCalendarDay, startOfCalendarDay } from '@/lib/calendar-dates';
import { getMonthlyBudgetPanel } from './monthly-budget-panel.service';

const mocks = vi.hoisted(() => ({
  budgetPeriodFindMany: vi.fn(),
  fortnightCount: vi.fn(),
  computePeriodSpendByAllocations: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    budgetPeriod: {
      findMany: mocks.budgetPeriodFindMany,
    },
    fortnight: {
      count: mocks.fortnightCount,
    },
    budget: {
      count: vi.fn().mockResolvedValue(0),
    },
  },
}));

vi.mock('@/lib/finance/budget-period-spend', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./budget-period-spend')>();
  return {
    ...actual,
    computePeriodSpendByAllocations: mocks.computePeriodSpendByAllocations,
  };
});

const ownerFilter = { user_id: 1, house_id: null } as const;

function periodFixture(overrides: {
  id?: number;
  budgetId?: number;
  start: string;
  end: string;
  total?: number;
  frequency?: string;
  categoryId?: number;
  categoryName?: string;
  walletId?: number;
  walletName?: string;
}) {
  const {
    id = 1,
    budgetId = 10,
    start,
    end,
    total = 700,
    frequency = 'WEEKLY',
    categoryId = 5,
    categoryName = 'Despensa',
    walletId = 2,
    walletName = 'BBVA',
  } = overrides;

  return {
    id,
    budget_id: budgetId,
    start_date: startOfCalendarDay(start),
    end_date: endOfCalendarDay(end),
    budget: {
      id: budgetId,
      total_amount: total,
      frequency,
      allocations: [
        {
          id: 100,
          wallet_id: walletId,
          category_id: categoryId,
          amount: total,
          category: { id: categoryId, name: categoryName, icon: 'shopping-cart' },
          wallet: {
            id: walletId,
            name: walletName,
            provider_icon_key: null,
            assignee: null,
          },
        },
      ],
    },
  };
}

describe('getMonthlyBudgetPanel', () => {
  beforeEach(() => {
    mocks.budgetPeriodFindMany.mockReset();
    mocks.fortnightCount.mockReset();
    mocks.computePeriodSpendByAllocations.mockReset();
    mocks.fortnightCount.mockResolvedValue(0);
    mocks.computePeriodSpendByAllocations.mockResolvedValue({
      total_spent: 0,
      by_allocation: [{ spent_amount: 0 }],
    });
  });

  it('returns empty scopes when no periods overlap the month', async () => {
    mocks.budgetPeriodFindMany.mockResolvedValue([]);

    const panel = await getMonthlyBudgetPanel(ownerFilter, 2026, 6);

    expect(panel.first.totalBudget).toBe(0);
    expect(panel.second.totalBudget).toBe(0);
    expect(mocks.computePeriodSpendByAllocations).not.toHaveBeenCalled();
  });

  it('pro-rates a weekly period that spans a quincena boundary', async () => {
    mocks.budgetPeriodFindMany.mockResolvedValue([
      periodFixture({
        start: '2026-06-01',
        end: '2026-06-07',
        total: 700,
      }),
    ]);
    mocks.computePeriodSpendByAllocations
      .mockResolvedValueOnce({ total_spent: 200, by_allocation: [{ spent_amount: 200 }] })
      .mockResolvedValueOnce({ total_spent: 100, by_allocation: [{ spent_amount: 100 }] });

    const panel = await getMonthlyBudgetPanel(ownerFilter, 2026, 6);

    // First fortnight: full week (7/7) => 700 budgeted
    expect(panel.first.totalBudget).toBe(700);
    expect(panel.first.spent).toBe(200);
    expect(panel.first.available).toBe(500);

    // Second fortnight: no overlap with Jun 1–7 week
    expect(panel.second.totalBudget).toBe(0);
    expect(panel.second.spent).toBe(0);

    expect(mocks.computePeriodSpendByAllocations).toHaveBeenCalledTimes(1);
    expect(mocks.computePeriodSpendByAllocations).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Array),
      expect.objectContaining({
        start_date: startOfCalendarDay('2026-06-01'),
        end_date: endOfCalendarDay('2026-06-07'),
      }),
      ownerFilter,
    );
  });

  it('aggregates spend into allocations for the fortnight scope', async () => {
    mocks.budgetPeriodFindMany.mockResolvedValue([
      periodFixture({
        id: 1,
        budgetId: 10,
        start: '2026-06-01',
        end: '2026-06-15',
        total: 1000,
        categoryId: 5,
        categoryName: 'Despensa',
        walletName: 'BBVA',
      }),
      periodFixture({
        id: 2,
        budgetId: 11,
        start: '2026-06-01',
        end: '2026-06-15',
        total: 500,
        frequency: 'BIWEEKLY',
        categoryId: 8,
        categoryName: 'Transporte',
        walletId: 3,
        walletName: 'Efectivo',
      }),
    ]);
    mocks.computePeriodSpendByAllocations
      .mockResolvedValueOnce({ total_spent: 400, by_allocation: [{ spent_amount: 400 }] })
      .mockResolvedValueOnce({ total_spent: 150, by_allocation: [{ spent_amount: 150 }] });

    const panel = await getMonthlyBudgetPanel(ownerFilter, 2026, 6);

    expect(panel.first.totalBudget).toBe(1500);
    expect(panel.first.spent).toBe(550);
    expect(panel.first.allocations).toHaveLength(2);
    expect(panel.first.allocations[0]).toMatchObject({
      categoryId: 5,
      categoryName: 'Despensa',
      walletId: 2,
      walletName: 'BBVA',
      spent: 400,
      budgeted: 1000,
      percentUsed: 40,
    });
    expect(panel.first.sources).toEqual(
      expect.arrayContaining([
        { frequency: 'WEEKLY', totalBudget: 1000 },
        { frequency: 'BIWEEKLY', totalBudget: 500 },
      ]),
    );
  });

  it('counts a BIWEEKLY $2000 budget once when periods match calendar quincenas', async () => {
    mocks.budgetPeriodFindMany.mockResolvedValue([
      periodFixture({
        id: 1,
        budgetId: 1,
        start: '2026-08-01',
        end: '2026-08-15',
        total: 2000,
        frequency: 'BIWEEKLY',
        categoryName: 'Comida',
        walletId: 2,
        walletName: 'Efectivo',
      }),
      periodFixture({
        id: 2,
        budgetId: 1,
        start: '2026-08-16',
        end: '2026-08-31',
        total: 2000,
        frequency: 'BIWEEKLY',
        categoryName: 'Comida',
        walletId: 2,
        walletName: 'Efectivo',
      }),
    ]);

    const panel = await getMonthlyBudgetPanel(ownerFilter, 2026, 8);

    expect(panel.first.totalBudget).toBe(2000);
    expect(panel.second.totalBudget).toBe(2000);
  });

  it('does not inflate totalBudget when one budget has multiple category allocations', async () => {
    mocks.budgetPeriodFindMany.mockResolvedValue([
      {
        id: 1,
        budget_id: 20,
        start_date: startOfCalendarDay('2026-08-01'),
        end_date: endOfCalendarDay('2026-08-15'),
        budget: {
          id: 20,
          total_amount: 3000,
          frequency: 'BIWEEKLY',
          allocations: [
            {
              id: 1,
              wallet_id: 2,
              category_id: 5,
              amount: 1000,
              category: { id: 5, name: 'Comida', icon: null },
              wallet: {
                id: 2,
                name: 'Efectivo',
                provider_icon_key: null,
                assignee: null,
              },
            },
            {
              id: 2,
              wallet_id: 1,
              category_id: 8,
              amount: 2000,
              category: { id: 8, name: 'Transporte', icon: null },
              wallet: {
                id: 1,
                name: 'Nómina',
                provider_icon_key: null,
                assignee: null,
              },
            },
          ],
        },
      },
    ]);
    mocks.computePeriodSpendByAllocations.mockResolvedValue({
      total_spent: 0,
      by_allocation: [{ spent_amount: 0 }, { spent_amount: 0 }],
    });

    const panel = await getMonthlyBudgetPanel(ownerFilter, 2026, 8);

    expect(panel.first.totalBudget).toBe(3000);
    expect(panel.first.allocations).toHaveLength(2);
    expect(panel.first.allocations.map((a) => a.budgeted).sort()).toEqual([
      1000, 2000,
    ]);
  });

  it('prorates a CUSTOM range that partially overlaps the first quincena', async () => {
    mocks.budgetPeriodFindMany.mockResolvedValue([
      periodFixture({
        id: 1,
        budgetId: 30,
        start: '2026-08-10',
        end: '2026-08-20',
        total: 1100,
        frequency: 'CUSTOM',
        categoryName: 'Viaje',
      }),
    ]);

    const panel = await getMonthlyBudgetPanel(ownerFilter, 2026, 8);

    // Aug 10–14 = 5 of 11 days → 1100 * 5/11
    expect(panel.first.totalBudget).toBeCloseTo(500, 5);
    // Aug 15–20 = 6 of 11 days → 1100 * 6/11
    expect(panel.second.totalBudget).toBeCloseTo(600, 5);
  });

  it('counts each DAILY period fully when it lies inside the quincena', async () => {
    mocks.budgetPeriodFindMany.mockResolvedValue([
      periodFixture({
        id: 1,
        budgetId: 40,
        start: '2026-08-02',
        end: '2026-08-02',
        total: 50,
        frequency: 'DAILY',
        categoryName: 'Café',
      }),
      periodFixture({
        id: 2,
        budgetId: 40,
        start: '2026-08-03',
        end: '2026-08-03',
        total: 50,
        frequency: 'DAILY',
        categoryName: 'Café',
      }),
    ]);

    const panel = await getMonthlyBudgetPanel(ownerFilter, 2026, 8);

    expect(panel.first.totalBudget).toBe(100);
    expect(panel.first.allocations[0]?.budgeted).toBe(100);
  });
});
