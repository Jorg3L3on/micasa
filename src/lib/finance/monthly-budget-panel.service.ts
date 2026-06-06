import prisma from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma/client';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import type {
  MonthlyBudgetPanelResult,
  MonthlyBudgetScope,
} from '@/types/monthly-budget-panel';

export type { MonthlyBudgetPanelResult } from '@/types/monthly-budget-panel';

type DateRange = { start_date: Date; end_date: Date };
type BudgetPanelPeriod = Prisma.BudgetPeriodGetPayload<{
  include: {
    budget: {
      include: {
        allocations: {
          include: {
            category: { select: { id: true; name: true; icon: true } };
          };
        };
      };
    };
  };
}>;

/**
 * Presupuesto efectivo por quincena para el sidebar del panel financiero.
 * Gasto por periodo de presupuesto que solapa cada quincena seleccionable.
 */
export async function getMonthlyBudgetPanel(
  ownerFilter: OwnerFilter,
  year: number,
  month: number,
): Promise<MonthlyBudgetPanelResult> {
  const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
  const firstFortnight = {
    start_date: monthStart,
    end_date: new Date(year, month - 1, 15, 23, 59, 59, 999),
  };
  const secondFortnight = {
    start_date: new Date(year, month - 1, 16, 0, 0, 0, 0),
    end_date: monthEnd,
  };

  const periods = await prisma.budgetPeriod.findMany({
    where: {
      start_date: { lte: monthEnd },
      end_date: { gte: monthStart },
      budget: { ...ownerFilter, active: true },
    },
    include: {
      budget: {
        include: {
          allocations: {
            include: {
              category: { select: { id: true, name: true, icon: true } },
            },
          },
        },
      },
    },
    orderBy: [{ budget_id: 'asc' }, { start_date: 'asc' }],
  });

  if (periods.length === 0) {
    return { first: emptyScope(), second: emptyScope() };
  }

  const first = await buildBudgetScope(periods, firstFortnight);
  const second = await buildBudgetScope(periods, secondFortnight);

  return { first, second };
}

function emptyScope(): MonthlyBudgetScope {
  return {
    totalBudget: 0,
    spent: 0,
    available: 0,
    categories: [],
    sources: [],
  };
}

async function buildBudgetScope(
  periods: BudgetPanelPeriod[],
  scope: DateRange,
): Promise<MonthlyBudgetScope> {
  let totalBudget = 0;
  let totalSpent = 0;
  const sourceTotals = new Map<
    MonthlyBudgetScope['sources'][number]['frequency'],
    number
  >();
  const categorySpent = new Map<
    number,
    { name: string; icon: string | null; spent: number }
  >();

  for (const period of periods) {
    const overlap = getOverlap(period, scope);
    if (!overlap) continue;

    const { budget } = period;
    const allocatedAmount =
      Number(budget.total_amount) * getOverlapRatio(period, overlap);
    totalBudget += allocatedAmount;
    const frequency =
      budget.frequency as MonthlyBudgetScope['sources'][number]['frequency'];
    sourceTotals.set(
      frequency,
      (sourceTotals.get(frequency) ?? 0) + allocatedAmount,
    );

    const walletIds = [
      ...new Set(budget.allocations.map((a) => a.wallet_id)),
    ];
    const categoryIds = budget.allocations.map((a) => a.category_id);

    if (walletIds.length === 0 || categoryIds.length === 0) continue;

    const expenses = await prisma.expense.findMany({
      where: {
        wallet_id: { in: walletIds },
        category_id: { in: categoryIds },
        payment_date: { gte: overlap.start_date, lte: overlap.end_date },
      },
      select: { amount: true, category_id: true },
    });

    for (const expense of expenses) {
      const amount = Number(expense.amount);
      totalSpent += amount;
      const catId = expense.category_id;
      if (catId == null) continue;
      const alloc = budget.allocations.find((a) => a.category_id === catId);
      const meta = alloc?.category;
      if (!meta) continue;
      const prev = categorySpent.get(catId);
      if (prev) {
        prev.spent += amount;
      } else {
        categorySpent.set(catId, {
          name: meta.name,
          icon: meta.icon ?? null,
          spent: amount,
        });
      }
    }
  }

  const available = Math.max(0, totalBudget - totalSpent);

  const categories = Array.from(categorySpent.entries())
    .map(([id, row]) => ({
      id,
      name: row.name,
      icon: row.icon,
      spent: row.spent,
      percentOfBudget:
        totalBudget > 0 ? Math.round((row.spent / totalBudget) * 100) : 0,
    }))
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 6);

  return {
    totalBudget,
    spent: totalSpent,
    available,
    categories,
    sources: Array.from(sourceTotals.entries())
      .map(([frequency, sourceTotal]) => ({
        frequency,
        totalBudget: sourceTotal,
      }))
      .sort((a, b) => b.totalBudget - a.totalBudget),
  };
}

function getOverlap(period: DateRange, scope: DateRange): DateRange | null {
  const start =
    period.start_date > scope.start_date ? period.start_date : scope.start_date;
  const end =
    period.end_date < scope.end_date ? period.end_date : scope.end_date;
  if (start > end) return null;
  return { start_date: start, end_date: end };
}

function getOverlapRatio(period: DateRange, overlap: DateRange): number {
  const periodDays = daysInclusive(period.start_date, period.end_date);
  const overlapDays = daysInclusive(overlap.start_date, overlap.end_date);
  if (periodDays <= 0) return 0;
  return overlapDays / periodDays;
}

function daysInclusive(start: Date, end: Date): number {
  const startDay = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  const endDay = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.floor((endDay - startDay) / 86_400_000) + 1;
}
