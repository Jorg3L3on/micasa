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

  it('aggregates spend into top categories for the fortnight scope', async () => {
    mocks.budgetPeriodFindMany.mockResolvedValue([
      periodFixture({
        id: 1,
        budgetId: 10,
        start: '2026-06-01',
        end: '2026-06-15',
        total: 1000,
        categoryId: 5,
        categoryName: 'Despensa',
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
      }),
    ]);
    mocks.computePeriodSpendByAllocations
      .mockResolvedValueOnce({ total_spent: 400, by_allocation: [{ spent_amount: 400 }] })
      .mockResolvedValueOnce({ total_spent: 150, by_allocation: [{ spent_amount: 150 }] });

    const panel = await getMonthlyBudgetPanel(ownerFilter, 2026, 6);

    expect(panel.first.totalBudget).toBe(1500);
    expect(panel.first.spent).toBe(550);
    expect(panel.first.categories).toHaveLength(2);
    expect(panel.first.categories[0]).toMatchObject({
      id: 5,
      name: 'Despensa',
      spent: 400,
      percentUsed: 40,
    });
    expect(panel.first.sources).toEqual(
      expect.arrayContaining([
        { frequency: 'WEEKLY', totalBudget: 1000 },
        { frequency: 'BIWEEKLY', totalBudget: 500 },
      ]),
    );
  });
});
