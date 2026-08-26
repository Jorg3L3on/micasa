import prisma from '@/lib/prisma';
import type { CategoryKind, Prisma } from '@/generated/prisma/client';

export type CategoryOwnerType = 'user' | 'house';

export const categoryOwnerWhere = (
  ownerType: CategoryOwnerType,
  ownerId: number,
) =>
  ownerType === 'user'
    ? { user_id: ownerId, house_id: null as number | null }
    : { user_id: null as number | null, house_id: ownerId };

export class CategoryServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'CategoryServiceError';
  }
}

type Tx = Prisma.TransactionClient | typeof prisma;

export async function assertValidParentForCreate(
  tx: Tx,
  ownerType: CategoryOwnerType,
  ownerId: number,
  parentId: number | null | undefined,
  kind: CategoryKind,
): Promise<void> {
  if (parentId == null) return;

  const parent = await tx.category.findFirst({
    where: { id: parentId, ...categoryOwnerWhere(ownerType, ownerId) },
  });
  if (!parent) {
    throw new CategoryServiceError('Categoría padre no encontrada', 404);
  }
  if (parent.kind !== kind) {
    throw new CategoryServiceError(
      'La categoría padre debe ser del mismo tipo',
      400,
    );
  }
  if (parent.parent_id != null) {
    throw new CategoryServiceError(
      'Solo se permite un nivel de subcategorías',
      400,
    );
  }
}

export async function findDuplicateCategoryName(
  tx: Tx,
  ownerType: CategoryOwnerType,
  ownerId: number,
  name: string,
  kind: CategoryKind,
  excludeId?: number,
) {
  return tx.category.findFirst({
    where: {
      ...categoryOwnerWhere(ownerType, ownerId),
      name,
      kind,
      ...(excludeId != null ? { id: { not: excludeId } } : {}),
    },
  });
}

export async function assertOwnedCategoryOfKind(
  tx: Tx,
  ownerType: CategoryOwnerType,
  ownerId: number,
  categoryId: number,
  kind: CategoryKind,
): Promise<void> {
  const category = await tx.category.findFirst({
    where: {
      id: categoryId,
      kind,
      ...categoryOwnerWhere(ownerType, ownerId),
    },
  });
  if (!category) {
    throw new CategoryServiceError(
      kind === 'INCOME'
        ? 'Categoría de ingreso no encontrada'
        : 'Categoría de gasto no encontrada',
      404,
    );
  }
  if (!category.active) {
    throw new CategoryServiceError('La categoría no está activa', 400);
  }
}

/** Deactivate parent and cascade active=false to direct children. */
export async function deactivateCategoryTree(
  tx: Tx,
  categoryId: number,
  ownerType: CategoryOwnerType,
  ownerId: number,
) {
  const existing = await tx.category.findFirst({
    where: { id: categoryId, ...categoryOwnerWhere(ownerType, ownerId) },
  });
  if (!existing) {
    throw new CategoryServiceError('Categoría no encontrada', 404);
  }

  await tx.category.update({
    where: { id: categoryId },
    data: { active: false },
  });

  if (existing.parent_id == null) {
    await tx.category.updateMany({
      where: {
        parent_id: categoryId,
        ...categoryOwnerWhere(ownerType, ownerId),
      },
      data: { active: false },
    });
  }

  return tx.category.findUniqueOrThrow({ where: { id: categoryId } });
}

/** Reactivate a single category (does not reactivate children). */
export async function activateCategory(
  tx: Tx,
  categoryId: number,
  ownerType: CategoryOwnerType,
  ownerId: number,
) {
  const existing = await tx.category.findFirst({
    where: { id: categoryId, ...categoryOwnerWhere(ownerType, ownerId) },
  });
  if (!existing) {
    throw new CategoryServiceError('Categoría no encontrada', 404);
  }

  if (existing.parent_id != null) {
    const parent = await tx.category.findFirst({
      where: {
        id: existing.parent_id,
        ...categoryOwnerWhere(ownerType, ownerId),
      },
    });
    if (parent && !parent.active) {
      throw new CategoryServiceError(
        'Activa primero la categoría padre',
        400,
      );
    }
  }

  return tx.category.update({
    where: { id: categoryId },
    data: { active: true },
  });
}

export async function assertCategoryDeletable(
  tx: Tx,
  categoryId: number,
  ownerType: CategoryOwnerType,
  ownerId: number,
): Promise<void> {
  const child = await tx.category.findFirst({
    where: {
      parent_id: categoryId,
      ...categoryOwnerWhere(ownerType, ownerId),
    },
  });
  if (child) {
    throw new CategoryServiceError(
      'Elimina primero las subcategorías de esta categoría',
      409,
    );
  }

  const ownerExpenseWhere =
    ownerType === 'user'
      ? { user_id: ownerId, house_id: null }
      : { user_id: null, house_id: ownerId };

  const relatedExpense = await tx.expense.findFirst({
    where: { category_id: categoryId, ...ownerExpenseWhere },
  });
  if (relatedExpense) {
    throw new CategoryServiceError(
      'La categoría tiene gastos asociados y no puede eliminarse',
      409,
    );
  }

  const relatedTemplate = await tx.expenseTemplate.findFirst({
    where: {
      category_id: categoryId,
      ...categoryOwnerWhere(ownerType, ownerId),
    },
  });
  if (relatedTemplate) {
    throw new CategoryServiceError(
      'La categoría tiene plantillas de gasto asociadas y no puede eliminarse',
      409,
    );
  }

  const relatedIncome = await tx.income.findFirst({
    where: { category_id: categoryId, ...ownerExpenseWhere },
  });
  if (relatedIncome) {
    throw new CategoryServiceError(
      'La categoría tiene ingresos asociados y no puede eliminarse',
      409,
    );
  }

  const relatedIncomeTemplate = await tx.incomeTemplate.findFirst({
    where: {
      category_id: categoryId,
      ...categoryOwnerWhere(ownerType, ownerId),
    },
  });
  if (relatedIncomeTemplate) {
    throw new CategoryServiceError(
      'La categoría tiene plantillas de ingreso asociadas y no puede eliminarse',
      409,
    );
  }

  const relatedAllocation = await tx.budgetAllocation.findFirst({
    where: {
      category_id: categoryId,
      budget: categoryOwnerWhere(ownerType, ownerId),
    },
  });
  if (relatedAllocation) {
    throw new CategoryServiceError(
      'La categoría tiene presupuestos asociados y no puede eliminarse',
      409,
    );
  }
}
