import prisma from '@/lib/prisma';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import type { MonthlyBudgetPanelResult } from '@/types/monthly-budget-panel';

export type { MonthlyBudgetPanelResult } from '@/types/monthly-budget-panel';

/**
 * Presupuesto del mes para el sidebar del panel financiero.
 * Gasto por periodo de presupuesto que solapa el mes calendario (misma lógica que historial).
 */
export async function getMonthlyBudgetPanel(
  ownerFilter: OwnerFilter,
  year: number,
  month: number,
): Promise<MonthlyBudgetPanelResult> {
  const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

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
    return { totalBudget: 0, spent: 0, available: 0, categories: [] };
  }

  const budgetTotals = new Map<number, number>();
  let totalSpent = 0;
  const categorySpent = new Map<
    number,
    { name: string; icon: string | null; spent: number }
  >();

  for (const period of periods) {
    const { budget } = period;
    if (!budgetTotals.has(budget.id)) {
      budgetTotals.set(budget.id, Number(budget.total_amount));
    }

    const walletIds = [
      ...new Set(budget.allocations.map((a) => a.wallet_id)),
    ];
    const categoryIds = budget.allocations.map((a) => a.category_id);

    if (walletIds.length === 0) continue;

    const expenses = await prisma.expense.findMany({
      where: {
        wallet_id: { in: walletIds },
        category_id: { in: categoryIds },
        payment_date: { gte: period.start_date, lte: period.end_date },
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

  const totalBudget = Array.from(budgetTotals.values()).reduce(
    (sum, n) => sum + n,
    0,
  );
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
  };
}
