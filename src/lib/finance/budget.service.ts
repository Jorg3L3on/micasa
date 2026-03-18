import prisma from '@/lib/prisma';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import type { BudgetFrequency, CreateBudgetInput, AllocationInput } from '@/schemas/budget.schema';

async function computeDateWindow(
  frequency: BudgetFrequency,
  created_at: Date,
  start_date: Date | null,
  end_date: Date | null,
  ownerFilter: OwnerFilter,
): Promise<{ start: Date; end: Date }> {
  switch (frequency) {
    case 'DAILY': {
      const start = new Date(created_at.getFullYear(), created_at.getMonth(), created_at.getDate(), 0, 0, 0, 0);
      const end = new Date(created_at.getFullYear(), created_at.getMonth(), created_at.getDate(), 23, 59, 59, 999);
      return { start, end };
    }
    case 'WEEKLY': {
      const day = created_at.getDay(); // 0 = Sunday
      const diffToSunday = -day;
      const start = new Date(created_at.getFullYear(), created_at.getMonth(), created_at.getDate() + diffToSunday, 0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    case 'BIWEEKLY': {
      const fortnight = await prisma.fortnight.findFirst({
        where: {
          ...ownerFilter,
          start_date: { lte: created_at },
          end_date: { gte: created_at },
        },
      });
      if (fortnight) {
        return { start: fortnight.start_date, end: fortnight.end_date };
      }
      // Fallback: use raw calendar halves if no matching fortnight record
      const d = created_at.getDate();
      const year = created_at.getFullYear();
      const month = created_at.getMonth();
      if (d <= 15) {
        return {
          start: new Date(year, month, 1, 0, 0, 0, 0),
          end: new Date(year, month, 15, 23, 59, 59, 999),
        };
      } else {
        const lastDay = new Date(year, month + 1, 0).getDate();
        return {
          start: new Date(year, month, 16, 0, 0, 0, 0),
          end: new Date(year, month, lastDay, 23, 59, 59, 999),
        };
      }
    }
    case 'CUSTOM': {
      return {
        start: start_date ?? created_at,
        end: end_date ?? created_at,
      };
    }
  }
}

export async function listBudgetsByOwner(ownerFilter: OwnerFilter) {
  const budgets = await prisma.budget.findMany({
    where: ownerFilter,
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
    include: {
      allocations: {
        include: {
          wallet: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
        },
      },
    },
  });

  return Promise.all(
    budgets.map(async (budget) => {
      const window = await computeDateWindow(
        budget.frequency as BudgetFrequency,
        budget.created_at,
        budget.start_date,
        budget.end_date,
        ownerFilter,
      );

      const walletIds = budget.allocations.map((a) => a.wallet_id);
      const categoryIds = budget.allocations.map((a) => a.category_id);
      let spentAmount = 0;

      if (walletIds.length > 0) {
        const agg = await prisma.expense.aggregate({
          where: {
            wallet_id: { in: walletIds },
            category_id: { in: categoryIds },
            payment_date: { gte: window.start, lte: window.end },
          },
          _sum: { amount: true }
        });

        spentAmount = Number(agg._sum.amount ?? 0);
      }

      return {
        id: budget.id,
        name: budget.name,
        allocated_amount: Number(budget.total_amount),
        remaining_amount: Number(budget.total_amount) - spentAmount,
        spent_amount: spentAmount,
        frequency: budget.frequency,
        start_date: budget.start_date?.toISOString() ?? null,
        end_date: budget.end_date?.toISOString() ?? null,
        active: budget.active,
        allocations: budget.allocations.map((a) => ({
          id: a.id,
          wallet_id: a.wallet_id,
          wallet_name: a.wallet.name,
          category_id: a.category_id,
          category_name: a.category.name,
          amount: Number(a.amount),
        })),
      };
    }),
  );
}

export async function createBudget(
  ownerType: 'user' | 'house',
  ownerId: number,
  data: CreateBudgetInput,
) {
  const allocTotal = data.allocations.reduce((sum, a) => sum + Number(a.amount), 0);
  if (allocTotal > Number(data.allocated_amount)) {
    throw Object.assign(new Error('La suma de asignaciones supera el presupuesto total'), { code: 'ALLOC_EXCEEDS_BUDGET' });
  }

  return prisma.$transaction(async (tx) => {
    const budget = await tx.budget.create({
      data: {
        name: data.name,
        total_amount: data.allocated_amount,
        frequency: data.frequency,
        start_date: data.start_date ? new Date(data.start_date) : null,
        end_date: data.end_date ? new Date(data.end_date) : null,
        active: true,
        user_id: ownerType === 'user' ? ownerId : null,
        house_id: ownerType === 'house' ? ownerId : null,
      },
    });

    await tx.budgetAllocation.createMany({
      data: data.allocations.map((a) => ({
        budget_id: budget.id,
        wallet_id: a.wallet_id,
        category_id: a.category_id,
        amount: a.amount,
      })),
    });

    return budget;
  });
}

export async function updateBudgetAllocations(
  budgetId: number,
  ownerFilter: OwnerFilter,
  allocations: AllocationInput[],
) {
  const budget = await prisma.budget.findFirst({
    where: { id: budgetId, ...ownerFilter },
  });
  if (!budget) {
    throw Object.assign(new Error('Presupuesto no encontrado'), { code: 'P2025' });
  }

  const allocTotal = allocations.reduce((sum, a) => sum + Number(a.amount), 0);
  if (allocTotal > Number(budget.total_amount)) {
    throw Object.assign(new Error('La suma de asignaciones supera el presupuesto total'), { code: 'ALLOC_EXCEEDS_BUDGET' });
  }

  return prisma.$transaction(async (tx) => {
    await tx.budgetAllocation.deleteMany({ where: { budget_id: budgetId } });
    await tx.budgetAllocation.createMany({
      data: allocations.map((a) => ({
        budget_id: budgetId,
        wallet_id: a.wallet_id,
        category_id: a.category_id,
        amount: a.amount,
      })),
    });
    return tx.budget.findUnique({ where: { id: budgetId } });
  });
}

export async function deleteBudget(budgetId: number, ownerFilter: OwnerFilter) {
  const budget = await prisma.budget.findFirst({
    where: { id: budgetId, ...ownerFilter },
  });
  if (!budget) {
    throw Object.assign(new Error('Presupuesto no encontrado'), { code: 'P2025' });
  }
  await prisma.budget.delete({ where: { id: budgetId } });
}
