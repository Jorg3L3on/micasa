import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import {
  createCategorySchema,
  updateCategorySchema,
} from '@/schemas/category.schema';
import {
  CategoryServiceError,
  createCategoryForOwner,
  deleteCategoryForOwner,
  listCategoriesForOwner,
  updateCategoryForOwner,
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

    const categories = await listCategoriesForOwner(ownerType, ownerId, kindParam);

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
    const category = await createCategoryForOwner(ownerType, ownerId, validatedData);

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

    const body = await request.json();
    const validatedData = updateCategorySchema.parse(body);
    const category = await updateCategoryForOwner(
      ownerType,
      ownerId,
      Number(id),
      validatedData,
    );

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

    await deleteCategoryForOwner(ownerType, ownerId, Number(id));

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
