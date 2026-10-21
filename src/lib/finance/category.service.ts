import prisma from '@/lib/prisma';
import type { CategoryKind, Prisma } from '@/generated/prisma/client';
import { validateCategoryIconInput } from '@/lib/category-icons';
import {
  seedDefaultExpenseCategoriesForOwner,
  seedDefaultIncomeCategoriesForOwner,
} from '@/lib/finance/category-seed.service';

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

export type CategoryListKind = 'expense' | 'income' | 'all';

/**
 * Categories of an owner, seeding the defaults first when the owner has none
 * of the requested kind(s). Shared by GET /api/categories and list_categories.
 */
export async function listCategoriesForOwner(
  ownerType: CategoryOwnerType,
  ownerId: number,
  kind: CategoryListKind,
) {
  const ownerRef = ownerType === 'user' ? { userId: ownerId } : { houseId: ownerId };

  await prisma.$transaction(async (tx) => {
    if (kind === 'expense' || kind === 'all') {
      await seedDefaultExpenseCategoriesForOwner(tx, ownerRef);
    }
    if (kind === 'income' || kind === 'all') {
      await seedDefaultIncomeCategoriesForOwner(tx, ownerRef);
    }
  });

  const kindFilter =
    kind === 'all' ? {} : { kind: (kind === 'income' ? 'INCOME' : 'EXPENSE') as CategoryKind };

  return prisma.category.findMany({
    where: { ...categoryOwnerWhere(ownerType, ownerId), ...kindFilter },
    orderBy: [{ parent_id: 'asc' }, { sort_order: 'asc' }, { name: 'asc' }],
  });
}

const findOwnedCategory = async (
  ownerType: CategoryOwnerType,
  ownerId: number,
  categoryId: number,
) => {
  const existing = await prisma.category.findFirst({
    where: { id: categoryId, ...categoryOwnerWhere(ownerType, ownerId) },
  });
  if (!existing) {
    throw new CategoryServiceError('Categoría no encontrada', 404);
  }
  return existing;
};

/** Create a category (one-level children via parentId); appended last among its siblings. */
export async function createCategoryForOwner(
  ownerType: CategoryOwnerType,
  ownerId: number,
  input: {
    name: string;
    description?: string | null;
    icon?: string;
    parentId?: number | null;
    kind: CategoryKind;
  },
) {
  const iconResult = validateCategoryIconInput(input.icon, null);
  if (!iconResult.ok) {
    throw new CategoryServiceError(iconResult.message, 400);
  }

  const parentId = input.parentId ?? null;
  await assertValidParentForCreate(prisma, ownerType, ownerId, parentId, input.kind);

  const duplicate = await findDuplicateCategoryName(
    prisma,
    ownerType,
    ownerId,
    input.name,
    input.kind,
  );
  if (duplicate) {
    throw new CategoryServiceError('Ya existe una categoría con este nombre', 409);
  }

  const siblingCount = await prisma.category.count({
    where: {
      ...categoryOwnerWhere(ownerType, ownerId),
      parent_id: parentId,
      kind: input.kind,
    },
  });

  return prisma.category.create({
    data: {
      name: input.name,
      description: input.description || null,
      icon: iconResult.value,
      active: true,
      sort_order: siblingCount,
      parent_id: parentId,
      kind: input.kind,
      ...(ownerType === 'user'
        ? { user_id: ownerId, house_id: null }
        : { user_id: null, house_id: ownerId }),
    },
  });
}

/**
 * Update name / description / icon / active. Deactivating a root cascades to
 * its children; reactivating does not reactivate them.
 */
export async function updateCategoryForOwner(
  ownerType: CategoryOwnerType,
  ownerId: number,
  categoryId: number,
  input: {
    name?: string;
    description?: string | null;
    icon?: string;
    active?: boolean;
  },
) {
  const existing = await findOwnedCategory(ownerType, ownerId, categoryId);

  const iconResult = validateCategoryIconInput(input.icon, existing.icon);
  if (!iconResult.ok) {
    throw new CategoryServiceError(iconResult.message, 400);
  }

  if (input.name && input.name !== existing.name) {
    const duplicate = await findDuplicateCategoryName(
      prisma,
      ownerType,
      ownerId,
      input.name,
      existing.kind,
      categoryId,
    );
    if (duplicate) {
      throw new CategoryServiceError('Ya existe una categoría con este nombre', 409);
    }
  }

  if (input.active === false && existing.active) {
    return deactivateCategoryTree(prisma, categoryId, ownerType, ownerId);
  }
  if (input.active === true && !existing.active) {
    return activateCategory(prisma, categoryId, ownerType, ownerId);
  }

  const updateData: { name?: string; description?: string | null; icon?: string | null } = {};
  if (input.name) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description || null;
  if (input.icon !== undefined) updateData.icon = iconResult.value;

  return prisma.category.update({ where: { id: categoryId }, data: updateData });
}

/** Delete a category with no children and no expenses, incomes, templates or budgets. */
export async function deleteCategoryForOwner(
  ownerType: CategoryOwnerType,
  ownerId: number,
  categoryId: number,
): Promise<void> {
  await findOwnedCategory(ownerType, ownerId, categoryId);
  await assertCategoryDeletable(prisma, categoryId, ownerType, ownerId);
  await prisma.category.delete({ where: { id: categoryId } });
}
