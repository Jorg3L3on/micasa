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
import {
  computePeriodSpendByAllocations,
  type DateRange,
} from '@/lib/finance/budget-period-spend';
import {
  computeBudgetPeriodWindowsForFortnight,
} from '@/lib/finance/budget-period-windows';

export { computeBudgetPeriodWindowsForFortnight as computeBudgetWindows } from '@/lib/finance/budget-period-windows';

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

  const windows = computeBudgetPeriodWindowsForFortnight(frequency, nextFortnight);
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
  });

  let total = 0;
  for (const budget of budgets) {
    if (budget.frequency === 'CUSTOM') continue;
    for (const fortnight of fortnights) {
      const windows = computeBudgetPeriodWindowsForFortnight(
        budget.frequency as BudgetFrequency,
        fortnight,
      );
      total += await insertPeriods(budget.id, windows);
    }
  }

  return { total };
}

export async function listActivePeriods(ownerFilter: OwnerFilter, asOf: Date) {
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
              wallet: { select: { id: true, name: true } },
              category: { select: { id: true, name: true, icon: true } },
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
      const allocationInputs = budget.allocations.map((a) => ({
        wallet_id: a.wallet_id,
        category_id: a.category_id,
        amount: Number(a.amount),
      }));

      const spend =
        allocationInputs.length > 0
          ? await computePeriodSpendByAllocations(prisma, allocationInputs, {
              start_date: period.start_date,
              end_date: period.end_date,
            })
          : { total_spent: 0, by_allocation: [] };

      const allocatedAmount = Number(budget.total_amount);
      return {
        period_id: period.id,
        budget_id: budget.id,
        name: budget.name,
        frequency: budget.frequency,
        start_date: period.start_date.toISOString(),
        end_date: period.end_date.toISOString(),
        allocated_amount: allocatedAmount,
        spent_amount: spend.total_spent,
        remaining_amount: allocatedAmount - spend.total_spent,
        active: budget.active,
        recurrent: budget.recurrent,
        allocations: budget.allocations.map((a, index) => ({
          id: a.id,
          wallet_id: a.wallet_id,
          wallet_name: a.wallet.name,
          category_id: a.category_id,
          category_name: a.category.name,
          category_icon: a.category.icon ?? null,
          amount: Number(a.amount),
          spent_amount: spend.by_allocation[index]?.spent_amount ?? 0,
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
              wallet: { select: { id: true, name: true } },
              category: { select: { id: true, name: true, icon: true } },
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
        name: budget.name,
        frequency: budget.frequency,
        allocated_amount: Number(budget.total_amount),
        periods: [],
      });
    }

    const allocationInputs = budget.allocations.map((a) => ({
      wallet_id: a.wallet_id,
      category_id: a.category_id,
      amount: Number(a.amount),
    }));

    const spend =
      allocationInputs.length > 0
        ? await computePeriodSpendByAllocations(prisma, allocationInputs, {
            start_date: period.start_date,
            end_date: period.end_date,
          })
        : { total_spent: 0, by_allocation: [] };

    const allocatedAmount = Number(budget.total_amount);
    grouped.get(budget.id)!.periods.push({
      period_id: period.id,
      name: budget.name,
      frequency: budget.frequency,
      start_date: period.start_date.toISOString(),
      end_date: period.end_date.toISOString(),
      allocated_amount: allocatedAmount,
      spent_amount: spend.total_spent,
      remaining_amount: allocatedAmount - spend.total_spent,
      allocations: budget.allocations.map((a, index) => ({
        id: a.id,
        wallet_id: a.wallet_id,
        wallet_name: a.wallet.name,
        category_id: a.category_id,
        category_name: a.category.name,
        category_icon: a.category.icon ?? null,
        amount: Number(a.amount),
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

  const allocations = period.budget.allocations;
  if (allocations.length === 0) {
    return [];
  }

  const expenses = await prisma.expense.findMany({
    where: {
      ...ownerFilter,
      is_paid: true,
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
