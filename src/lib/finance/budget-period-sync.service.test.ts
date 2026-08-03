import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseCalendarDate, formatCalendarDate } from '@/lib/calendar-dates';
import { syncBudgetPeriodsAfterTemplateUpdate } from './budget-period.service';

type PeriodRow = {
  id: number;
  budget_id: number;
  start_date: Date;
  end_date: Date;
};

const mocks = vi.hoisted(() => ({
  budgetPeriodDeleteMany: vi.fn(),
  budgetPeriodFindMany: vi.fn(),
  budgetPeriodFindFirst: vi.fn(),
  budgetPeriodCreate: vi.fn(),
  fortnightFindFirst: vi.fn(),
  store: [] as PeriodRow[],
  nextId: 1,
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    budgetPeriod: {
      deleteMany: mocks.budgetPeriodDeleteMany,
      findMany: mocks.budgetPeriodFindMany,
      findFirst: mocks.budgetPeriodFindFirst,
      create: mocks.budgetPeriodCreate,
    },
    fortnight: {
      findFirst: mocks.fortnightFindFirst,
    },
  },
}));

const ownerFilter = { user_id: 1, house_id: null } as const;

describe('syncBudgetPeriodsAfterTemplateUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.store = [
      {
        id: 1,
        budget_id: 10,
        start_date: parseCalendarDate('2026-08-01'),
        end_date: parseCalendarDate('2026-08-30'),
      },
    ];
    mocks.nextId = 2;
    mocks.fortnightFindFirst.mockResolvedValue(null);

    mocks.budgetPeriodFindMany.mockImplementation(async (args?: { where?: { budget_id?: number } }) => {
      const budgetId = args?.where?.budget_id;
      return mocks.store.filter((row) =>
        budgetId == null ? true : row.budget_id === budgetId,
      );
    });

    mocks.budgetPeriodFindFirst.mockImplementation(async (args?: {
      where?: { budget_id?: number; start_date?: Date; end_date?: Date };
    }) => {
      const where = args?.where;
      if (!where) return null;
      return (
        mocks.store.find(
          (row) =>
            row.budget_id === where.budget_id &&
            row.start_date.getTime() === where.start_date?.getTime() &&
            row.end_date.getTime() === where.end_date?.getTime(),
        ) ?? null
      );
    });

    mocks.budgetPeriodDeleteMany.mockImplementation(async (args: {
      where: {
        budget_id: number;
        OR: Array<
          | { start_date: { gt: Date } }
          | { start_date: { lte: Date }; end_date: { gte: Date } }
        >;
      };
    }) => {
      const { budget_id, OR } = args.where;
      const before = mocks.store.length;
      mocks.store = mocks.store.filter((row) => {
        if (row.budget_id !== budget_id) return true;
        const matches = OR.some((clause) => {
          if ('gt' in clause.start_date) {
            return row.start_date.getTime() > clause.start_date.gt.getTime();
          }
          const current = clause as {
            start_date: { lte: Date };
            end_date: { gte: Date };
          };
          return (
            row.start_date.getTime() <= current.start_date.lte.getTime() &&
            row.end_date.getTime() >= current.end_date.gte.getTime()
          );
        });
        return !matches;
      });
      return { count: before - mocks.store.length };
    });

    mocks.budgetPeriodCreate.mockImplementation(async (args: {
      data: { budget_id: number; start_date: Date; end_date: Date };
    }) => {
      const row = {
        id: mocks.nextId++,
        budget_id: args.data.budget_id,
        start_date: args.data.start_date,
        end_date: args.data.end_date,
      };
      mocks.store.push(row);
      return row;
    });
  });

  it('replaces the current CUSTOM period instead of stacking a second date range', async () => {
    const now = new Date('2026-08-02T18:00:00.000Z');
    const newRange = {
      start_date: parseCalendarDate('2026-08-01'),
      end_date: parseCalendarDate('2026-08-31'),
    };

    expect(mocks.store).toHaveLength(1);
    expect(formatCalendarDate(mocks.store[0].end_date)).toBe('2026-08-30');

    await syncBudgetPeriodsAfterTemplateUpdate(
      10,
      'CUSTOM',
      newRange,
      ownerFilter,
      { recurrent: false, now },
    );

    expect(mocks.store).toHaveLength(1);
    expect(formatCalendarDate(mocks.store[0].start_date)).toBe('2026-08-01');
    expect(formatCalendarDate(mocks.store[0].end_date)).toBe('2026-08-31');
  });
});
