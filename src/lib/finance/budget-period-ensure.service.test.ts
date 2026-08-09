import { beforeEach, describe, expect, it, vi } from 'vitest';
import { endOfCalendarDay, parseCalendarDate, startOfCalendarDay } from '@/lib/calendar-dates';
import { ensureBudgetPeriodsForMonth } from './budget-period.service';

const mocks = vi.hoisted(() => ({
  fortnightCount: vi.fn(),
  budgetCount: vi.fn(),
  budgetPeriodCount: vi.fn(),
  budgetFindMany: vi.fn(),
  fortnightFindMany: vi.fn(),
  fortnightUpdate: vi.fn(),
  budgetPeriodFindMany: vi.fn(),
  budgetPeriodDeleteMany: vi.fn(),
  budgetPeriodFindFirst: vi.fn(),
  budgetPeriodCreate: vi.fn(),
  budgetPeriodUpdate: vi.fn(),
  budgetUpdate: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    fortnight: {
      count: mocks.fortnightCount,
      findMany: mocks.fortnightFindMany,
      update: mocks.fortnightUpdate,
    },
    budget: {
      count: mocks.budgetCount,
      findMany: mocks.budgetFindMany,
      update: mocks.budgetUpdate,
    },
    budgetPeriod: {
      count: mocks.budgetPeriodCount,
      findMany: mocks.budgetPeriodFindMany,
      findFirst: mocks.budgetPeriodFindFirst,
      create: mocks.budgetPeriodCreate,
      deleteMany: mocks.budgetPeriodDeleteMany,
      update: mocks.budgetPeriodUpdate,
    },
  },
}));

const ownerFilter = { user_id: 1, house_id: null } as const;

describe('ensureBudgetPeriodsForMonth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.budgetPeriodFindFirst.mockResolvedValue(null);
    mocks.budgetPeriodCreate.mockResolvedValue({ id: 1 });
    mocks.fortnightFindMany.mockResolvedValue([]);
    mocks.budgetFindMany.mockResolvedValue([]);
    mocks.budgetPeriodFindMany.mockResolvedValue([]);
    mocks.fortnightUpdate.mockResolvedValue({});
    mocks.budgetPeriodDeleteMany.mockResolvedValue({ count: 0 });
    mocks.budgetPeriodUpdate.mockResolvedValue({});
    mocks.budgetUpdate.mockResolvedValue({});
  });

  it('does nothing when fortnights are missing for the month', async () => {
    mocks.fortnightCount.mockResolvedValue(0);
    mocks.budgetCount.mockResolvedValue(1);

    await ensureBudgetPeriodsForMonth(ownerFilter, 2026, 6);

    expect(mocks.budgetFindMany).not.toHaveBeenCalled();
    expect(mocks.budgetPeriodCreate).not.toHaveBeenCalled();
  });

  it('generates periods when fortnights exist but none overlap the month', async () => {
    mocks.fortnightCount.mockResolvedValue(2);
    mocks.budgetCount.mockResolvedValue(1);
    mocks.budgetPeriodCount.mockResolvedValue(0);
    // reconcile pass
    mocks.fortnightFindMany
      .mockResolvedValueOnce([
        {
          id: 1,
          period: 'FIRST',
          start_date: startOfCalendarDay('2026-06-01'),
          end_date: endOfCalendarDay('2026-06-15'),
        },
        {
          id: 2,
          period: 'SECOND',
          start_date: startOfCalendarDay('2026-06-16'),
          end_date: endOfCalendarDay('2026-06-30'),
        },
      ])
      // generatePeriodsForMonth pass
      .mockResolvedValueOnce([
        {
          period: 'FIRST',
          start_date: startOfCalendarDay('2026-06-01'),
          end_date: endOfCalendarDay('2026-06-15'),
        },
        {
          period: 'SECOND',
          start_date: startOfCalendarDay('2026-06-16'),
          end_date: endOfCalendarDay('2026-06-30'),
        },
      ]);
    mocks.budgetFindMany
      .mockResolvedValueOnce([]) // reconcile BIWEEKLY
      .mockResolvedValueOnce([]) // reconcile WEEKLY
      .mockResolvedValueOnce([]) // reconcile DAILY
      .mockResolvedValueOnce([]) // reconcile CUSTOM
      .mockResolvedValueOnce([{ id: 10, frequency: 'WEEKLY' }]);

    await ensureBudgetPeriodsForMonth(ownerFilter, 2026, 6);

    expect(mocks.budgetPeriodCreate).toHaveBeenCalled();
  });

  it('skips generation when overlapping periods already exist', async () => {
    mocks.fortnightCount.mockResolvedValue(2);
    mocks.budgetCount.mockResolvedValue(1);
    mocks.budgetPeriodCount.mockResolvedValue(4);
    mocks.fortnightFindMany.mockResolvedValue([
      {
        id: 1,
        period: 'FIRST',
        start_date: startOfCalendarDay('2026-06-01'),
        end_date: endOfCalendarDay('2026-06-15'),
      },
      {
        id: 2,
        period: 'SECOND',
        start_date: startOfCalendarDay('2026-06-16'),
        end_date: endOfCalendarDay('2026-06-30'),
      },
    ]);

    await ensureBudgetPeriodsForMonth(ownerFilter, 2026, 6);

    expect(mocks.budgetPeriodCreate).not.toHaveBeenCalled();
  });

  it('realigns misaligned BIWEEKLY periods to calendar quincenas', async () => {
    mocks.fortnightCount.mockResolvedValue(2);
    mocks.budgetCount.mockResolvedValue(1);
    mocks.budgetPeriodCount.mockResolvedValue(2);
    mocks.fortnightFindMany.mockResolvedValue([
      {
        id: 1,
        period: 'FIRST',
        // Legacy onboarding: civil days shifted / wrong range
        start_date: new Date('2026-08-01T00:00:00.000Z'),
        end_date: new Date('2026-08-14T00:00:00.000Z'),
      },
      {
        id: 2,
        period: 'SECOND',
        start_date: new Date('2026-08-15T00:00:00.000Z'),
        end_date: new Date('2026-08-31T00:00:00.000Z'),
      },
    ]);
    mocks.budgetFindMany
      .mockResolvedValueOnce([{ id: 10 }]) // BIWEEKLY
      .mockResolvedValueOnce([]) // WEEKLY
      .mockResolvedValueOnce([]) // DAILY
      .mockResolvedValueOnce([]); // CUSTOM
    mocks.budgetPeriodFindMany.mockResolvedValue([
      {
        id: 101,
        start_date: new Date('2026-07-31T18:00:00.000Z'),
        end_date: new Date('2026-08-13T18:00:00.000Z'),
      },
      {
        id: 102,
        start_date: new Date('2026-08-14T18:00:00.000Z'),
        end_date: new Date('2026-08-30T18:00:00.000Z'),
      },
    ]);

    await ensureBudgetPeriodsForMonth(ownerFilter, 2026, 8);

    expect(mocks.fortnightUpdate).toHaveBeenCalled();
    expect(mocks.budgetPeriodDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: [101, 102] } },
    });
    expect(mocks.budgetPeriodCreate).toHaveBeenCalledTimes(2);
  });

  it('dedupes duplicate BIWEEKLY periods for the same quincena without delete-all', async () => {
    mocks.fortnightCount.mockResolvedValue(2);
    mocks.budgetCount.mockResolvedValue(1);
    mocks.budgetPeriodCount.mockResolvedValue(4);
    mocks.fortnightFindMany.mockResolvedValue([
      {
        id: 1,
        period: 'FIRST',
        start_date: parseCalendarDate('2026-08-01'),
        end_date: parseCalendarDate('2026-08-15'),
      },
      {
        id: 2,
        period: 'SECOND',
        start_date: parseCalendarDate('2026-08-16'),
        end_date: parseCalendarDate('2026-08-31'),
      },
    ]);
    mocks.budgetFindMany
      .mockResolvedValueOnce([{ id: 10 }]) // BIWEEKLY
      .mockResolvedValueOnce([]) // WEEKLY
      .mockResolvedValueOnce([]) // DAILY
      .mockResolvedValueOnce([]); // CUSTOM
    const first = {
      start_date: parseCalendarDate('2026-08-01'),
      end_date: parseCalendarDate('2026-08-15'),
    };
    const second = {
      start_date: parseCalendarDate('2026-08-16'),
      end_date: parseCalendarDate('2026-08-31'),
    };
    mocks.budgetPeriodFindMany.mockResolvedValue([
      { id: 201, ...first },
      { id: 202, ...first },
      { id: 203, ...second },
      { id: 204, ...second },
    ]);
    mocks.budgetPeriodFindFirst.mockImplementation(async (args?: {
      where?: { start_date?: Date; end_date?: Date };
    }) => {
      const start = args?.where?.start_date?.getTime();
      const end = args?.where?.end_date?.getTime();
      if (start === first.start_date.getTime() && end === first.end_date.getTime()) {
        return { id: 201 };
      }
      if (start === second.start_date.getTime() && end === second.end_date.getTime()) {
        return { id: 203 };
      }
      return null;
    });

    await ensureBudgetPeriodsForMonth(ownerFilter, 2026, 8);

    expect(mocks.budgetPeriodDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: [202, 204] } },
    });
    expect(mocks.budgetPeriodCreate).not.toHaveBeenCalled();
  });

  it('canonicalizes misaligned WEEKLY periods that bleed across quincenas', async () => {
    mocks.fortnightCount.mockResolvedValue(2);
    mocks.budgetCount.mockResolvedValue(1);
    mocks.budgetPeriodCount.mockResolvedValue(2);
    mocks.fortnightFindMany.mockResolvedValue([
      {
        id: 1,
        period: 'FIRST',
        start_date: parseCalendarDate('2026-08-01'),
        end_date: parseCalendarDate('2026-08-15'),
      },
      {
        id: 2,
        period: 'SECOND',
        start_date: parseCalendarDate('2026-08-16'),
        end_date: parseCalendarDate('2026-08-31'),
      },
    ]);
    mocks.budgetFindMany
      .mockResolvedValueOnce([]) // BIWEEKLY
      .mockResolvedValueOnce([{ id: 4 }]) // WEEKLY
      .mockResolvedValueOnce([]) // DAILY
      .mockResolvedValueOnce([]); // CUSTOM
    mocks.budgetPeriodFindMany.mockResolvedValue([
      {
        id: 88,
        start_date: new Date('2026-08-02T00:00:00.000Z'),
        end_date: new Date('2026-08-08T23:59:59.999Z'),
      },
      {
        id: 89,
        start_date: new Date('2026-08-16T00:00:00.000Z'),
        end_date: new Date('2026-08-22T23:59:59.999Z'),
      },
    ]);

    await ensureBudgetPeriodsForMonth(ownerFilter, 2026, 8);

    expect(mocks.budgetPeriodUpdate).toHaveBeenCalled();
    expect(mocks.budgetPeriodCreate).not.toHaveBeenCalled();
  });
});
