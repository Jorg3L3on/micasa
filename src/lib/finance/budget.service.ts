import prisma from '@/lib/prisma';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import type { BudgetFrequency, CreateBudgetInput, AllocationInput } from '@/schemas/budget.schema';
import { generatePeriodsOnCreate } from '@/lib/finance/budget-period.service';

export async function listBudgetsByOwner(ownerFilter: OwnerFilter) {
  const budgets = await prisma.budget.findMany({
    where: ownerFilter,
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
    include: {
      allocations: {
        include: {
          wallet: { select: { id: true, name: true } },
          category: { select: { id: true, name: true, icon: true } },
        },
      },
    },
  });

  return budgets.map((budget) => ({
    id: budget.id,
    name: budget.name,
    allocated_amount: Number(budget.total_amount),
    frequency: budget.frequency,
    start_date: budget.start_date?.toISOString() ?? null,
    end_date: budget.end_date?.toISOString() ?? null,
    active: budget.active,
    recurrent: budget.recurrent,
    allocations: budget.allocations.map((a) => ({
      id: a.id,
      wallet_id: a.wallet_id,
      wallet_name: a.wallet.name,
      category_id: a.category_id,
      category_name: a.category.name,
      category_icon: a.category.icon ?? null,
      amount: Number(a.amount),
    })),
  }));
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

  const ownerFilter: OwnerFilter =
    ownerType === 'user'
      ? { user_id: ownerId, house_id: null }
      : { user_id: null, house_id: ownerId };

  const budget = await prisma.$transaction(async (tx) => {
    const created = await tx.budget.create({
      data: {
        name: data.name,
        total_amount: data.allocated_amount,
        frequency: data.frequency as BudgetFrequency,
        recurrent: data.frequency === 'CUSTOM' ? false : (data.recurrent ?? true),
        start_date: data.start_date ? new Date(data.start_date) : null,
        end_date: data.end_date ? new Date(data.end_date) : null,
        active: true,
        user_id: ownerType === 'user' ? ownerId : null,
        house_id: ownerType === 'house' ? ownerId : null,
      },
    });

    await tx.budgetAllocation.createMany({
      data: data.allocations.map((a) => ({
        budget_id: created.id,
        wallet_id: a.wallet_id,
        category_id: a.category_id,
        amount: a.amount,
      })),
    });

    return created;
  });

  await generatePeriodsOnCreate(
    budget.id,
    data.frequency as BudgetFrequency,
    data.start_date,
    data.end_date,
    ownerFilter,
  );

  return budget;
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
