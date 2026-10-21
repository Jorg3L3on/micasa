import prisma from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma/client';
import { endOfCalendarDay, startOfCalendarDay } from '@/lib/calendar-dates';
import type { OwnerFilter } from '@/lib/server/get-owner-context';

export type ExpenseListFilters = {
  /** Inclusive civil range, YYYY-MM-DD (Mexico City). */
  from: string;
  to: string;
  walletId?: number;
  categoryId?: number;
};

export type ExpenseTotals = {
  by_wallet: Record<string, number>;
  by_category: Record<string, number>;
};

const NO_WALLET = 'Sin billetera';
const NO_CATEGORY = 'Sin categoría';

/** Expenses dated in the range; undated rows fall back to their creation day. */
const buildExpenseWhere = (
  ownerFilter: OwnerFilter,
  filters: ExpenseListFilters,
): Prisma.ExpenseWhereInput => {
  const fromDate = startOfCalendarDay(filters.from);
  const toDate = endOfCalendarDay(filters.to);
  return {
    ...ownerFilter,
    OR: [
      { payment_date: { gte: fromDate, lte: toDate } },
      { AND: [{ payment_date: null }, { created_at: { gte: fromDate, lte: toDate } }] },
    ],
    ...(filters.walletId != null ? { wallet_id: filters.walletId } : {}),
    ...(filters.categoryId != null ? { category_id: filters.categoryId } : {}),
  };
};

const addTo = (totals: Record<string, number>, key: string, amount: number) => {
  totals[key] = (totals[key] ?? 0) + amount;
};

/**
 * One page of expenses plus totals by wallet and category over the whole
 * range. Totals come from a single `groupBy` on (wallet, category); names are
 * looked up for the ids it returns.
 */
export async function listExpensesWithTotals(
  ownerFilter: OwnerFilter,
  filters: ExpenseListFilters,
  page: { limit: number; offset: number },
) {
  const where = buildExpenseWhere(ownerFilter, filters);

  const [totalCount, expenses, groups] = await Promise.all([
    prisma.expense.count({ where }),
    prisma.expense.findMany({
      where,
      include: {
        wallet: { select: { id: true, name: true, type: true } },
        category: { select: { id: true, name: true } },
      },
      orderBy: [{ payment_date: 'desc' }, { created_at: 'desc' }],
      skip: page.offset,
      take: page.limit,
    }),
    prisma.expense.groupBy({
      by: ['wallet_id', 'category_id'],
      where,
      _sum: { amount: true },
    }),
  ]);

  const walletIds = [...new Set(groups.flatMap((g) => (g.wallet_id == null ? [] : [g.wallet_id])))];
  const categoryIds = [
    ...new Set(groups.flatMap((g) => (g.category_id == null ? [] : [g.category_id]))),
  ];
  const [wallets, categories] = await Promise.all([
    walletIds.length
      ? prisma.wallet.findMany({ where: { id: { in: walletIds } }, select: { id: true, name: true } })
      : [],
    categoryIds.length
      ? prisma.category.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true },
        })
      : [],
  ]);
  const walletName = new Map(wallets.map((w) => [w.id, w.name]));
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  const totals: ExpenseTotals = { by_wallet: {}, by_category: {} };
  for (const group of groups) {
    const amount = Number(group._sum.amount ?? 0);
    addTo(
      totals.by_wallet,
      (group.wallet_id != null && walletName.get(group.wallet_id)) || NO_WALLET,
      amount,
    );
    addTo(
      totals.by_category,
      (group.category_id != null && categoryName.get(group.category_id)) || NO_CATEGORY,
      amount,
    );
  }

  const totalsInPage: ExpenseTotals = { by_wallet: {}, by_category: {} };
  for (const expense of expenses) {
    addTo(totalsInPage.by_wallet, expense.wallet?.name ?? NO_WALLET, Number(expense.amount));
    addTo(totalsInPage.by_category, expense.category?.name ?? NO_CATEGORY, Number(expense.amount));
  }

  return { totalCount, expenses, totals, totalsInPage };
}
