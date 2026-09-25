import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  endOfCalendarDay,
  startOfCalendarDay,
  todayCalendarDate,
} from '@/lib/calendar-dates';
import {
  generatePeriodsForMonth,
  listActivePeriods,
  listBudgetPeriodExpensesByAllocation,
  listHistoryPeriods,
  refreshFuturePeriodSnapshots,
} from './budget-period.service';

const mocks = vi.hoisted(() => ({
  budgetFindMany: vi.fn(),
  budgetCount: vi.fn(),
  budgetPeriodFindMany: vi.fn(),
  budgetPeriodFindFirst: vi.fn(),
  budgetPeriodCreate: vi.fn(),
  budgetPeriodCount: vi.fn(),
  fortnightFindMany: vi.fn(),
  fortnightCount: vi.fn(),
  expenseFindMany: vi.fn(),
  computePeriodSpendByAllocations: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    budget: { findMany: mocks.budgetFindMany, count: mocks.budgetCount },
    budgetPeriod: {
      findMany: mocks.budgetPeriodFindMany,
      findFirst: mocks.budgetPeriodFindFirst,
      create: mocks.budgetPeriodCreate,
      count: mocks.budgetPeriodCount,
      deleteMany: vi.fn(),
    },
    fortnight: { findMany: mocks.fortnightFindMany, count: mocks.fortnightCount },
    expense: { findMany: mocks.expenseFindMany },
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

const allocationRow = {
  id: 1,
  wallet_id: 2,
  category_id: 3,
  amount: 500,
  wallet: { id: 2, name: 'Efectivo' },
  category: { id: 3, name: 'Despensa', icon: null },
};

describe('listActivePeriods', () => {
  beforeEach(() => {
    mocks.budgetFindMany.mockReset();
    mocks.budgetCount.mockReset();
    mocks.budgetPeriodFindMany.mockReset();
    mocks.budgetPeriodFindFirst.mockReset();
    mocks.budgetPeriodCreate.mockReset();
    mocks.budgetPeriodCount.mockReset();
    mocks.fortnightFindMany.mockReset();
    mocks.fortnightCount.mockReset();
    mocks.computePeriodSpendByAllocations.mockReset();
    mocks.fortnightCount.mockResolvedValue(0);
    mocks.computePeriodSpendByAllocations.mockResolvedValue({
      total_spent: 120,
      by_allocation: [{ spent_amount: 120 }],
    });
  });

  it('returns active periods with spent and remaining amounts', async () => {
    const asOf = startOfCalendarDay('2026-06-10');
    mocks.budgetPeriodFindMany.mockResolvedValue([
      {
        id: 50,
        start_date: startOfCalendarDay('2026-06-01'),
        end_date: endOfCalendarDay('2026-06-15'),
        budget: {
          id: 10,
          name: 'Despensa',
          frequency: 'BIWEEKLY',
          total_amount: 500,
          active: true,
          recurrent: true,
          allocations: [allocationRow],
        },
      },
    ]);

    const rows = await listActivePeriods(ownerFilter, asOf);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      period_id: 50,
      budget_id: 10,
      allocated_amount: 500,
      spent_amount: 120,
      remaining_amount: 380,
    });
    expect(mocks.fortnightCount).toHaveBeenCalled();
    expect(mocks.computePeriodSpendByAllocations).toHaveBeenCalledWith(
      expect.anything(),
      [{ wallet_id: 2, category_id: 3, amount: 500 }],
      {
        start_date: startOfCalendarDay('2026-06-01'),
        end_date: endOfCalendarDay('2026-06-15'),
      },
      ownerFilter,
    );
  });

  it('includes the covering-today period of a deactivated recurrent template', async () => {
    const asOf = startOfCalendarDay('2026-06-10');
    mocks.budgetPeriodFindMany.mockResolvedValue([
      {
        id: 50,
        start_date: startOfCalendarDay('2026-06-01'),
        end_date: endOfCalendarDay('2026-06-15'),
        budget: {
          id: 10,
          name: 'Despensa',
          frequency: 'BIWEEKLY',
          total_amount: 500,
          active: false,
          recurrent: true,
          allocations: [allocationRow],
        },
      },
    ]);

    const rows = await listActivePeriods(ownerFilter, asOf);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      period_id: 50,
      budget_id: 10,
      active: false,
      recurrent: true,
    });
    expect(mocks.budgetPeriodFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { budget: { ...ownerFilter, active: true } },
            { budget: { ...ownerFilter, active: false, recurrent: true } },
          ],
        }),
      }),
    );
  });
});

describe('listHistoryPeriods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.computePeriodSpendByAllocations.mockResolvedValue({
      total_spent: 80,
      by_allocation: [{ spent_amount: 80 }],
    });
  });

  it('groups ended periods by budget template for the requested month', async () => {
    mocks.budgetPeriodFindMany.mockResolvedValue([
      {
        id: 40,
        start_date: startOfCalendarDay('2026-05-01'),
        end_date: endOfCalendarDay('2026-05-15'),
        budget: {
          id: 10,
          name: 'Despensa',
          frequency: 'BIWEEKLY',
          total_amount: 500,
          allocations: [allocationRow],
        },
      },
    ]);

    const groups = await listHistoryPeriods(ownerFilter, 2026, 5);

    expect(groups).toHaveLength(1);
    expect(groups[0].budget_id).toBe(10);
    expect(groups[0].periods).toHaveLength(1);
    expect(groups[0].periods[0].spent_amount).toBe(80);
  });
});

describe('generatePeriodsForMonth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.budgetPeriodFindFirst.mockResolvedValue(null);
    mocks.budgetPeriodFindMany.mockResolvedValue([]);
    mocks.budgetPeriodCreate.mockResolvedValue({ id: 1 });
  });

  it('creates windows for each recurrent budget across both fortnights', async () => {
    mocks.budgetFindMany.mockResolvedValue([
      { id: 10, frequency: 'WEEKLY' },
    ]);
    mocks.fortnightFindMany.mockResolvedValue([
      {
        start_date: startOfCalendarDay('2026-06-01'),
        end_date: endOfCalendarDay('2026-06-15'),
      },
      {
        start_date: startOfCalendarDay('2026-06-16'),
        end_date: endOfCalendarDay('2026-06-30'),
      },
    ]);

    const result = await generatePeriodsForMonth(2026, 6, ownerFilter);

    // 3 weekly windows in first fortnight + 3 in second = 6
    expect(result.total).toBe(6);
    expect(mocks.budgetPeriodCreate).toHaveBeenCalledTimes(6);
  });

  it('skips CUSTOM budgets', async () => {
    mocks.budgetFindMany.mockResolvedValue([
      { id: 10, frequency: 'CUSTOM' },
    ]);
    mocks.fortnightFindMany.mockResolvedValue([
      {
        start_date: startOfCalendarDay('2026-06-01'),
        end_date: endOfCalendarDay('2026-06-15'),
      },
    ]);

    const result = await generatePeriodsForMonth(2026, 6, ownerFilter);

    expect(result.total).toBe(0);
    expect(mocks.budgetPeriodCreate).not.toHaveBeenCalled();
  });

  it('skips insert when a period already covers the same civil days with different timestamps', async () => {
    mocks.budgetFindMany.mockResolvedValue([{ id: 10, frequency: 'BIWEEKLY' }]);
    mocks.fortnightFindMany.mockResolvedValue([
      {
        period: 'FIRST',
        start_date: startOfCalendarDay('2026-05-31'),
        end_date: endOfCalendarDay('2026-06-14'),
      },
      {
        period: 'SECOND',
        start_date: startOfCalendarDay('2026-06-15'),
        end_date: endOfCalendarDay('2026-06-29'),
      },
    ]);
    // MX-midnight encoding (06:00Z) — not equal to canonical UTC noon windows.
    mocks.budgetPeriodFindMany.mockImplementation(async ({ where }) => {
      const budgetId = where?.budget_id;
      if (budgetId !== 10) return [];
      return [
        {
          id: 106,
          start_date: new Date('2026-05-31T06:00:00.000Z'),
          end_date: new Date('2026-06-14T06:00:00.000Z'),
        },
        {
          id: 107,
          start_date: new Date('2026-06-15T06:00:00.000Z'),
          end_date: new Date('2026-06-29T06:00:00.000Z'),
        },
      ];
    });

    const result = await generatePeriodsForMonth(2026, 6, ownerFilter);

    expect(result.total).toBe(0);
    expect(mocks.budgetPeriodCreate).not.toHaveBeenCalled();
  });
});

describe('refreshFuturePeriodSnapshots', () => {
  beforeEach(() => {
    mocks.budgetPeriodFindMany.mockReset();
  });

  it('refreshes periods that have not ended and leaves closed history out of the query', async () => {
    mocks.budgetPeriodFindMany.mockResolvedValue([]);
    const asOf = new Date('2026-06-10T18:00:00.000Z');

    await refreshFuturePeriodSnapshots(10, asOf);

    expect(mocks.budgetPeriodFindMany).toHaveBeenCalledWith({
      where: {
        budget_id: 10,
        end_date: { gte: startOfCalendarDay(todayCalendarDate(asOf)) },
      },
      select: { id: true },
    });
  });
});

describe('listBudgetPeriodExpensesByAllocation', () => {
  beforeEach(() => {
    mocks.budgetPeriodFindFirst.mockReset();
    mocks.expenseFindMany.mockReset();
  });

  it('includes Despensa from any wallet when the allocation wallet is null', async () => {
    mocks.budgetPeriodFindFirst.mockResolvedValue({
      id: 4,
      start_date: startOfCalendarDay('2026-06-01'),
      end_date: endOfCalendarDay('2026-06-14'),
      snapshot: {
        allocations: [{ id: 9, wallet_id: null, category_id: 7 }],
      },
      budget: { allocations: [] },
    });
    mocks.expenseFindMany.mockResolvedValue([
      expenseRow(1, 2, 7),
      expenseRow(2, 8, 7),
      expenseRow(3, 2, 9),
    ]);

    const groups = await listBudgetPeriodExpensesByAllocation(4, ownerFilter);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.expenses.map((expense) => expense.id)).toEqual([1, 2]);
    expect(mocks.expenseFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ category_id: 7 }],
        }),
      }),
    );
  });

  it('keeps a specific wallet from listing expenses on another wallet', async () => {
    mocks.budgetPeriodFindFirst.mockResolvedValue({
      id: 4,
      start_date: startOfCalendarDay('2026-06-01'),
      end_date: endOfCalendarDay('2026-06-14'),
      snapshot: {
        allocations: [{ id: 9, wallet_id: 2, category_id: 7 }],
      },
      budget: { allocations: [] },
    });
    mocks.expenseFindMany.mockResolvedValue([
      expenseRow(1, 2, 7),
      expenseRow(2, 8, 7),
    ]);

    const groups = await listBudgetPeriodExpensesByAllocation(4, ownerFilter);

    expect(groups[0]?.expenses.map((expense) => expense.id)).toEqual([1]);
    expect(mocks.expenseFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ wallet_id: 2, category_id: 7 }],
        }),
      }),
    );
  });
});

function expenseRow(id: number, walletId: number, categoryId: number) {
  return {
    id,
    description: 'Despensa',
    amount: 40,
    payment_date: startOfCalendarDay('2026-06-04'),
    created_at: startOfCalendarDay('2026-06-04'),
    is_paid: true,
    expense_template_id: null,
    credit_installment_current: null,
    credit_installment_total: null,
    category: { id: categoryId, name: 'Despensa', icon: null },
    wallet: { id: walletId, name: `Wallet ${walletId}`, type: 'DEBIT_CARD' },
  };
}
