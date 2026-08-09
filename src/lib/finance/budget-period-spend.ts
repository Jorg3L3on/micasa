import type { Prisma } from '@/generated/prisma/client';
import type { PrismaClient } from '@/generated/prisma/client';
import { formatCalendarDate } from '@/lib/calendar-dates';
import { whereExcludeCreditInstallments } from '@/lib/finance/expense-planning-scope';
import type { OwnerFilter } from '@/lib/server/get-owner-context';

export type DateRange = { start_date: Date; end_date: Date };

export type BudgetAllocationSpendInput = {
  wallet_id: number;
  category_id: number;
  amount: number;
};

export type AllocationSpendResult = {
  spent_amount: number;
};

export type PeriodSpendResult = {
  total_spent: number;
  by_allocation: AllocationSpendResult[];
};

/** Inclusive civil-day count in Mexico City. */
export function daysInclusiveWallClock(start: Date, end: Date): number {
  const [sy, sm, sd] = formatCalendarDate(start).split('-').map(Number);
  const [ey, em, ed] = formatCalendarDate(end).split('-').map(Number);
  const startDay = Date.UTC(sy, sm - 1, sd);
  const endDay = Date.UTC(ey, em - 1, ed);
  return Math.floor((endDay - startDay) / 86_400_000) + 1;
}

export function getPeriodOverlap(
  period: DateRange,
  scope: DateRange,
): DateRange | null {
  const start =
    period.start_date > scope.start_date ? period.start_date : scope.start_date;
  const end =
    period.end_date < scope.end_date ? period.end_date : scope.end_date;
  if (start > end) return null;
  return { start_date: start, end_date: end };
}

export function getOverlapRatio(period: DateRange, overlap: DateRange): number {
  const periodDays = daysInclusiveWallClock(period.start_date, period.end_date);
  const overlapDays = daysInclusiveWallClock(overlap.start_date, overlap.end_date);
  if (periodDays <= 0) return 0;
  return overlapDays / periodDays;
}

export function computeEffectiveAllocated(
  totalAmount: number,
  period: DateRange,
  overlap: DateRange,
): number {
  return totalAmount * getOverlapRatio(period, overlap);
}

type ExpenseClient = Pick<PrismaClient, 'expense'>;
type CategoryClient = Pick<PrismaClient, 'category'>;

/**
 * For each allocation category id, include the id itself plus direct children
 * so parent allocations roll up subcategory spend.
 */
export async function resolveCategoryRollupIds(
  db: CategoryClient,
  categoryIds: number[],
): Promise<Map<number, number[]>> {
  const unique = [...new Set(categoryIds)];
  const map = new Map<number, number[]>();
  for (const id of unique) {
    map.set(id, [id]);
  }
  if (unique.length === 0) return map;

  const children = await db.category.findMany({
    where: { parent_id: { in: unique } },
    select: { id: true, parent_id: true },
  });
  for (const child of children) {
    if (child.parent_id == null) continue;
    const list = map.get(child.parent_id) ?? [child.parent_id];
    list.push(child.id);
    map.set(child.parent_id, list);
  }
  return map;
}

/** Filters for budget spend: paid only, owner-scoped, no TC installment cuotas. */
export function buildBudgetSpendExpenseWhere(
  ownerFilter: OwnerFilter,
  allocation: Pick<BudgetAllocationSpendInput, 'wallet_id' | 'category_id'>,
  window: DateRange,
  rollupCategoryIds?: number[],
): Prisma.ExpenseWhereInput {
  const categoryIds = rollupCategoryIds ?? [allocation.category_id];
  return {
    ...ownerFilter,
    is_paid: true,
    wallet_id: allocation.wallet_id,
    category_id:
      categoryIds.length === 1
        ? categoryIds[0]
        : { in: categoryIds },
    payment_date: { gte: window.start_date, lte: window.end_date },
    ...whereExcludeCreditInstallments(),
  };
}

/** Sum paid expenses per wallet+category allocation (parent rolls up children). */
export async function computePeriodSpendByAllocations(
  db: ExpenseClient & Partial<CategoryClient>,
  allocations: BudgetAllocationSpendInput[],
  window: DateRange,
  ownerFilter: OwnerFilter,
): Promise<PeriodSpendResult> {
  if (allocations.length === 0) {
    return { total_spent: 0, by_allocation: [] };
  }

  const rollupMap =
    db.category != null
      ? await resolveCategoryRollupIds(
          { category: db.category },
          allocations.map((a) => a.category_id),
        )
      : new Map(
          allocations.map((a) => [a.category_id, [a.category_id]] as const),
        );

  const allCategoryIds = [
    ...new Set(
      allocations.flatMap((a) => rollupMap.get(a.category_id) ?? [a.category_id]),
    ),
  ];

  const grouped = await db.expense.groupBy({
    by: ['wallet_id', 'category_id'],
    where: {
      ...ownerFilter,
      is_paid: true,
      wallet_id: { in: [...new Set(allocations.map((a) => a.wallet_id))] },
      category_id: { in: allCategoryIds },
      payment_date: { gte: window.start_date, lte: window.end_date },
      ...whereExcludeCreditInstallments(),
    },
    _sum: { amount: true },
  });

  const spentByPair = new Map(
    grouped.map((row) => [
      `${row.wallet_id}|${row.category_id}`,
      Number(row._sum.amount ?? 0),
    ]),
  );

  let total_spent = 0;
  const by_allocation: AllocationSpendResult[] = allocations.map(
    (allocation) => {
      const ids = rollupMap.get(allocation.category_id) ?? [
        allocation.category_id,
      ];
      const spent_amount = ids.reduce(
        (sum, categoryId) =>
          sum +
          (spentByPair.get(`${allocation.wallet_id}|${categoryId}`) ?? 0),
        0,
      );
      total_spent += spent_amount;
      return { spent_amount };
    },
  );

  return { total_spent, by_allocation };
}
