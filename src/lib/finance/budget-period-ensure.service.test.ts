import { beforeEach, describe, expect, it, vi } from 'vitest';
import { endOfCalendarDay, startOfCalendarDay } from '@/lib/calendar-dates';
import { ensureBudgetPeriodsForMonth } from './budget-period.service';

const mocks = vi.hoisted(() => ({
  fortnightCount: vi.fn(),
  budgetCount: vi.fn(),
  budgetPeriodCount: vi.fn(),
  budgetFindMany: vi.fn(),
  fortnightFindMany: vi.fn(),
  budgetPeriodFindFirst: vi.fn(),
  budgetPeriodCreate: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    fortnight: { count: mocks.fortnightCount, findMany: mocks.fortnightFindMany },
    budget: { count: mocks.budgetCount, findMany: mocks.budgetFindMany },
    budgetPeriod: {
      count: mocks.budgetPeriodCount,
      findFirst: mocks.budgetPeriodFindFirst,
      create: mocks.budgetPeriodCreate,
    },
  },
}));

const ownerFilter = { user_id: 1, house_id: null } as const;

describe('ensureBudgetPeriodsForMonth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.budgetPeriodFindFirst.mockResolvedValue(null);
    mocks.budgetPeriodCreate.mockResolvedValue({ id: 1 });
  });

  it('does nothing when fortnights are missing for the month', async () => {
    mocks.fortnightCount.mockResolvedValue(0);

    await ensureBudgetPeriodsForMonth(ownerFilter, 2026, 6);

    expect(mocks.budgetCount).not.toHaveBeenCalled();
    expect(mocks.budgetFindMany).not.toHaveBeenCalled();
  });

  it('generates periods when fortnights exist but none overlap the month', async () => {
    mocks.fortnightCount.mockResolvedValue(2);
    mocks.budgetCount.mockResolvedValue(1);
    mocks.budgetPeriodCount.mockResolvedValue(0);
    mocks.budgetFindMany.mockResolvedValue([{ id: 10, frequency: 'WEEKLY' }]);
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

    await ensureBudgetPeriodsForMonth(ownerFilter, 2026, 6);

    expect(mocks.budgetPeriodCreate).toHaveBeenCalled();
  });

  it('skips generation when overlapping periods already exist', async () => {
    mocks.fortnightCount.mockResolvedValue(2);
    mocks.budgetCount.mockResolvedValue(1);
    mocks.budgetPeriodCount.mockResolvedValue(4);

    await ensureBudgetPeriodsForMonth(ownerFilter, 2026, 6);

    expect(mocks.budgetFindMany).not.toHaveBeenCalled();
    expect(mocks.budgetPeriodCreate).not.toHaveBeenCalled();
  });
});
