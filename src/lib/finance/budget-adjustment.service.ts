import prisma from '@/lib/prisma';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import {
  compareCalendarFortnight,
  getCurrentCalendarFortnightRef,
  getNextCalendarFortnight,
  type CalendarFortnightRef,
} from '@/lib/fortnight-calendar';
import { DomainError } from '@/lib/finance/domain-error';
import { splitTotalAcrossAllocations } from '@/lib/finance/budget-fortnight-effective';
import type { BudgetFortnightAdjustmentInput } from '@/schemas/budget.schema';

/**
 * One-quincena budget adjustments (MIC-I19). The template is never touched;
 * only the current or the next quincena can be adjusted.
 */

const sameRef = (a: CalendarFortnightRef, b: CalendarFortnightRef) =>
  compareCalendarFortnight(a, b) === 0;

/** Current and next calendar quincena: the only ones an adjustment may target. */
export function adjustableQuincenas(asOf: Date = new Date()): CalendarFortnightRef[] {
  return [getCurrentCalendarFortnightRef(asOf), getNextCalendarFortnight(asOf)];
}

function assertAdjustableQuincena(ref: CalendarFortnightRef, asOf: Date) {
  const [current, next] = adjustableQuincenas(asOf);
  if (compareCalendarFortnight(ref, current) < 0) {
    throw new DomainError(
      'ADJUSTMENT_CLOSED_QUINCENA',
      'Esa quincena ya cerró; solo se puede ajustar la quincena en curso o la siguiente.',
      422,
    );
  }
  if (!sameRef(ref, current) && !sameRef(ref, next)) {
    throw new DomainError(
      'ADJUSTMENT_QUINCENA_TOO_FAR',
      'Solo se puede ajustar la quincena en curso o la siguiente.',
      422,
    );
  }
}

async function findOwnedBudget(budgetId: number, ownerFilter: OwnerFilter) {
  const budget = await prisma.budget.findFirst({
    where: { id: budgetId, ...ownerFilter },
    include: { allocations: { orderBy: { id: 'asc' } } },
  });
  if (!budget) throw new DomainError('P2025', 'Presupuesto no encontrado');
  return budget;
}

export async function setBudgetFortnightAdjustment(
  budgetId: number,
  ownerFilter: OwnerFilter,
  input: BudgetFortnightAdjustmentInput,
  asOf: Date = new Date(),
) {
  const ref: CalendarFortnightRef = {
    year: input.year,
    month: input.month,
    period: input.period,
  };
  assertAdjustableQuincena(ref, asOf);

  const budget = await findOwnedBudget(budgetId, ownerFilter);
  const isCurrent = sameRef(ref, getCurrentCalendarFortnightRef(asOf));
  // A deactivated recurrent budget still runs the quincena that covers today.
  if (!budget.active && !(budget.recurrent && isCurrent)) {
    throw new DomainError(
      'BUDGET_INACTIVE',
      'El presupuesto está desactivado para esa quincena.',
      422,
    );
  }

  const allocations =
    input.kind === 'PAUSE'
      ? []
      : (() => {
          const parts = splitTotalAcrossAllocations(
            input.total ?? 0,
            budget.allocations.map((a) => Number(a.amount)),
          );
          return budget.allocations.map((a, i) => ({
            wallet_id: a.wallet_id,
            category_id: a.category_id,
            amount: parts[i] ?? 0,
          }));
        })();

  return prisma.$transaction(async (tx) => {
    await tx.budgetFortnightAdjustment.deleteMany({
      where: { budget_id: budgetId, ...ownerFilter, ...ref },
    });
    return tx.budgetFortnightAdjustment.create({
      data: {
        budget_id: budgetId,
        ...ref,
        kind: input.kind,
        note: input.note ?? null,
        user_id: ownerFilter.user_id,
        house_id: ownerFilter.house_id,
        allocations: { create: allocations },
      },
      include: { allocations: true },
    });
  });
}

/** Back to the template for that quincena. Returns how many rows were removed. */
export async function clearBudgetFortnightAdjustment(
  budgetId: number,
  ownerFilter: OwnerFilter,
  ref: CalendarFortnightRef,
): Promise<number> {
  await findOwnedBudget(budgetId, ownerFilter);
  const result = await prisma.budgetFortnightAdjustment.deleteMany({
    where: { budget_id: budgetId, ...ownerFilter, ...ref },
  });
  return result.count;
}

/** Drop adjustments after the current quincena (used when a budget is deactivated). */
export async function deleteFutureAdjustments(
  budgetId: number,
  asOf: Date = new Date(),
): Promise<number> {
  const model = (prisma as { budgetFortnightAdjustment?: { deleteMany?: unknown } })
    .budgetFortnightAdjustment;
  if (!model || typeof model.deleteMany !== 'function') return 0;
  const current = getCurrentCalendarFortnightRef(asOf);
  const result = await prisma.budgetFortnightAdjustment.deleteMany({
    where: {
      budget_id: budgetId,
      OR: [
        { year: { gt: current.year } },
        { year: current.year, month: { gt: current.month } },
        ...(current.period === 'FIRST'
          ? [{ year: current.year, month: current.month, period: 'SECOND' as const }]
          : []),
      ],
    },
  });
  return result.count;
}
