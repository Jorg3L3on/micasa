import prisma from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma/client';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import type {
  MonthlyBudgetAllocationRow,
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
            wallet: {
              select: {
                id: true;
                name: true;
                provider_icon_key: true;
                assignee: { select: { id: true; name: true } };
              };
            };
          };
        };
      };
    };
  };
}>;

type AllocationAgg = {
  categoryId: number;
  categoryName: string;
  categoryIcon: string | null;
  walletId: number;
  walletName: string;
  walletProviderIconKey: string | null;
  walletAssignee: { id: number; name: string } | null;
  budgeted: number;
  spent: number;
};

const allocationKey = (walletId: number, categoryId: number) =>
  `${walletId}:${categoryId}`;

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
              wallet: {
                select: {
                  id: true,
                  name: true,
                  provider_icon_key: true,
                  assignee: { select: { id: true, name: true } },
                },
              },
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
    allocations: [],
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
  const allocationTotals = new Map<string, AllocationAgg>();

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

  const upsertAllocation = (
    key: string,
    seed: Omit<AllocationAgg, 'budgeted' | 'spent'> & {
      budgeted?: number;
      spent?: number;
    },
  ) => {
    const prev = allocationTotals.get(key);
    if (prev) {
      prev.budgeted += seed.budgeted ?? 0;
      prev.spent += seed.spent ?? 0;
      return;
    }
    allocationTotals.set(key, {
      categoryId: seed.categoryId,
      categoryName: seed.categoryName,
      categoryIcon: seed.categoryIcon,
      walletId: seed.walletId,
      walletName: seed.walletName,
      walletProviderIconKey: seed.walletProviderIconKey,
      walletAssignee: seed.walletAssignee,
      budgeted: seed.budgeted ?? 0,
      spent: seed.spent ?? 0,
    });
  };

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
      upsertAllocation(allocationKey(allocation.wallet_id, allocation.category_id), {
        categoryId: allocation.category_id,
        categoryName: allocation.category.name,
        categoryIcon: allocation.category.icon ?? null,
        walletId: allocation.wallet_id,
        walletName: allocation.wallet.name,
        walletProviderIconKey: allocation.wallet.provider_icon_key ?? null,
        walletAssignee: allocation.wallet.assignee
          ? {
              id: allocation.wallet.assignee.id,
              name: allocation.wallet.assignee.name,
            }
          : null,
        budgeted,
      });
    }

    const spend = spends[index];
    if (spend == null) continue;

    totalSpent += spend.total_spent;

    for (const [allocIndex, allocation] of budget.allocations.entries()) {
      const amount = spend.by_allocation[allocIndex]?.spent_amount ?? 0;
      if (amount <= 0) continue;
      upsertAllocation(allocationKey(allocation.wallet_id, allocation.category_id), {
        categoryId: allocation.category_id,
        categoryName: allocation.category.name,
        categoryIcon: allocation.category.icon ?? null,
        walletId: allocation.wallet_id,
        walletName: allocation.wallet.name,
        walletProviderIconKey: allocation.wallet.provider_icon_key ?? null,
        walletAssignee: allocation.wallet.assignee
          ? {
              id: allocation.wallet.assignee.id,
              name: allocation.wallet.assignee.name,
            }
          : null,
        spent: amount,
      });
    }
  }

  const available = Math.max(0, totalBudget - totalSpent);

  const allocations: MonthlyBudgetAllocationRow[] = Array.from(
    allocationTotals.values(),
  )
    .map((row) => {
      const remaining = row.budgeted - row.spent;
      return {
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        categoryIcon: row.categoryIcon,
        walletId: row.walletId,
        walletName: row.walletName,
        walletProviderIconKey: row.walletProviderIconKey,
        walletAssignee: row.walletAssignee,
        budgeted: row.budgeted,
        spent: row.spent,
        remaining,
        percentUsed:
          row.budgeted > 0 ? Math.round((row.spent / row.budgeted) * 100) : 0,
      };
    })
    .sort(
      (a, b) =>
        b.budgeted - a.budgeted ||
        a.categoryName.localeCompare(b.categoryName, 'es') ||
        a.walletName.localeCompare(b.walletName, 'es'),
    );

  return {
    totalBudget,
    spent: totalSpent,
    available,
    allocations,
    sources: Array.from(sourceTotals.entries())
      .map(([frequency, sourceTotal]) => ({
        frequency,
        totalBudget: sourceTotal,
      }))
      .sort((a, b) => b.totalBudget - a.totalBudget),
  };
}
