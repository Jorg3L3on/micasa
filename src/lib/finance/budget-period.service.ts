import prisma from '@/lib/prisma';
import {
  endOfCalendarDay,
  formatCalendarDate,
  startOfCalendarDay,
  todayCalendarDate,
} from '@/lib/calendar-dates';
import { getNextCalendarFortnight } from '@/lib/fortnight-calendar';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import type { BudgetFrequency } from '@/schemas/budget.schema';
import { whereExcludeCreditInstallments } from '@/lib/finance/expense-planning-scope';
import {
  computePeriodSpendByAllocations,
  type DateRange,
} from '@/lib/finance/budget-period-spend';
import {
  computeBudgetPeriodWindowsForFortnight,
  getCalendarFortnightBoundsForMonth,
  getCanonicalFortnightBounds,
  periodMatchesCalendarWindow,
  canonicalizeWeeklyPeriod,
  canonicalizeDailyPeriod,
  canonicalizeCustomPeriod,
  calendarWeeksOverlappingRange,
  readWallClockYmd,
} from '@/lib/finance/budget-period-windows';

export { computeBudgetPeriodWindowsForFortnight as computeBudgetWindows } from '@/lib/finance/budget-period-windows';

async function syncPeriodSnapshot(periodId: number, budgetId: number): Promise<void> {
  if (
    !prisma.budget ||
    typeof prisma.budget.findUnique !== 'function' ||
    !prisma.budgetPeriodSnapshot ||
    typeof prisma.budgetPeriodSnapshot.upsert !== 'function' ||
    !prisma.budgetPeriodSnapshotAllocation ||
    typeof prisma.budgetPeriodSnapshotAllocation.createMany !== 'function'
  ) {
    return;
  }
  const budget = await prisma.budget.findUnique({
    where: { id: budgetId },
    include: {
      allocations: {
        include: {
          wallet: { select: { id: true, name: true } },
          category: { select: { id: true, name: true, icon: true } },
        },
      },
    },
  });
  if (!budget) return;

  await prisma.$transaction(async (tx) => {
    const snapshot = await tx.budgetPeriodSnapshot.upsert({
      where: { budget_period_id: periodId },
      update: {
        budget_name: budget.name,
        total_amount: budget.total_amount,
      },
      create: {
        budget_period_id: periodId,
        budget_name: budget.name,
        total_amount: budget.total_amount,
      },
    });
    await tx.budgetPeriodSnapshotAllocation.deleteMany({
      where: { snapshot_id: snapshot.id },
    });
    if (budget.allocations.length > 0) {
      await tx.budgetPeriodSnapshotAllocation.createMany({
        data: budget.allocations.map((allocation) => ({
          snapshot_id: snapshot.id,
          wallet_id: allocation.wallet.id,
          wallet_name: allocation.wallet.name,
          category_id: allocation.category.id,
          category_name: allocation.category.name,
          category_icon: allocation.category.icon ?? null,
          allocated_amount: allocation.amount,
        })),
      });
    }
  });
}

async function insertPeriods(budgetId: number, windows: DateRange[]): Promise<number> {
  let created = 0;
  for (const w of windows) {
    const existing = await prisma.budgetPeriod.findFirst({
      where: { budget_id: budgetId, start_date: w.start_date, end_date: w.end_date },
      select: { id: true },
    });
    if (existing) continue;
    const period = await prisma.budgetPeriod.create({
      data: { budget_id: budgetId, start_date: w.start_date, end_date: w.end_date },
    });
    await syncPeriodSnapshot(period.id, budgetId);
    created++;
  }
  return created;
}

function activeDayBounds(asOf: Date): DateRange {
  const today = todayCalendarDate(asOf);
  return {
    start_date: startOfCalendarDay(today),
    end_date: endOfCalendarDay(today),
  };
}

export async function generatePeriodsOnCreate(
  budgetId: number,
  frequency: BudgetFrequency,
  budgetDateRange: DateRange | null,
  ownerFilter: OwnerFilter,
  options?: { recurrent?: boolean; now?: Date },
): Promise<number> {
  if (!budgetDateRange) return 0;

  let total = await insertPeriods(budgetId, [budgetDateRange]);

  if (frequency === 'CUSTOM' || !options?.recurrent) {
    return total;
  }

  const now = options.now ?? new Date();
  const nextRef = getNextCalendarFortnight(now);
  const nextFortnight = await prisma.fortnight.findFirst({
    where: { ...ownerFilter, ...nextRef },
  });

  if (!nextFortnight || frequency === 'DAILY') {
    return total;
  }

  const windowSource = getCanonicalFortnightBounds(
    nextFortnight.year,
    nextFortnight.month,
    nextFortnight.period,
  );
  const windows = computeBudgetPeriodWindowsForFortnight(frequency, windowSource);
  total += await insertPeriods(budgetId, windows);
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
    select: { period: true, start_date: true, end_date: true },
  });

  let total = 0;
  for (const budget of budgets) {
    if (budget.frequency === 'CUSTOM') continue;
    for (const fortnight of fortnights) {
      // Prefer year/month/period → canonical civil bounds so legacy Fortnight
      // timestamps cannot poison WEEKLY/DAILY/BIWEEKLY window generation.
      const windowSource = getCanonicalFortnightBounds(
        year,
        month,
        fortnight.period,
      );
      const windows = computeBudgetPeriodWindowsForFortnight(
        budget.frequency as BudgetFrequency,
        windowSource,
      );
      total += await insertPeriods(budget.id, windows);
    }
  }

  return { total };
}

/**
 * Aligns Fortnight rows and BIWEEKLY budget periods for a month to canonical
 * calendar bounds so Panel financiero day-proration cannot inflate totals.
 */
async function reconcileBiweeklyCalendarAlignment(
  ownerFilter: OwnerFilter,
  year: number,
  month: number,
): Promise<void> {
  const { first, second } = getCalendarFortnightBoundsForMonth(year, month);
  const fortnights = await prisma.fortnight.findMany({
    where: { ...ownerFilter, year, month },
    select: { id: true, period: true, start_date: true, end_date: true },
  });

  for (const fortnight of fortnights) {
    const bounds = getCanonicalFortnightBounds(year, month, fortnight.period);
    if (!periodMatchesCalendarWindow(fortnight, bounds)) {
      await prisma.fortnight.update({
        where: { id: fortnight.id },
        data: {
          start_date: bounds.start_date,
          end_date: bounds.end_date,
        },
      });
    }
  }

  if (fortnights.length === 0) return;

  const expectedWindows = fortnights.map((f) =>
    getCanonicalFortnightBounds(year, month, f.period),
  );

  const budgets = await prisma.budget.findMany({
    where: { ...ownerFilter, active: true, frequency: 'BIWEEKLY' },
    select: { id: true },
  });
  if (budgets.length === 0) return;

  const monthStart = first.start_date;
  const monthEnd = second.end_date;

  for (const budget of budgets) {
    const periods = await prisma.budgetPeriod.findMany({
      where: {
        budget_id: budget.id,
        start_date: { lte: monthEnd },
        end_date: { gte: monthStart },
      },
      select: { id: true, start_date: true, end_date: true },
      orderBy: { start_date: 'asc' },
    });

    const allAligned =
      periods.length === expectedWindows.length &&
      expectedWindows.every((window) =>
        periods.some((period) => periodMatchesCalendarWindow(period, window)),
      );

    if (allAligned) continue;

    if (periods.length > 0) {
      await prisma.budgetPeriod.deleteMany({
        where: { id: { in: periods.map((p) => p.id) } },
      });
    }

    await insertPeriods(budget.id, expectedWindows);

    // Keep template window on the current calendar fortnight when it falls in this month.
    const today = todayCalendarDate();
    const [ty, tm, td] = today.split('-').map(Number);
    if (ty === year && tm === month) {
      const bounds = getCanonicalFortnightBounds(
        year,
        month,
        td <= 15 ? 'FIRST' : 'SECOND',
      );
      await prisma.budget.update({
        where: { id: budget.id },
        data: {
          start_date: bounds.start_date,
          end_date: bounds.end_date,
        },
      });
    }
  }
}

/**
 * Rewrites WEEKLY periods onto stable Sun–Sat UTC-noon weeks and drops
 * duplicates so quincena proration cannot pick up an extra day from an
 * 8-day timezone artifact (e.g. $150 + $18.75 = $168.75).
 */
async function reconcileWeeklyCalendarAlignment(
  ownerFilter: OwnerFilter,
  year: number,
  month: number,
): Promise<void> {
  const { first, second } = getCalendarFortnightBoundsForMonth(year, month);
  const monthStart = first.start_date;
  const monthEnd = second.end_date;

  const budgets = await prisma.budget.findMany({
    where: { ...ownerFilter, active: true, frequency: 'WEEKLY' },
    select: { id: true },
  });
  if (budgets.length === 0) return;

  for (const budget of budgets) {
    const periods = await prisma.budgetPeriod.findMany({
      where: {
        budget_id: budget.id,
        start_date: { lte: monthEnd },
        end_date: { gte: monthStart },
      },
      select: { id: true, start_date: true, end_date: true },
      orderBy: { start_date: 'asc' },
    });
    if (periods.length === 0) continue;

    const seenWeeks = new Set<string>();
    const toDelete: number[] = [];

    for (const period of periods) {
      const canonical = canonicalizeWeeklyPeriod(period);
      const key = `${readWallClockYmd(canonical.start_date)}_${readWallClockYmd(canonical.end_date)}`;
      if (seenWeeks.has(key)) {
        toDelete.push(period.id);
        continue;
      }
      seenWeeks.add(key);

      if (!periodMatchesCalendarWindow(period, canonical)) {
        await prisma.budgetPeriod.update({
          where: { id: period.id },
          data: {
            start_date: canonical.start_date,
            end_date: canonical.end_date,
          },
        });
      }
    }

    if (toDelete.length > 0) {
      await prisma.budgetPeriod.deleteMany({
        where: { id: { in: toDelete } },
      });
    }

    // Align template window to the current calendar week when viewing this month.
    const today = todayCalendarDate();
    const [ty, tm] = today.split('-').map(Number);
    if (ty === year && tm === month) {
      const [week] = calendarWeeksOverlappingRange(today, today);
      if (week) {
        await prisma.budget.update({
          where: { id: budget.id },
          data: {
            start_date: week.start_date,
            end_date: week.end_date,
          },
        });
      }
    }
  }
}

/**
 * Rewrites DAILY / CUSTOM period endpoints onto UTC-noon civil days so
 * PostgreSQL `timestamp` round-trips cannot shift the calendar day used by
 * Panel financiero proration.
 */
async function reconcileFixedRangeCalendarAlignment(
  ownerFilter: OwnerFilter,
  year: number,
  month: number,
  frequency: 'DAILY' | 'CUSTOM',
): Promise<void> {
  const { first, second } = getCalendarFortnightBoundsForMonth(year, month);
  const monthStart = first.start_date;
  const monthEnd = second.end_date;

  const budgets = await prisma.budget.findMany({
    where: { ...ownerFilter, active: true, frequency },
    select: { id: true },
  });
  if (budgets.length === 0) return;

  const canonicalize =
    frequency === 'DAILY' ? canonicalizeDailyPeriod : canonicalizeCustomPeriod;

  for (const budget of budgets) {
    const periods = await prisma.budgetPeriod.findMany({
      where: {
        budget_id: budget.id,
        start_date: { lte: monthEnd },
        end_date: { gte: monthStart },
      },
      select: { id: true, start_date: true, end_date: true },
    });

    for (const period of periods) {
      const canonical = canonicalize(period);
      if (
        period.start_date.getTime() === canonical.start_date.getTime() &&
        period.end_date.getTime() === canonical.end_date.getTime()
      ) {
        continue;
      }
      await prisma.budgetPeriod.update({
        where: { id: period.id },
        data: {
          start_date: canonical.start_date,
          end_date: canonical.end_date,
        },
      });
    }
  }
}

/** Creates missing periods for a month when fortnights exist but no periods overlap yet. */
export async function ensureBudgetPeriodsForMonth(
  ownerFilter: OwnerFilter,
  year: number,
  month: number,
): Promise<void> {
  const [fortnightCount, activeRecurrentCount] = await Promise.all([
    prisma.fortnight.count({
      where: { ...ownerFilter, year, month },
    }),
    prisma.budget.count({
      where: {
        ...ownerFilter,
        active: true,
        recurrent: true,
        frequency: { not: 'CUSTOM' },
      },
    }),
  ]);
  if (fortnightCount === 0) return;

  await reconcileBiweeklyCalendarAlignment(ownerFilter, year, month);
  await reconcileWeeklyCalendarAlignment(ownerFilter, year, month);
  await reconcileFixedRangeCalendarAlignment(ownerFilter, year, month, 'DAILY');
  await reconcileFixedRangeCalendarAlignment(ownerFilter, year, month, 'CUSTOM');

  if (activeRecurrentCount === 0) return;

  const { first, second } = getCalendarFortnightBoundsForMonth(year, month);
  const monthStart = first.start_date;
  const monthEnd = second.end_date;

  const overlappingPeriodCount = await prisma.budgetPeriod.count({
    where: {
      start_date: { lte: monthEnd },
      end_date: { gte: monthStart },
      budget: { ...ownerFilter, active: true },
    },
  });
  if (overlappingPeriodCount > 0) return;

  await generatePeriodsForMonth(year, month, ownerFilter);
}

/**
 * After a template schedule/amount change: drop future periods and any period
 * that still covers "today", then regenerate from the new template window.
 *
 * Deleting only `start_date > today` left the old current window in place when
 * CUSTOM (or other) date ranges changed — e.g. 1–30 ago and 1–31 ago both
 * containing today → duplicate cards in Presupuestos and double-count in Panel.
 */
export async function syncBudgetPeriodsAfterTemplateUpdate(
  budgetId: number,
  frequency: BudgetFrequency,
  budgetDateRange: DateRange | null,
  ownerFilter: OwnerFilter,
  options: { recurrent: boolean; now?: Date },
): Promise<void> {
  const asOf = options.now ?? new Date();
  const { start_date: todayStart, end_date: todayEnd } = activeDayBounds(asOf);

  await prisma.budgetPeriod.deleteMany({
    where: {
      budget_id: budgetId,
      OR: [
        { start_date: { gt: todayEnd } },
        {
          start_date: { lte: todayEnd },
          end_date: { gte: todayStart },
        },
      ],
    },
  });

  if (!budgetDateRange?.start_date || !budgetDateRange.end_date) return;

  await generatePeriodsOnCreate(
    budgetId,
    frequency,
    budgetDateRange,
    ownerFilter,
    { recurrent: options.recurrent, now: asOf },
  );
}

export async function refreshFuturePeriodSnapshots(
  budgetId: number,
  asOf: Date = new Date(),
): Promise<void> {
  if (!prisma.budgetPeriod || typeof prisma.budgetPeriod.findMany !== 'function') return;
  const todayEnd = endOfCalendarDay(todayCalendarDate(asOf));
  const periods = await prisma.budgetPeriod.findMany({
    where: {
      budget_id: budgetId,
      start_date: { gt: todayEnd },
    },
    select: { id: true },
  });
  await Promise.all(periods.map((period) => syncPeriodSnapshot(period.id, budgetId)));
}

export async function listActivePeriods(ownerFilter: OwnerFilter, asOf: Date) {
  const todayYmd = formatCalendarDate(asOf);
  const year = Number(todayYmd.slice(0, 4));
  const month = Number(todayYmd.slice(5, 7));
  await ensureBudgetPeriodsForMonth(ownerFilter, year, month);

  const { start_date: todayStart, end_date: todayEnd } = activeDayBounds(asOf);

  const periods = await prisma.budgetPeriod.findMany({
    where: {
      start_date: { lte: todayEnd },
      end_date: { gte: todayStart },
      budget: { ...ownerFilter, active: true },
    },
    include: {
      budget: {
        include: {
          allocations: {
            include: {
              wallet: { select: { name: true } },
              category: { select: { name: true, icon: true } },
            },
          },
        },
      },
      snapshot: {
        include: {
          allocations: true,
        },
      },
    },
    orderBy: { start_date: 'asc' },
  });

  return Promise.all(
    periods.map((period) => mapBudgetPeriodItem(period, ownerFilter)),
  );
}

type BudgetPeriodWithBudget = {
  id: number;
  start_date: Date;
  end_date: Date;
  budget: {
    id: number;
    name: string;
    frequency: BudgetFrequency;
    total_amount: unknown;
    active: boolean;
    recurrent: boolean;
    allocations?: Array<{
      id: number;
      wallet_id: number;
      category_id: number;
      amount: unknown;
      wallet: { name: string };
      category: { name: string; icon: string | null };
    }>;
  };
  snapshot: null | {
    id: number;
    budget_name: string;
    total_amount: unknown;
    allocations: Array<{
      id: number;
      wallet_id: number;
      wallet_name: string;
      category_id: number;
      category_name: string;
      category_icon: string | null;
      allocated_amount: unknown;
    }>;
  };
};

async function mapBudgetPeriodItem(
  period: BudgetPeriodWithBudget,
  ownerFilter: OwnerFilter,
) {
  const { budget } = period;
  const fallbackAllocations =
    budget.allocations?.map((allocation) => ({
      id: allocation.id,
      wallet_id: allocation.wallet_id,
      wallet_name: allocation.wallet.name,
      category_id: allocation.category_id,
      category_name: allocation.category.name,
      category_icon: allocation.category.icon ?? null,
      allocated_amount: allocation.amount,
    })) ?? [];
  const snapshotAllocations = period.snapshot?.allocations ?? fallbackAllocations;
  const allocationInputs = snapshotAllocations.map((allocation) => ({
    wallet_id: allocation.wallet_id,
    category_id: allocation.category_id,
    amount: Number(allocation.allocated_amount),
  }));

  const spend =
    allocationInputs.length > 0
      ? await computePeriodSpendByAllocations(
          prisma,
          allocationInputs,
          {
            start_date: period.start_date,
            end_date: period.end_date,
          },
          ownerFilter,
        )
      : { total_spent: 0, by_allocation: [] };

  const allocatedAmount = Number(period.snapshot?.total_amount ?? budget.total_amount);
  return {
    period_id: period.id,
    budget_id: budget.id,
    name: period.snapshot?.budget_name ?? budget.name,
    frequency: budget.frequency,
    start_date: period.start_date.toISOString(),
    end_date: period.end_date.toISOString(),
    allocated_amount: allocatedAmount,
    spent_amount: spend.total_spent,
    remaining_amount: allocatedAmount - spend.total_spent,
    active: budget.active,
    recurrent: budget.recurrent,
    allocations: snapshotAllocations.map((a, index) => ({
      id: a.id,
      wallet_id: a.wallet_id,
      wallet_name: a.wallet_name,
      category_id: a.category_id,
      category_name: a.category_name,
      category_icon: a.category_icon ?? null,
      amount: Number(a.allocated_amount),
      spent_amount: spend.by_allocation[index]?.spent_amount ?? 0,
    })),
  };
}

export async function listScheduledPeriods(ownerFilter: OwnerFilter, asOf: Date) {
  const todayEnd = endOfCalendarDay(todayCalendarDate(asOf));
  const periods = await prisma.budgetPeriod.findMany({
    where: {
      start_date: { gt: todayEnd },
      budget: { ...ownerFilter, active: true },
    },
    include: {
      budget: {
        include: {
          allocations: {
            include: {
              wallet: { select: { name: true } },
              category: { select: { name: true, icon: true } },
            },
          },
        },
      },
      snapshot: { include: { allocations: true } },
    },
    orderBy: [{ budget_id: 'asc' }, { start_date: 'asc' }],
  });

  const selected: BudgetPeriodWithBudget[] = [];
  const seenRecurrentBudgetIds = new Set<number>();
  for (const period of periods) {
    if (!period.budget.recurrent) {
      selected.push(period);
      continue;
    }
    if (seenRecurrentBudgetIds.has(period.budget.id)) continue;
    seenRecurrentBudgetIds.add(period.budget.id);
    selected.push(period);
  }

  return Promise.all(selected.map((period) => mapBudgetPeriodItem(period, ownerFilter)));
}

export async function listHistoryPeriods(
  ownerFilter: OwnerFilter,
  year: number,
  month: number,
) {
  const monthStr = String(month).padStart(2, '0');
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthStart = startOfCalendarDay(`${year}-${monthStr}-01`);
  const monthEnd = endOfCalendarDay(`${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`);
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
              wallet: { select: { name: true } },
              category: { select: { name: true, icon: true } },
            },
          },
        },
      },
      snapshot: {
        include: {
          allocations: true,
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
        name: string;
        frequency: string;
        start_date: string;
        end_date: string;
        allocated_amount: number;
        spent_amount: number;
        remaining_amount: number;
        allocations: Array<{
          id: number;
          wallet_id: number;
          wallet_name: string;
          category_id: number;
          category_name: string;
          category_icon: string | null;
          amount: number;
          spent_amount: number;
        }>;
      }>;
    }
  >();

  for (const period of periods) {
    const { budget } = period;
    if (!grouped.has(budget.id)) {
      grouped.set(budget.id, {
        budget_id: budget.id,
        name: period.snapshot?.budget_name ?? budget.name,
        frequency: budget.frequency,
        allocated_amount: Number(period.snapshot?.total_amount ?? budget.total_amount),
        periods: [],
      });
    }

    const snapshotAllocations =
      period.snapshot?.allocations ??
      budget.allocations.map((allocation) => ({
        id: allocation.id,
        wallet_id: allocation.wallet_id,
        wallet_name: allocation.wallet.name,
        category_id: allocation.category_id,
        category_name: allocation.category.name,
        category_icon: allocation.category.icon ?? null,
        allocated_amount: allocation.amount,
      }));
    const allocationInputs = snapshotAllocations.map((a) => ({
      wallet_id: a.wallet_id,
      category_id: a.category_id,
      amount: Number(a.allocated_amount),
    }));

    const spend =
      allocationInputs.length > 0
        ? await computePeriodSpendByAllocations(
            prisma,
            allocationInputs,
            {
              start_date: period.start_date,
              end_date: period.end_date,
            },
            ownerFilter,
          )
        : { total_spent: 0, by_allocation: [] };

    const allocatedAmount = Number(period.snapshot?.total_amount ?? budget.total_amount);
    grouped.get(budget.id)!.periods.push({
      period_id: period.id,
      name: period.snapshot?.budget_name ?? budget.name,
      frequency: budget.frequency,
      start_date: period.start_date.toISOString(),
      end_date: period.end_date.toISOString(),
      allocated_amount: allocatedAmount,
      spent_amount: spend.total_spent,
      remaining_amount: allocatedAmount - spend.total_spent,
      allocations: snapshotAllocations.map((a, index) => ({
        id: a.id,
        wallet_id: a.wallet_id,
        wallet_name: a.wallet_name,
        category_id: a.category_id,
        category_name: a.category_name,
        category_icon: a.category_icon ?? null,
        amount: Number(a.allocated_amount),
        spent_amount: spend.by_allocation[index]?.spent_amount ?? 0,
      })),
    });
  }

  return Array.from(grouped.values());
}

function decimalToNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (
    typeof value === 'object' &&
    value != null &&
    'toNumber' in value &&
    typeof (value as { toNumber: () => number }).toNumber === 'function'
  ) {
    return (value as { toNumber: () => number }).toNumber();
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function mapExpenseRow(expense: {
  id: number;
  description: string;
  amount: unknown;
  payment_date: Date | null;
  created_at: Date;
  is_paid: boolean;
  expense_template_id: number | null;
  credit_installment_current: number | null;
  credit_installment_total: number | null;
  category: { id: number; name: string; icon: string | null } | null;
  wallet: { id: number; name: string; type: string } | null;
}) {
  return {
    id: expense.id,
    description: expense.description,
    amount: decimalToNumber(expense.amount),
    date: formatCalendarDate(expense.payment_date ?? expense.created_at),
    category: expense.category?.name ?? null,
    categoryIcon: expense.category?.icon ?? null,
    paymentMethod: expense.wallet?.name ?? null,
    walletType: expense.wallet?.type ?? null,
    isPaid: expense.is_paid,
    isRecurring: expense.expense_template_id != null,
    creditInstallmentCurrent: expense.credit_installment_current ?? null,
    creditInstallmentTotal: expense.credit_installment_total ?? null,
    categoryId: expense.category?.id ?? null,
    walletId: expense.wallet?.id ?? null,
  };
}

export type BudgetAllocationExpenseGroup = {
  allocation_id: number;
  expenses: ReturnType<typeof mapExpenseRow>[];
};

export async function listBudgetPeriodExpensesByAllocation(
  periodId: number,
  ownerFilter: OwnerFilter,
): Promise<BudgetAllocationExpenseGroup[]> {
  const period = await prisma.budgetPeriod.findFirst({
    where: {
      id: periodId,
      budget: ownerFilter,
    },
    include: {
      snapshot: {
        include: {
          allocations: true,
        },
      },
      budget: {
        include: {
          allocations: true,
        },
      },
    },
  });

  if (!period) {
    throw Object.assign(new Error('Período de presupuesto no encontrado'), { code: 'P2025' });
  }

  const allocations =
    period.snapshot?.allocations ??
    period.budget.allocations.map((allocation) => ({
      id: allocation.id,
      wallet_id: allocation.wallet_id,
      category_id: allocation.category_id,
    }));
  if (allocations.length === 0) {
    return [];
  }

  const expenses = await prisma.expense.findMany({
    where: {
      ...ownerFilter,
      is_paid: true,
      ...whereExcludeCreditInstallments(),
      payment_date: {
        gte: period.start_date,
        lte: period.end_date,
      },
      OR: allocations.map((allocation) => ({
        wallet_id: allocation.wallet_id,
        category_id: allocation.category_id,
      })),
    },
    include: {
      category: { select: { id: true, name: true, icon: true } },
      wallet: { select: { id: true, name: true, type: true } },
    },
    orderBy: [{ payment_date: 'desc' }, { id: 'desc' }],
  });

  const mapped = expenses.map(mapExpenseRow);

  return allocations.map((allocation) => ({
    allocation_id: allocation.id,
    expenses: mapped.filter(
      (expense) =>
        expense.walletId === allocation.wallet_id &&
        expense.categoryId === allocation.category_id,
    ),
  }));
}

/** @deprecated Use listBudgetPeriodExpensesByAllocation */
export async function listBudgetPeriodExpenses(
  periodId: number,
  ownerFilter: OwnerFilter,
) {
  const groups = await listBudgetPeriodExpensesByAllocation(periodId, ownerFilter);
  return groups.flatMap((group) => group.expenses);
}
