import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import {
  createExpenseSchema,
  updateExpenseSchema,
} from '@/schemas/expense.schema';

export async function GET() {
  try {
    // Get all expense templates as expense definitions
    const templates = await prisma.expenseTemplate.findMany({
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        wallet: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    const formatted = templates.map((template) => ({
      id: template.id,
      name: template.name,
      category: template.category?.name ?? '',
      categoryId: template.category?.id ?? 0,
      defaultAmount: template.suggested_amount
        ? Number(template.suggested_amount)
        : null,
      paymentMethod: template.wallet?.name || 'Efectivo',
      paymentMethodId: template.wallet?.id ?? 0,
      active: template.active,
    }));

    return NextResponse.json(formatted, { status: 200 });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch expenses' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createExpenseSchema.parse(body);

    // Create expense template (wallet_id = paymentMethodId when provided)
    const template = await prisma.expenseTemplate.create({
      data: {
        name: validatedData.name,
        category_id: validatedData.categoryId,
        suggested_amount: validatedData.defaultAmount
          ? validatedData.defaultAmount.toString()
          : null,
        wallet_id: validatedData.paymentMethodId ?? undefined,
        active: validatedData.active ?? true,
      },
      include: {
        category: {
          select: {
            name: true,
          },
        },
        wallet: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        id: template.id,
        name: template.name,
        category: template.category?.name ?? '',
        categoryId: validatedData.categoryId,
        defaultAmount: validatedData.defaultAmount || null,
        paymentMethod: template.wallet?.name || 'Efectivo',
        paymentMethodId: template.wallet?.id ?? 0,
        active: template.active,
      },
      { status: 201 },
    );
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
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'Expense with this name already exists' },
        { status: 409 },
      );
    }

    console.error('Error creating expense:', error);
    return NextResponse.json(
      { error: 'Failed to create expense' },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || isNaN(Number(id))) {
      return NextResponse.json(
        { error: 'Valid id parameter is required' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const validatedData = updateExpenseSchema.parse(body);

    const template = await prisma.expenseTemplate.findUnique({
      where: { id: Number(id) },
      include: {
        category: {
          select: {
            name: true,
            id: true,
          },
        },
        wallet: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!template) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    const updateData: any = {};
    if (validatedData.name !== undefined) {
      updateData.name = validatedData.name;
    }
    if (validatedData.categoryId !== undefined) {
      updateData.category_id = validatedData.categoryId;
    }
    if (validatedData.defaultAmount !== undefined) {
      updateData.suggested_amount =
        validatedData.defaultAmount?.toString() || null;
    }
    if (validatedData.active !== undefined) {
      updateData.active = validatedData.active;
    }

    // Handle payment method change
    if (validatedData.paymentMethodId !== undefined) {
      updateData.wallet_id = validatedData.paymentMethodId ?? null;
    }

    const updatedTemplate = await prisma.expenseTemplate.update({
      where: { id: Number(id) },
      data: updateData,
      include: {
        category: {
          select: {
            name: true,
            id: true,
          },
        },
        wallet: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const paymentMethodName = updatedTemplate.wallet?.name || 'Efectivo';
    const paymentMethodId = updatedTemplate.wallet?.id ?? 0;

    return NextResponse.json(
      {
        id: updatedTemplate.id,
        name: updatedTemplate.name,
        category: updatedTemplate.category?.name ?? '',
        categoryId: updatedTemplate.category?.id ?? 0,
        defaultAmount: updatedTemplate.suggested_amount
          ? Number(updatedTemplate.suggested_amount)
          : null,
        paymentMethod: paymentMethodName,
        paymentMethodId,
        active: updatedTemplate.active,
      },
      { status: 200 },
    );
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
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    console.error('Error updating expense:', error);
    return NextResponse.json(
      { error: 'Failed to update expense' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || isNaN(Number(id))) {
      return NextResponse.json(
        { error: 'Valid id parameter is required' },
        { status: 400 },
      );
    }

    // Check for related expenses (transactional expenses)
    const relatedExpenses = await prisma.expense.findFirst({
      where: { expense_template_id: Number(id) },
    });

    if (relatedExpenses) {
      return NextResponse.json(
        {
          error: 'La plantilla de gastos está en uso y no puede eliminarse',
        },
        { status: 409 },
      );
    }

    await prisma.expenseTemplate.delete({
      where: { id: Number(id) },
    });

    return NextResponse.json(
      { message: 'Expense deleted successfully' },
      { status: 200 },
    );
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2025'
    ) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    console.error('Error deleting expense:', error);
    return NextResponse.json(
      { error: 'Failed to delete expense' },
      { status: 500 },
    );
  }
}
