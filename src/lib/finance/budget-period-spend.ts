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

/** Filters for budget spend: paid only, owner-scoped, no TC installment cuotas. */
export function buildBudgetSpendExpenseWhere(
  ownerFilter: OwnerFilter,
  allocation: Pick<BudgetAllocationSpendInput, 'wallet_id' | 'category_id'>,
  window: DateRange,
): Prisma.ExpenseWhereInput {
  return {
    ...ownerFilter,
    is_paid: true,
    wallet_id: allocation.wallet_id,
    category_id: allocation.category_id,
    payment_date: { gte: window.start_date, lte: window.end_date },
    ...whereExcludeCreditInstallments(),
  };
}

/** Sum paid expenses per wallet+category pair (no cross-product double counting). */
export async function computePeriodSpendByAllocations(
  db: ExpenseClient,
  allocations: BudgetAllocationSpendInput[],
  window: DateRange,
  ownerFilter: OwnerFilter,
): Promise<PeriodSpendResult> {
  const by_allocation: AllocationSpendResult[] = [];
  let total_spent = 0;

  for (const allocation of allocations) {
    const agg = await db.expense.aggregate({
      where: buildBudgetSpendExpenseWhere(ownerFilter, allocation, window),
      _sum: { amount: true },
    });
    const spent_amount = Number(agg._sum.amount ?? 0);
    total_spent += spent_amount;
    by_allocation.push({ spent_amount });
  }

  return { total_spent, by_allocation };
}
