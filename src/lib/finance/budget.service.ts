import prisma from '@/lib/prisma';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import type { CreateBudgetInput, AllocationInput, Step1Values } from '@/schemas/budget.schema';
import { generatePeriodsOnCreate } from '@/lib/finance/budget-period.service';
import { getCurrentCalendarFortnightRef } from '@/lib/fortnight-calendar';
import { computeBudgetTemplateDateRange } from '@/lib/finance/budget-template-date-range';

async function resolveCurrentFortnight(ownerFilter: OwnerFilter) {
  return prisma.fortnight.findFirst({
    where: { ...ownerFilter, ...getCurrentCalendarFortnightRef() },
    select: { start_date: true, end_date: true },
  });
}

async function resolveBudgetDateRange(
  frequency: CreateBudgetInput['frequency'],
  ownerFilter: OwnerFilter,
  customStartDate?: string | null,
  customEndDate?: string | null,
) {
  const currentFortnight =
    frequency === 'BIWEEKLY' ? await resolveCurrentFortnight(ownerFilter) : null;

  if (frequency === 'BIWEEKLY' && !currentFortnight) {
    throw Object.assign(
      new Error('No se encontró la quincena actual para este contexto'),
      { code: 'CURRENT_FORTNIGHT_NOT_FOUND' },
    );
  }

  return computeBudgetTemplateDateRange({
    frequency,
    currentFortnight,
    customStartDate,
    customEndDate,
  });
}

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

  const budgetDateRange = await resolveBudgetDateRange(
    data.frequency,
    ownerFilter,
    data.start_date,
    data.end_date,
  );

  const recurrent = data.frequency === 'CUSTOM' ? false : (data.recurrent ?? true);

  const budget = await prisma.$transaction(async (tx) => {
    const created = await tx.budget.create({
      data: {
        name: data.name,
        total_amount: data.allocated_amount,
        frequency: data.frequency,
        recurrent,
        start_date: budgetDateRange.start_date,
        end_date: budgetDateRange.end_date,
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

  if (budgetDateRange.start_date && budgetDateRange.end_date) {
    await generatePeriodsOnCreate(
      budget.id,
      data.frequency,
      { start_date: budgetDateRange.start_date, end_date: budgetDateRange.end_date },
      ownerFilter,
      { recurrent },
    );
  }

  return budget;
}

export async function updateBudgetTemplate(
  budgetId: number,
  ownerFilter: OwnerFilter,
  data: Step1Values,
) {
  const budget = await prisma.budget.findFirst({
    where: { id: budgetId, ...ownerFilter },
    include: { allocations: true },
  });
  if (!budget) {
    throw Object.assign(new Error('Presupuesto no encontrado'), { code: 'P2025' });
  }

  const allocTotal = budget.allocations.reduce((sum, a) => sum + Number(a.amount), 0);
  if (allocTotal > Number(data.allocated_amount)) {
    throw Object.assign(new Error('La suma de asignaciones supera el presupuesto total'), { code: 'ALLOC_EXCEEDS_BUDGET' });
  }

  const budgetDateRange = await resolveBudgetDateRange(
    data.frequency,
    ownerFilter,
    data.start_date,
    data.end_date,
  );

  const recurrent = data.frequency === 'CUSTOM' ? false : (data.recurrent ?? true);

  return prisma.budget.update({
    where: { id: budgetId },
    data: {
      name: data.name,
      total_amount: data.allocated_amount,
      frequency: data.frequency,
      recurrent,
      start_date: budgetDateRange.start_date,
      end_date: budgetDateRange.end_date,
    },
  });
}

export async function setBudgetActive(
  budgetId: number,
  ownerFilter: OwnerFilter,
  active: boolean,
) {
  const budget = await prisma.budget.findFirst({
    where: { id: budgetId, ...ownerFilter },
  });
  if (!budget) {
    throw Object.assign(new Error('Presupuesto no encontrado'), { code: 'P2025' });
  }

  if (!active) {
    return prisma.budget.update({
      where: { id: budgetId },
      data: { active: false },
    });
  }

  const budgetDateRange = await resolveBudgetDateRange(
    budget.frequency as CreateBudgetInput['frequency'],
    ownerFilter,
  );

  const updatedActive = await prisma.budget.update({
    where: { id: budgetId },
    data: {
      active: true,
      start_date: budgetDateRange.start_date,
      end_date: budgetDateRange.end_date,
    },
  });

  if (budgetDateRange.start_date && budgetDateRange.end_date) {
    await generatePeriodsOnCreate(
      budgetId,
      budget.frequency as CreateBudgetInput['frequency'],
      { start_date: budgetDateRange.start_date, end_date: budgetDateRange.end_date },
      ownerFilter,
      { recurrent: budget.recurrent },
    );
  }

  return updatedActive;
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
  await prisma.budget.update({
    where: { id: budgetId },
    data: { active: false },
  });
}
