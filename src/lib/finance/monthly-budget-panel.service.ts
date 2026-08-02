import prisma from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma/client';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import type {
  MonthlyBudgetPanelResult,
  MonthlyBudgetScope,
} from '@/types/monthly-budget-panel';
import {
  computeEffectiveAllocated,
  computePeriodSpendByAllocations,
  getPeriodOverlap,
  type DateRange,
} from '@/lib/finance/budget-period-spend';
import { getCalendarFortnightBoundsForMonth } from '@/lib/finance/budget-period-windows';
import { ensureBudgetPeriodsForMonth } from '@/lib/finance/budget-period.service';

export type { MonthlyBudgetPanelResult } from '@/types/monthly-budget-panel';

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
  await ensureBudgetPeriodsForMonth(ownerFilter, year, month);

  const { first: firstFortnight, second: secondFortnight } =
    getCalendarFortnightBoundsForMonth(year, month);
  const monthStart = firstFortnight.start_date;
  const monthEnd = secondFortnight.end_date;

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

  const [first, second] = await Promise.all([
    buildBudgetScope(periods, firstFortnight, ownerFilter),
    buildBudgetScope(periods, secondFortnight, ownerFilter),
  ]);

  return { first, second };
}

/**
 * Resto del presupuesto de la quincena (`available` = total − spent).
 * Se suma al compromiso del resumen sin recontar lo ya reflejado en Pagado:
 * p. ej. sobre $3,000 con $1,200 gastados → cuenta $1,800 (total efectivo $3,000).
 */
export async function getFortnightPlanningBudgetRemaining(
  ownerFilter: OwnerFilter,
  year: number,
  month: number,
  period: 'FIRST' | 'SECOND',
): Promise<number> {
  const panel = await getMonthlyBudgetPanel(ownerFilter, year, month);
  return period === 'FIRST' ? panel.first.available : panel.second.available;
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
  ownerFilter: OwnerFilter,
): Promise<MonthlyBudgetScope> {
  let totalBudget = 0;
  let totalSpent = 0;
  const sourceTotals = new Map<
    MonthlyBudgetScope['sources'][number]['frequency'],
    number
  >();
  const categoryTotals = new Map<
    number,
    { name: string; icon: string | null; budgeted: number; spent: number }
  >();

  // Prefetch spend queries concurrently; merge below stays in period order so
  // totals accumulate exactly as before.
  const overlaps = periods.map((period) => getPeriodOverlap(period, scope));
  const spends = await Promise.all(
    periods.map((period, index) => {
      const overlap = overlaps[index];
      if (!overlap || period.budget.allocations.length === 0) return null;
      return computePeriodSpendByAllocations(
        prisma,
        period.budget.allocations.map((a) => ({
          wallet_id: a.wallet_id,
          category_id: a.category_id,
          amount: Number(a.amount),
        })),
        overlap,
        ownerFilter,
      );
    }),
  );

  for (const [index, period] of periods.entries()) {
    const overlap = overlaps[index];
    if (!overlap) continue;

    const { budget } = period;
    const allocatedAmount = computeEffectiveAllocated(
      Number(budget.total_amount),
      period,
      overlap,
    );
    totalBudget += allocatedAmount;
    const frequency =
      budget.frequency as MonthlyBudgetScope['sources'][number]['frequency'];
    sourceTotals.set(
      frequency,
      (sourceTotals.get(frequency) ?? 0) + allocatedAmount,
    );

    for (const allocation of budget.allocations) {
      const budgeted = computeEffectiveAllocated(
        Number(allocation.amount),
        period,
        overlap,
      );
      const catId = allocation.category_id;
      const meta = allocation.category;
      const prev = categoryTotals.get(catId);
      if (prev) {
        prev.budgeted += budgeted;
      } else {
        categoryTotals.set(catId, {
          name: meta.name,
          icon: meta.icon ?? null,
          budgeted,
          spent: 0,
        });
      }
    }

    const spend = spends[index];
    if (spend == null) continue;

    totalSpent += spend.total_spent;

    for (const [index, allocation] of budget.allocations.entries()) {
      const amount = spend.by_allocation[index]?.spent_amount ?? 0;
      if (amount <= 0) continue;
      const catId = allocation.category_id;
      const meta = allocation.category;
      const prev = categoryTotals.get(catId);
      if (prev) {
        prev.spent += amount;
      } else {
        categoryTotals.set(catId, {
          name: meta.name,
          icon: meta.icon ?? null,
          budgeted: 0,
          spent: amount,
        });
      }
    }
  }

  const available = Math.max(0, totalBudget - totalSpent);

  const categories = Array.from(categoryTotals.entries())
    .filter(([, row]) => row.spent > 0)
    .map(([id, row]) => {
      const remaining = row.budgeted - row.spent;
      return {
        id,
        name: row.name,
        icon: row.icon,
        budgeted: row.budgeted,
        spent: row.spent,
        remaining,
        percentUsed:
          row.budgeted > 0 ? Math.round((row.spent / row.budgeted) * 100) : 0,
        percentOfBudget:
          totalBudget > 0 ? Math.round((row.spent / totalBudget) * 100) : 0,
      };
    })
    .sort((a, b) => b.percentUsed - a.percentUsed || b.spent - a.spent)
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
