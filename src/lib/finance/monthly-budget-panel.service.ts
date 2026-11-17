import { cache } from 'react';
import { ownerMonthKey, requestMemo } from '@/lib/server/request-memo';
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
  computePeriodSpendsByAllocations,
  getPeriodOverlap,
  type DateRange,
  type PeriodSpendRequest,
  type PeriodSpendResult,
} from '@/lib/finance/budget-period-spend';
import { getCalendarFortnightBoundsForMonth } from '@/lib/finance/budget-period-windows';
import { ensureBudgetPeriodsForMonth } from '@/lib/finance/budget-period.service';
import {
  endOfCalendarDay,
  startOfCalendarDay,
  todayCalendarDate,
} from '@/lib/calendar-dates';
import { ANY_WALLET_LABEL } from '@/schemas/budget.schema';
import {
  applyFortnightAdjustment,
  remainingReserve,
  type FortnightAdjustmentInput,
} from '@/lib/finance/budget-fortnight-effective';

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
  walletId: number | null;
  walletName: string;
  walletProviderIconKey: string | null;
  walletAssignee: { id: number; name: string } | null;
  budgeted: number;
  spent: number;
};

const allocationKey = (walletId: number | null, categoryId: number) =>
  `${walletId ?? 'any'}:${categoryId}`;

function walletDisplay(
  walletId: number | null,
  wallet: {
    name: string;
    provider_icon_key: string | null;
    assignee: { id: number; name: string } | null;
  } | null,
): Pick<
  AllocationAgg,
  'walletId' | 'walletName' | 'walletProviderIconKey' | 'walletAssignee'
> {
  return {
    walletId,
    walletName: wallet?.name ?? ANY_WALLET_LABEL,
    walletProviderIconKey: wallet?.provider_icon_key ?? null,
    walletAssignee: wallet?.assignee
      ? { id: wallet.assignee.id, name: wallet.assignee.name }
      : null,
  };
}

async function getMonthlyBudgetPanelImpl(
  ownerFilter: OwnerFilter,
  year: number,
  month: number,
): Promise<MonthlyBudgetPanelResult> {
  await ensureBudgetPeriodsForMonth(ownerFilter, year, month);

  const { first: firstFortnight, second: secondFortnight } =
    getCalendarFortnightBoundsForMonth(year, month);
  const monthStart = firstFortnight.start_date;
  const monthEnd = secondFortnight.end_date;
  const todayYmd = todayCalendarDate();
  const todayStart = startOfCalendarDay(todayYmd);
  const todayEnd = endOfCalendarDay(todayYmd);

  // Active templates contribute all overlapping periods. Deactivated recurrent
  // templates keep only the period that still covers today (current quincena).
  const periods = await prisma.budgetPeriod.findMany({
    where: {
      start_date: { lte: monthEnd },
      end_date: { gte: monthStart },
      OR: [
        { budget: { ...ownerFilter, active: true } },
        {
          budget: { ...ownerFilter, active: false, recurrent: true },
          start_date: { lte: todayEnd },
          end_date: { gte: todayStart },
        },
      ],
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

  // Spend for every period overlapping either quincena in one batch (two
  // queries), then each scope merges its share in period order.
  const scopes = [firstFortnight, secondFortnight];
  const overlapsByScope = scopes.map((scope) =>
    periods.map((period) => getPeriodOverlap(period, scope)),
  );
  const requests: PeriodSpendRequest[] = [];
  const requestIndex = overlapsByScope.map((overlaps) =>
    overlaps.map((overlap, index) => {
      const allocations = periods[index].budget.allocations;
      if (!overlap || allocations.length === 0) return null;
      requests.push({
        allocations: allocations.map((a) => ({
          wallet_id: a.wallet_id,
          category_id: a.category_id,
          amount: Number(a.amount),
        })),
        window: overlap,
      });
      return requests.length - 1;
    }),
  );
  const results =
    requests.length > 0
      ? await computePeriodSpendsByAllocations(prisma, requests, ownerFilter)
      : [];
  const adjustments = await loadMonthAdjustments(ownerFilter, year, month);
  const [first, second] = scopes.map((_, scopeIndex) =>
    buildBudgetScope(
      periods,
      overlapsByScope[scopeIndex],
      requestIndex[scopeIndex].map((i) => (i == null ? null : results[i])),
      adjustments.get(scopeIndex === 0 ? 'FIRST' : 'SECOND') ?? new Map(),
    ),
  );

  return { first, second };
}

/**
 * Request-scoped memo of the monthly budget panel. Report summaries and the
 * panel sidebar invoke this several times per render; `cache` dedupes within
 * one RSC render and `requestMemo` within one GET route request.
 */
const getMonthlyBudgetPanelCached = cache(
  (
    userId: number | null,
    houseId: number | null,
    year: number,
    month: number,
  ) =>
    requestMemo(ownerMonthKey('monthly-budget-panel', userId, houseId, year, month), () =>
      getMonthlyBudgetPanelImpl(
        userId != null
          ? { user_id: userId, house_id: null }
          : { user_id: null, house_id: houseId as number },
        year,
        month,
      ),
    ),
);

/**
 * Presupuesto efectivo por quincena para el sidebar del panel financiero.
 * Gasto por periodo de presupuesto que solapa cada quincena seleccionable.
 */
export function getMonthlyBudgetPanel(
  ownerFilter: OwnerFilter,
  year: number,
  month: number,
): Promise<MonthlyBudgetPanelResult> {
  return getMonthlyBudgetPanelCached(
    ownerFilter.user_id,
    ownerFilter.house_id,
    year,
    month,
  );
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
    budgets: [],
  };
}

type AdjustmentsByBudget = Map<number, FortnightAdjustmentInput>;

/**
 * One-quincena adjustments for the month, by quincena and budget. Keyed by
 * quincena (not period id), so period rebuilds cannot erase them.
 */
export async function loadMonthAdjustments(
  ownerFilter: OwnerFilter,
  year: number,
  month: number,
): Promise<Map<'FIRST' | 'SECOND', AdjustmentsByBudget>> {
  const out = new Map<'FIRST' | 'SECOND', AdjustmentsByBudget>();
  const model = (prisma as { budgetFortnightAdjustment?: { findMany?: unknown } })
    .budgetFortnightAdjustment;
  if (!model || typeof model.findMany !== 'function') return out;
  const rows = await prisma.budgetFortnightAdjustment.findMany({
    where: { ...ownerFilter, year, month },
    include: { allocations: true },
  });
  for (const row of rows) {
    const byBudget = out.get(row.period) ?? new Map();
    byBudget.set(row.budget_id, {
      kind: row.kind,
      note: row.note,
      allocations: row.allocations.map((a) => ({
        wallet_id: a.wallet_id,
        category_id: a.category_id,
        amount: Number(a.amount),
      })),
    });
    out.set(row.period, byBudget);
  }
  return out;
}

type BudgetAgg = {
  budgetId: number;
  name: string;
  frequency: MonthlyBudgetScope['sources'][number]['frequency'];
  templateTotal: number;
  rows: Array<
    Omit<AllocationAgg, 'budgeted' | 'spent'> & {
      templateBudgeted: number;
      spent: number;
    }
  >;
};

function buildBudgetScope(
  periods: BudgetPanelPeriod[],
  overlaps: (DateRange | null)[],
  spends: (PeriodSpendResult | null)[],
  adjustments: AdjustmentsByBudget = new Map(),
): MonthlyBudgetScope {
  // 1. Prorate each budget's template into this quincena (periods in order),
  //    and add up its spend per category.
  const byBudget = new Map<number, BudgetAgg>();
  for (const [index, period] of periods.entries()) {
    const overlap = overlaps[index];
    if (!overlap) continue;
    const { budget } = period;
    let agg = byBudget.get(budget.id);
    if (!agg) {
      agg = {
        budgetId: budget.id,
        name: budget.name,
        frequency:
          budget.frequency as MonthlyBudgetScope['sources'][number]['frequency'],
        templateTotal: 0,
        rows: budget.allocations.map((allocation) => ({
          categoryId: allocation.category_id,
          categoryName: allocation.category.name,
          categoryIcon: allocation.category.icon ?? null,
          ...walletDisplay(allocation.wallet_id, allocation.wallet),
          templateBudgeted: 0,
          spent: 0,
        })),
      };
      byBudget.set(budget.id, agg);
    }
    agg.templateTotal += computeEffectiveAllocated(
      Number(budget.total_amount),
      period,
      overlap,
    );
    for (const [allocIndex, allocation] of budget.allocations.entries()) {
      const row = agg.rows[allocIndex];
      if (!row) continue;
      row.templateBudgeted += computeEffectiveAllocated(
        Number(allocation.amount),
        period,
        overlap,
      );
    }
    const spend = spends[index];
    if (spend == null) continue;
    for (const [allocIndex] of budget.allocations.entries()) {
      const row = agg.rows[allocIndex];
      if (!row) continue;
      row.spent += spend.by_allocation[allocIndex]?.spent_amount ?? 0;
    }
  }

  // 2. Apply this quincena's adjustment per budget, then merge.
  let totalBudget = 0;
  let totalSpent = 0;
  let available = 0;
  const sourceTotals = new Map<
    MonthlyBudgetScope['sources'][number]['frequency'],
    number
  >();
  const allocationTotals = new Map<
    string,
    AllocationAgg & { templateBudgeted: number }
  >();
  const budgets: MonthlyBudgetScope['budgets'] = [];

  for (const agg of byBudget.values()) {
    const adjustment = adjustments.get(agg.budgetId) ?? null;
    const effective = applyFortnightAdjustment(
      agg.rows.map((row) => ({
        wallet_id: row.walletId,
        category_id: row.categoryId,
        budgeted: row.templateBudgeted,
      })),
      adjustment,
    );
    const total = adjustment
      ? effective.reduce((sum, amount) => sum + amount, 0)
      : agg.templateTotal;
    const spent = agg.rows.reduce((sum, row) => sum + row.spent, 0);
    const reserve =
      agg.rows.length > 0
        ? remainingReserve(
            agg.rows.map((row, i) => ({ budgeted: effective[i] ?? 0, spent: row.spent })),
          )
        : Math.max(0, total);

    totalBudget += total;
    totalSpent += spent;
    available += reserve;
    sourceTotals.set(agg.frequency, (sourceTotals.get(agg.frequency) ?? 0) + total);

    budgets.push({
      budgetId: agg.budgetId,
      name: agg.name,
      frequency: agg.frequency,
      templateTotal: agg.templateTotal,
      total,
      spent,
      remaining: reserve,
      adjustment: adjustment
        ? { kind: adjustment.kind, note: adjustment.note ?? null }
        : null,
      categories: agg.rows.map((row, i) => ({
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        walletId: row.walletId,
        templateBudgeted: row.templateBudgeted,
        budgeted: effective[i] ?? 0,
        spent: row.spent,
      })),
    });

    for (const [i, row] of agg.rows.entries()) {
      const key = allocationKey(row.walletId, row.categoryId);
      const prev = allocationTotals.get(key);
      if (prev) {
        prev.budgeted += effective[i] ?? 0;
        prev.templateBudgeted += row.templateBudgeted;
        prev.spent += row.spent;
        continue;
      }
      allocationTotals.set(key, {
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        categoryIcon: row.categoryIcon,
        walletId: row.walletId,
        walletName: row.walletName,
        walletProviderIconKey: row.walletProviderIconKey,
        walletAssignee: row.walletAssignee,
        budgeted: effective[i] ?? 0,
        templateBudgeted: row.templateBudgeted,
        spent: row.spent,
      });
    }
  }

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
        templateBudgeted: row.templateBudgeted,
        spent: row.spent,
        remaining,
        percentUsed:
          row.budgeted > 0 ? Math.round((row.spent / row.budgeted) * 100) : 0,
      };
    })
    .sort(
      (a, b) =>
        b.templateBudgeted - a.templateBudgeted ||
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
    budgets,
  };
}
