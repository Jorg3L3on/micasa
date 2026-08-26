import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import prisma from '@/lib/prisma';
import { validateCategoryIconInput } from '@/lib/category-icons';
import {
  createCategorySchema,
  updateCategorySchema,
} from '@/schemas/category.schema';
import {
  seedDefaultExpenseCategoriesForOwner,
  seedDefaultIncomeCategoriesForOwner,
} from '@/lib/finance/category-seed.service';
import {
  activateCategory,
  assertCategoryDeletable,
  assertValidParentForCreate,
  categoryOwnerWhere,
  CategoryServiceError,
  deactivateCategoryTree,
  findDuplicateCategoryName,
} from '@/lib/finance/category.service';
import type { CategoryKind } from '@/generated/prisma/client';

function serializeCategory(category: {
  id: number;
  name: string;
  description: string | null;
  icon: string | null;
  active: boolean;
  sort_order: number;
  parent_id: number | null;
  kind: CategoryKind;
}) {
  return {
    id: category.id,
    name: category.name,
    description: category.description ?? undefined,
    icon: category.icon,
    active: category.active,
    sortOrder: category.sort_order,
    parentId: category.parent_id,
    kind: category.kind,
  };
}

const listKindSchema = z.enum(['expense', 'income', 'all']);

/**
 * GET /categories?ownerType=user|house&ownerId=number&kind=expense|income|all
 * Lazy-seeds defaults when the owner has zero categories for the requested kind(s).
 * Default kind=expense so expense pickers never leak income categories.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerType, ownerId } = context;

    const { searchParams } = new URL(request.url);
    const kindParam = listKindSchema.parse(
      searchParams.get('kind') ?? 'expense',
    );

    const ownerRef =
      ownerType === 'user' ? { userId: ownerId } : { houseId: ownerId };

    await prisma.$transaction(async (tx) => {
      if (kindParam === 'expense' || kindParam === 'all') {
        await seedDefaultExpenseCategoriesForOwner(tx, ownerRef);
      }
      if (kindParam === 'income' || kindParam === 'all') {
        await seedDefaultIncomeCategoriesForOwner(tx, ownerRef);
      }
    });

    const kindFilter =
      kindParam === 'all'
        ? {}
        : { kind: (kindParam === 'income' ? 'INCOME' : 'EXPENSE') as CategoryKind };

    const categories = await prisma.category.findMany({
      where: {
        ...categoryOwnerWhere(ownerType, ownerId),
        ...kindFilter,
      },
      orderBy: [{ parent_id: 'asc' }, { sort_order: 'asc' }, { name: 'asc' }],
    });

    return NextResponse.json(categories.map(serializeCategory), {
      status: 200,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Error de validación', details: error.issues },
        { status: 400 },
      );
    }
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'No se pudieron cargar las categorías' },
      { status: 500 },
    );
  }
}

/** POST /categories – create category (optional parentId for one-level child). */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerType, ownerId } = context;

    const body = await request.json();
    const validatedData = createCategorySchema.parse(body);
    const kind = validatedData.kind;
    const iconResult = validateCategoryIconInput(validatedData.icon, null);
    if (!iconResult.ok) {
      return NextResponse.json({ error: iconResult.message }, { status: 400 });
    }

    const parentId = validatedData.parentId ?? null;
    await assertValidParentForCreate(
      prisma,
      ownerType,
      ownerId,
      parentId,
      kind,
    );

    const existingSameName = await findDuplicateCategoryName(
      prisma,
      ownerType,
      ownerId,
      validatedData.name,
      kind,
    );
    if (existingSameName) {
      return NextResponse.json(
        { error: 'Ya existe una categoría con este nombre' },
        { status: 409 },
      );
    }

    const siblingCount = await prisma.category.count({
      where: {
        ...categoryOwnerWhere(ownerType, ownerId),
        parent_id: parentId,
        kind,
      },
    });

    const category = await prisma.category.create({
      data: {
        name: validatedData.name,
        description: validatedData.description || null,
        icon: iconResult.value,
        active: true,
        sort_order: siblingCount,
        parent_id: parentId,
        kind,
        ...(ownerType === 'user'
          ? { user_id: ownerId, house_id: null }
          : { user_id: null, house_id: ownerId }),
      },
    });

    return NextResponse.json(serializeCategory(category), { status: 201 });
  } catch (error) {
    if (error instanceof CategoryServiceError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Error de validación', details: error.issues },
        { status: 400 },
      );
    }

    console.error('Error creating category:', error);
    return NextResponse.json(
      { error: 'No se pudo crear la categoría' },
      { status: 500 },
    );
  }
}

/**
 * PUT /categories?id= – update name/icon/description/active.
 * Deactivating a root cascades active=false to children.
 * Reactivating does not reactivate children.
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerType, ownerId } = context;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || isNaN(Number(id))) {
      return NextResponse.json(
        { error: 'Se requiere un parámetro id válido' },
        { status: 400 },
      );
    }

    const categoryId = Number(id);
    const existing = await prisma.category.findFirst({
      where: { id: categoryId, ...categoryOwnerWhere(ownerType, ownerId) },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'Categoría no encontrada' },
        { status: 404 },
      );
    }

    const body = await request.json();
    const validatedData = updateCategorySchema.parse(body);
    const iconResult = validateCategoryIconInput(
      validatedData.icon,
      existing.icon,
    );
    if (!iconResult.ok) {
      return NextResponse.json({ error: iconResult.message }, { status: 400 });
    }

    if (validatedData.name && validatedData.name !== existing.name) {
      const duplicateName = await findDuplicateCategoryName(
        prisma,
        ownerType,
        ownerId,
        validatedData.name,
        existing.kind,
        categoryId,
      );
      if (duplicateName) {
        return NextResponse.json(
          { error: 'Ya existe una categoría con este nombre' },
          { status: 409 },
        );
      }
    }

    if (validatedData.active === false && existing.active) {
      const category = await deactivateCategoryTree(
        prisma,
        categoryId,
        ownerType,
        ownerId,
      );
      return NextResponse.json(serializeCategory(category), { status: 200 });
    }

    if (validatedData.active === true && !existing.active) {
      const category = await activateCategory(
        prisma,
        categoryId,
        ownerType,
        ownerId,
      );
      return NextResponse.json(serializeCategory(category), { status: 200 });
    }

    const updateData: {
      name?: string;
      description?: string | null;
      icon?: string | null;
    } = {};
    if (validatedData.name) {
      updateData.name = validatedData.name;
    }
    if (validatedData.description !== undefined) {
      updateData.description = validatedData.description || null;
    }
    if (validatedData.icon !== undefined) {
      updateData.icon = iconResult.value;
    }

    const category = await prisma.category.update({
      where: { id: categoryId },
      data: updateData,
    });

    return NextResponse.json(serializeCategory(category), { status: 200 });
  } catch (error) {
    if (error instanceof CategoryServiceError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Error de validación', details: error.issues },
        { status: 400 },
      );
    }

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2025'
    ) {
      return NextResponse.json(
        { error: 'Categoría no encontrada' },
        { status: 404 },
      );
    }

    console.error('Error updating category:', error);
    return NextResponse.json(
      { error: 'No se pudo actualizar la categoría' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /categories?id= – blocked when children or financial deps exist.
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerType, ownerId } = context;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || isNaN(Number(id))) {
      return NextResponse.json(
        { error: 'Se requiere un parámetro id válido' },
        { status: 400 },
      );
    }

    const categoryId = Number(id);
    const existing = await prisma.category.findFirst({
      where: { id: categoryId, ...categoryOwnerWhere(ownerType, ownerId) },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'Categoría no encontrada' },
        { status: 404 },
      );
    }

    await assertCategoryDeletable(prisma, categoryId, ownerType, ownerId);

    await prisma.category.delete({
      where: { id: categoryId },
    });

    return NextResponse.json(
      { message: 'Categoría eliminada correctamente' },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof CategoryServiceError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2025'
    ) {
      return NextResponse.json(
        { error: 'Categoría no encontrada' },
        { status: 404 },
      );
    }

    console.error('Error deleting category:', error);
    return NextResponse.json(
      { error: 'No se pudo eliminar la categoría' },
      { status: 500 },
    );
  }
}
