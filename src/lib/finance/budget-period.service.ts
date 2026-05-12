import prisma from '@/lib/prisma';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import type { BudgetFrequency } from '@/schemas/budget.schema';

type DateRange = { start_date: Date; end_date: Date };

// Pure function — exported for unit testing
export function computeBudgetWindows(
  frequency: BudgetFrequency,
  fortnight: DateRange,
  fromToday?: Date,
): DateRange[] {
  const { start_date: fnStart, end_date: fnEnd } = fortnight;

  switch (frequency) {
    case 'DAILY': {
      const rawStart =
        fromToday && fromToday > fnStart
          ? new Date(fromToday.getFullYear(), fromToday.getMonth(), fromToday.getDate())
          : new Date(fnStart.getFullYear(), fnStart.getMonth(), fnStart.getDate());

      const windows: DateRange[] = [];
      const cursor = new Date(rawStart);
      const fnEndDay = new Date(fnEnd.getFullYear(), fnEnd.getMonth(), fnEnd.getDate());

      while (cursor <= fnEndDay) {
        windows.push({
          start_date: new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), 0, 0, 0, 0),
          end_date: new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), 23, 59, 59, 999),
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      return windows;
    }

    case 'WEEKLY': {
      const year = fnStart.getFullYear();
      const month = fnStart.getMonth();
      const startDay = fnStart.getDate();

      let weeks: DateRange[];
      if (startDay === 1) {
        // FIRST fortnight: days 1–7, 8–15
        weeks = [
          {
            start_date: new Date(year, month, 1, 0, 0, 0, 0),
            end_date: new Date(year, month, 7, 23, 59, 59, 999),
          },
          {
            start_date: new Date(year, month, 8, 0, 0, 0, 0),
            end_date: new Date(year, month, 15, 23, 59, 59, 999),
          },
        ];
      } else {
        // SECOND fortnight: days 16–22, 23–end
        const lastDay = new Date(year, month + 1, 0).getDate();
        weeks = [
          {
            start_date: new Date(year, month, 16, 0, 0, 0, 0),
            end_date: new Date(year, month, 22, 23, 59, 59, 999),
          },
          {
            start_date: new Date(year, month, 23, 0, 0, 0, 0),
            end_date: new Date(year, month, lastDay, 23, 59, 59, 999),
          },
        ];
      }

      if (fromToday) {
        const todayStart = new Date(
          fromToday.getFullYear(),
          fromToday.getMonth(),
          fromToday.getDate(),
        );
        return weeks.filter((w) => w.end_date >= todayStart);
      }
      return weeks;
    }

    case 'BIWEEKLY': {
      return [{ start_date: fnStart, end_date: fnEnd }];
    }

    case 'CUSTOM': {
      return [];
    }
  }
}

async function insertPeriods(budgetId: number, windows: DateRange[]): Promise<number> {
  let created = 0;
  for (const w of windows) {
    const existing = await prisma.budgetPeriod.findFirst({
      where: { budget_id: budgetId, start_date: w.start_date, end_date: w.end_date },
      select: { id: true },
    });
    if (existing) continue;
    await prisma.budgetPeriod.create({
      data: { budget_id: budgetId, start_date: w.start_date, end_date: w.end_date },
    });
    created++;
  }
  return created;
}

export async function generatePeriodsOnCreate(
  budgetId: number,
  frequency: BudgetFrequency,
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  ownerFilter: OwnerFilter,
): Promise<number> {
  if (frequency === 'CUSTOM') {
    if (!startDate || !endDate) return 0;
    await prisma.budgetPeriod.create({
      data: {
        budget_id: budgetId,
        start_date: new Date(startDate),
        end_date: new Date(endDate),
      },
    });
    return 1;
  }

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const currentPeriod = today.getDate() <= 15 ? 'FIRST' : 'SECOND';
  const nextPeriod = currentPeriod === 'FIRST' ? 'SECOND' : null;

  let total = 0;

  const currentFortnight = await prisma.fortnight.findFirst({
    where: { ...ownerFilter, year, month, period: currentPeriod },
  });
  if (currentFortnight) {
    const windows = computeBudgetWindows(frequency, currentFortnight, today);
    total += await insertPeriods(budgetId, windows);
  }

  if (nextPeriod) {
    const nextFortnight = await prisma.fortnight.findFirst({
      where: { ...ownerFilter, year, month, period: nextPeriod },
    });
    if (nextFortnight) {
      const windows = computeBudgetWindows(frequency, nextFortnight);
      total += await insertPeriods(budgetId, windows);
    }
  }

  return total;
}

export async function generatePeriodsForMonth(
  year: number,
  month: number,
  ownerFilter: OwnerFilter,
): Promise<{ total: number }> {
  const budgets = await prisma.budget.findMany({
    where: { ...ownerFilter, active: true, recurrent: true },
    select: { id: true, frequency: true },
  });

  if (budgets.length === 0) return { total: 0 };

  const fortnights = await prisma.fortnight.findMany({
    where: { ...ownerFilter, year, month },
  });

  let total = 0;
  for (const budget of budgets) {
    if (budget.frequency === 'CUSTOM') continue;
    for (const fortnight of fortnights) {
      const windows = computeBudgetWindows(budget.frequency as BudgetFrequency, fortnight);
      total += await insertPeriods(budget.id, windows);
    }
  }

  return { total };
}

export async function listActivePeriods(ownerFilter: OwnerFilter, asOf: Date) {
  const periods = await prisma.budgetPeriod.findMany({
    where: {
      start_date: { lte: asOf },
      end_date: { gte: asOf },
      budget: { ...ownerFilter, active: true },
    },
    include: {
      budget: {
        include: {
          allocations: {
            include: {
              wallet: { select: { id: true, name: true } },
              category: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
    orderBy: { start_date: 'asc' },
  });

  return Promise.all(
    periods.map(async (period) => {
      const { budget } = period;
      const walletIds = budget.allocations.map((a) => a.wallet_id);
      const categoryIds = budget.allocations.map((a) => a.category_id);

      let spentAmount = 0;
      if (walletIds.length > 0) {
        const agg = await prisma.expense.aggregate({
          where: {
            wallet_id: { in: walletIds },
            category_id: { in: categoryIds },
            payment_date: { gte: period.start_date, lte: period.end_date },
          },
          _sum: { amount: true },
        });
        spentAmount = Number(agg._sum.amount ?? 0);
      }

      const allocatedAmount = Number(budget.total_amount);
      return {
        period_id: period.id,
        budget_id: budget.id,
        name: budget.name,
        frequency: budget.frequency,
        start_date: period.start_date.toISOString(),
        end_date: period.end_date.toISOString(),
        allocated_amount: allocatedAmount,
        spent_amount: spentAmount,
        remaining_amount: allocatedAmount - spentAmount,
        active: budget.active,
        recurrent: budget.recurrent,
        allocations: budget.allocations.map((a) => ({
          id: a.id,
          wallet_id: a.wallet_id,
          wallet_name: a.wallet.name,
          category_id: a.category_id,
          category_name: a.category.name,
          amount: Number(a.amount),
        })),
      };
    }),
  );
}

export async function listHistoryPeriods(
  ownerFilter: OwnerFilter,
  year: number,
  month: number,
) {
  const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
  const now = new Date();

  const periods = await prisma.budgetPeriod.findMany({
    where: {
      end_date: { lt: now, gte: monthStart, lte: monthEnd },
      budget: ownerFilter,
    },
    include: {
      budget: {
        include: {
          allocations: {
            include: {
              wallet: { select: { id: true, name: true } },
              category: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
    orderBy: [{ budget_id: 'asc' }, { start_date: 'asc' }],
  });

  const grouped = new Map<
    number,
    {
      budget_id: number;
      name: string;
      frequency: string;
      allocated_amount: number;
      periods: Array<{
        period_id: number;
        start_date: string;
        end_date: string;
        allocated_amount: number;
        spent_amount: number;
        remaining_amount: number;
      }>;
    }
  >();

  for (const period of periods) {
    const { budget } = period;
    if (!grouped.has(budget.id)) {
      grouped.set(budget.id, {
        budget_id: budget.id,
        name: budget.name,
        frequency: budget.frequency,
        allocated_amount: Number(budget.total_amount),
        periods: [],
      });
    }

    const walletIds = budget.allocations.map((a) => a.wallet_id);
    const categoryIds = budget.allocations.map((a) => a.category_id);

    let spentAmount = 0;
    if (walletIds.length > 0) {
      const agg = await prisma.expense.aggregate({
        where: {
          wallet_id: { in: walletIds },
          category_id: { in: categoryIds },
          payment_date: { gte: period.start_date, lte: period.end_date },
        },
        _sum: { amount: true },
      });
      spentAmount = Number(agg._sum.amount ?? 0);
    }

    const allocatedAmount = Number(budget.total_amount);
    grouped.get(budget.id)!.periods.push({
      period_id: period.id,
      start_date: period.start_date.toISOString(),
      end_date: period.end_date.toISOString(),
      allocated_amount: allocatedAmount,
      spent_amount: spentAmount,
      remaining_amount: allocatedAmount - spentAmount,
    });
  }

  return Array.from(grouped.values());
}
