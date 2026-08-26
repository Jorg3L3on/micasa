import prisma from '@/lib/prisma';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import type { CreateBudgetInput, AllocationInput, Step1Values } from '@/schemas/budget.schema';
import {
  generatePeriodsOnCreate,
  refreshFuturePeriodSnapshots,
  syncBudgetPeriodsAfterTemplateUpdate,
  deleteFuturePeriods,
} from '@/lib/finance/budget-period.service';
import {
  addCalendarDays,
  formatCalendarDate,
  parseCalendarDate,
} from '@/lib/calendar-dates';
import { getCurrentCalendarFortnightRef } from '@/lib/fortnight-calendar';
import { computeBudgetTemplateDateRange } from '@/lib/finance/budget-template-date-range';
import { getCanonicalFortnightBounds } from '@/lib/finance/budget-period-windows';

async function resolveCurrentFortnight(ownerFilter: OwnerFilter) {
  return prisma.fortnight.findFirst({
    where: { ...ownerFilter, ...getCurrentCalendarFortnightRef() },
    select: { start_date: true, end_date: true, year: true, month: true, period: true },
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
      new Error(
        'No hay una quincena creada para este contexto. Crea el mes en Planificación antes de configurar un presupuesto quincenal.',
      ),
      { code: 'CURRENT_FORTNIGHT_NOT_FOUND' },
    );
  }

  // Prefer year/month/period → canonical calendar bounds so off-by-one
  // Fortnight timestamps (e.g. legacy onboarding) cannot poison the template.
  const biweeklyRange =
    frequency === 'BIWEEKLY' && currentFortnight
      ? getCanonicalFortnightBounds(
          currentFortnight.year,
          currentFortnight.month,
          currentFortnight.period,
        )
      : currentFortnight;

  return computeBudgetTemplateDateRange({
    frequency,
    currentFortnight: biweeklyRange,
    customStartDate,
    customEndDate,
  });
}

function assertExactAllocationTotal(totalAmount: number, allocations: AllocationInput[]) {
  const allocTotal = allocations.reduce((sum, allocation) => sum + Number(allocation.amount), 0);
  if (Math.abs(allocTotal - totalAmount) > 0.01) {
    throw Object.assign(
      new Error('La suma de asignaciones debe ser igual al presupuesto total'),
      { code: 'ALLOC_NOT_EQUAL_BUDGET' },
    );
  }
}

function assertNoEmptyAllocations(allocations: AllocationInput[]) {
  if (
    allocations.some(
      (allocation) =>
        allocation.wallet_id <= 0 ||
        allocation.category_id <= 0 ||
        Number(allocation.amount) <= 0,
    )
  ) {
    throw Object.assign(
      new Error(
        'Todas las asignaciones deben incluir una cartera, una categoría y un monto mayor a cero',
      ),
      { code: 'EMPTY_ALLOCATION' },
    );
  }
}

async function assertOwnerScopedReferences(
  ownerFilter: OwnerFilter,
  allocations: AllocationInput[],
) {
  if (
    !prisma.wallet ||
    typeof prisma.wallet.count !== 'function' ||
    !prisma.category ||
    typeof prisma.category.count !== 'function'
  ) {
    return;
  }
  const walletIds = [...new Set(allocations.map((allocation) => allocation.wallet_id))];
  const categoryIds = [...new Set(allocations.map((allocation) => allocation.category_id))];

  const [walletCount, categoryCount] = await Promise.all([
    prisma.wallet.count({
      where: { ...ownerFilter, id: { in: walletIds } },
    }),
    prisma.category.count({
      where: { ...ownerFilter, kind: 'EXPENSE', id: { in: categoryIds } },
    }),
  ]);

  if (walletCount !== walletIds.length) {
    throw Object.assign(new Error('Una o más carteras no pertenecen al contexto actual'), {
      code: 'OWNER_MISMATCH_WALLET',
    });
  }
  if (categoryCount !== categoryIds.length) {
    throw Object.assign(new Error('Una o más categorías no pertenecen al contexto actual'), {
      code: 'OWNER_MISMATCH_CATEGORY',
    });
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
  const ownerFilter: OwnerFilter =
    ownerType === 'user'
      ? { user_id: ownerId, house_id: null }
      : { user_id: null, house_id: ownerId };
  assertNoEmptyAllocations(data.allocations);
  assertExactAllocationTotal(Number(data.allocated_amount), data.allocations);
  await assertOwnerScopedReferences(ownerFilter, data.allocations);

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

  const allocations = budget.allocations.map((allocation) => ({
      wallet_id: allocation.wallet_id,
      category_id: allocation.category_id,
      amount: Number(allocation.amount),
    }));
  assertNoEmptyAllocations(allocations);
  assertExactAllocationTotal(Number(data.allocated_amount), allocations);

  const budgetDateRange = await resolveBudgetDateRange(
    data.frequency,
    ownerFilter,
    data.start_date,
    data.end_date,
  );

  const recurrent = data.frequency === 'CUSTOM' ? false : (data.recurrent ?? true);

  const updated = await prisma.budget.update({
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

  const calendarDateKey = (value: Date | null) =>
    value ? formatCalendarDate(value) : '';

  const scheduleChanged =
    budget.frequency !== data.frequency ||
    budget.recurrent !== recurrent ||
    Number(budget.total_amount) !== Number(data.allocated_amount) ||
    calendarDateKey(budget.start_date) !== calendarDateKey(budgetDateRange.start_date) ||
    calendarDateKey(budget.end_date) !== calendarDateKey(budgetDateRange.end_date);
  if (
    scheduleChanged &&
    budget.active &&
    budgetDateRange.start_date &&
    budgetDateRange.end_date
  ) {
    await syncBudgetPeriodsAfterTemplateUpdate(
      budgetId,
      data.frequency,
      {
        start_date: budgetDateRange.start_date,
        end_date: budgetDateRange.end_date,
      },
      ownerFilter,
      { recurrent },
    );
  } else {
    await refreshFuturePeriodSnapshots(budgetId);
  }

  return updated;
}

export async function setBudgetActive(
  budgetId: number,
  ownerFilter: OwnerFilter,
  active: boolean,
  effectiveDate?: string | null,
) {
  const budget = await prisma.budget.findFirst({
    where: { id: budgetId, ...ownerFilter },
  });
  if (!budget) {
    throw Object.assign(new Error('Presupuesto no encontrado'), { code: 'P2025' });
  }

  if (!active) {
    const updated = await prisma.budget.update({
      where: { id: budgetId },
      data: { active: false },
    });
    await deleteFuturePeriods(budgetId);
    return updated;
  }

  const frequency = budget.frequency as CreateBudgetInput['frequency'];
  let budgetDateRange = await resolveBudgetDateRange(frequency, ownerFilter);
  if (effectiveDate) {
    if (frequency === 'DAILY') {
      const day = parseCalendarDate(effectiveDate);
      budgetDateRange = { start_date: day, end_date: day };
    } else if (frequency === 'WEEKLY') {
      const [year, month, day] = effectiveDate.split('-').map(Number);
      const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
      const weekStart = addCalendarDays(effectiveDate, -weekday);
      const weekEnd = addCalendarDays(weekStart, 6);
      budgetDateRange = {
        start_date: parseCalendarDate(weekStart),
        end_date: parseCalendarDate(weekEnd),
      };
    } else if (frequency === 'BIWEEKLY') {
      const [year, month, day] = effectiveDate.split('-').map(Number);
      const period = day <= 15 ? 'FIRST' : 'SECOND';
      const fortnight = await prisma.fortnight.findFirst({
        where: { ...ownerFilter, year, month, period },
        select: { id: true },
      });
      if (!fortnight) {
        throw Object.assign(
          new Error('No existe una quincena para la fecha efectiva seleccionada'),
          { code: 'CURRENT_FORTNIGHT_NOT_FOUND' },
        );
      }
      budgetDateRange = getCanonicalFortnightBounds(year, month, period);
    }
  }

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
      frequency,
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

  assertNoEmptyAllocations(allocations);
  assertExactAllocationTotal(Number(budget.total_amount), allocations);
  await assertOwnerScopedReferences(ownerFilter, allocations);

  const updated = await prisma.$transaction(async (tx) => {
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
  await refreshFuturePeriodSnapshots(budgetId);
  return updated;
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
  // Keep the covering-today period; cancel anything that starts after today.
  await deleteFuturePeriods(budgetId);
}
