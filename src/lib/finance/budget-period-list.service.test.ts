import { beforeEach, describe, expect, it, vi } from 'vitest';
import { endOfCalendarDay, startOfCalendarDay } from '@/lib/calendar-dates';
import {
  generatePeriodsForMonth,
  listActivePeriods,
  listHistoryPeriods,
} from './budget-period.service';

const mocks = vi.hoisted(() => ({
  budgetFindMany: vi.fn(),
  budgetPeriodFindMany: vi.fn(),
  budgetPeriodFindFirst: vi.fn(),
  budgetPeriodCreate: vi.fn(),
  fortnightFindMany: vi.fn(),
  computePeriodSpendByAllocations: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    budget: { findMany: mocks.budgetFindMany },
    budgetPeriod: {
      findMany: mocks.budgetPeriodFindMany,
      findFirst: mocks.budgetPeriodFindFirst,
      create: mocks.budgetPeriodCreate,
    },
    fortnight: { findMany: mocks.fortnightFindMany },
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
    mocks.budgetPeriodFindMany.mockReset();
    mocks.budgetPeriodFindFirst.mockReset();
    mocks.budgetPeriodCreate.mockReset();
    mocks.fortnightFindMany.mockReset();
    mocks.computePeriodSpendByAllocations.mockReset();
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
});
