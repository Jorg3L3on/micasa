import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import prisma from '@/lib/prisma';
import {
  createCategorySchema,
  updateCategorySchema,
} from '@/schemas/category.schema';

/** Build Category where clause from owner context (Category has user_id/house_id). */
function categoryOwnerWhere(ownerType: 'user' | 'house', ownerId: number) {
  return ownerType === 'user'
    ? { user_id: ownerId, house_id: null as number | null }
    : { user_id: null as number | null, house_id: ownerId };
}

/**
 * GET /categories?ownerType=user|house&ownerId=number
 * Returns only categories that belong to this owner (Category.user_id or Category.house_id).
 * Fallback: missing/invalid params use session user.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerType, ownerId } = context;

    const categories = await prisma.category.findMany({
      where: categoryOwnerWhere(ownerType, ownerId),
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(categories, { status: 200 });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 },
    );
  }
}

/** POST /categories – create category for this owner. Sets user_id or house_id from context. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerType, ownerId } = context;

    const body = await request.json();
    const validatedData = createCategorySchema.parse(body);

    const existingSameName = await prisma.category.findFirst({
      where: {
        ...categoryOwnerWhere(ownerType, ownerId),
        name: validatedData.name,
      },
    });
    if (existingSameName) {
      return NextResponse.json(
        { error: 'Category with this name already exists' },
        { status: 409 },
      );
    }

    const category = await prisma.category.create({
      data: {
        name: validatedData.name,
        description: validatedData.description || null,
        ...(ownerType === 'user'
          ? { user_id: ownerId, house_id: null }
          : { user_id: null, house_id: ownerId }),
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 },
      );
    }

    console.error('Error creating category:', error);
    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 },
    );
  }
}

/**
 * PUT /categories?id= – update only if category belongs to this owner (Category.user_id/house_id).
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
        { error: 'Valid id parameter is required' },
        { status: 400 },
      );
    }

    const categoryId = Number(id);
    const existing = await prisma.category.findFirst({
      where: { id: categoryId, ...categoryOwnerWhere(ownerType, ownerId) },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 },
      );
    }

    const body = await request.json();
    const validatedData = updateCategorySchema.parse(body);

    if (validatedData.name && validatedData.name !== existing.name) {
      const duplicateName = await prisma.category.findFirst({
        where: {
          ...categoryOwnerWhere(ownerType, ownerId),
          name: validatedData.name,
          id: { not: categoryId },
        },
      });
      if (duplicateName) {
        return NextResponse.json(
          { error: 'Category with this name already exists' },
          { status: 409 },
        );
      }
    }

    const updateData: { name?: string; description?: string | null } = {};
    if (validatedData.name) {
      updateData.name = validatedData.name;
    }
    if (validatedData.description !== undefined) {
      updateData.description = validatedData.description || null;
    }

    const category = await prisma.category.update({
      where: { id: categoryId },
      data: updateData,
    });

    return NextResponse.json(category, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
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
        { error: 'Category not found' },
        { status: 404 },
      );
    }

    console.error('Error updating category:', error);
    return NextResponse.json(
      { error: 'Failed to update category' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /categories?id= – only if category belongs to this owner.
 * If any expense for this owner uses this category → 409. Otherwise delete.
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
        { error: 'Valid id parameter is required' },
        { status: 400 },
      );
    }

    const categoryId = Number(id);
    const existing = await prisma.category.findFirst({
      where: { id: categoryId, ...categoryOwnerWhere(ownerType, ownerId) },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 },
      );
    }

    const relatedExpenses = await prisma.expense.findFirst({
      where: {
        category_id: categoryId,
        ...(ownerType === 'user'
          ? { user_id: ownerId, house_id: null }
          : { user_id: null, house_id: ownerId }),
      },
    });

    if (relatedExpenses) {
      return NextResponse.json(
        {
          error: 'La categoría tiene gastos asociados y no puede eliminarse',
        },
        { status: 409 },
      );
    }

    await prisma.category.delete({
      where: { id: categoryId },
    });

    return NextResponse.json(
      { message: 'Category deleted successfully' },
      { status: 200 },
    );
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2025'
    ) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 },
      );
    }

    console.error('Error deleting category:', error);
    return NextResponse.json(
      { error: 'Failed to delete category' },
      { status: 500 },
    );
  }
}
