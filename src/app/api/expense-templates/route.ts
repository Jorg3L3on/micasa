import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import {
  createExpenseTemplateSchema,
  updateExpenseTemplateSchema,
} from '@/schemas/expense-template.schema';

export async function GET() {
  try {
    const templates = await prisma.expenseTemplate.findMany({
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
        expenses: {
          select: {
            id: true,
            amount: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    const formatted = templates.map((template) => {
      // Calculate total from suggested_amount or sum of related transactional expenses
      const totalAmount = template.suggested_amount
        ? Number(template.suggested_amount)
        : template.expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

      return {
        id: template.id,
        name: template.name,
        category: template.category?.name ?? null,
        suggestedAmount: template.suggested_amount
          ? Number(template.suggested_amount)
          : null,
        paymentMethod: template.wallet?.name || null,
        paymentMethodId: template.wallet?.id || null,
        active: template.active,
        totalEstimatedAmount: totalAmount,
        expenseIds: [], // Will be populated from form selections in UI
        dueDay: template.due_day,
        cutoffDay: template.cutoff_day,
        isRecurring: template.is_recurring,
        appliesFirstFortnight: template.applies_first_fortnight,
        appliesSecondFortnight: template.applies_second_fortnight,
        isSubscription: template.is_subscription,
      };
    });

    return NextResponse.json(formatted, { status: 200 });
  } catch (error) {
    console.error('Error fetching expense templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch expense templates' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createExpenseTemplateSchema.parse(body);

    const template = await prisma.expenseTemplate.create({
      data: {
        name: validatedData.name,
        category_id: validatedData.categoryId,
        suggested_amount: validatedData.suggestedAmount
          ? validatedData.suggestedAmount.toString()
          : null,
        wallet_id: validatedData.paymentMethodId ?? undefined,
        active: validatedData.active ?? true,
        due_day: validatedData.dueDay,
        cutoff_day: validatedData.cutoffDay,
        is_recurring: validatedData.isRecurring,
        applies_first_fortnight: validatedData.appliesFirstFortnight,
        applies_second_fortnight: validatedData.appliesSecondFortnight,
        is_subscription: validatedData.isSubscription,
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
        category: template.category?.name ?? null,
        defaultAmount: template.suggested_amount
          ? Number(template.suggested_amount)
          : null,
        paymentMethod: template.wallet?.name || null,
        paymentMethodId: template.wallet?.id || null,
        active: template.active,
        totalEstimatedAmount: template.suggested_amount
          ? Number(template.suggested_amount)
          : 0,
        expenseIds: [],
        dueDay: template.due_day,
        cutoffDay: template.cutoff_day,
        isRecurring: template.is_recurring,
        appliesFirstFortnight: template.applies_first_fortnight,
        appliesSecondFortnight: template.applies_second_fortnight,
        isSubscription: template.is_subscription,
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
        { error: 'Expense template with this name already exists' },
        { status: 409 },
      );
    }

    console.error('Error creating expense template:', error);
    return NextResponse.json(
      { error: 'Failed to create expense template' },
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
    const validatedData = updateExpenseTemplateSchema.parse(body);

    const updateData: any = {};
    if (validatedData.name !== undefined) {
      updateData.name = validatedData.name;
    }
    if (validatedData.categoryId !== undefined) {
      updateData.category_id = validatedData.categoryId;
    }
    if (validatedData.suggestedAmount !== undefined) {
      updateData.suggested_amount = validatedData.suggestedAmount.toString();
    }
    if (validatedData.active !== undefined) {
      updateData.active = validatedData.active;
    }
    if (validatedData.paymentMethodId !== undefined) {
      updateData.wallet_id = validatedData.paymentMethodId ?? null;
    }

    if (validatedData.dueDay !== undefined) {
      updateData.due_day = validatedData.dueDay;
    }
    if (validatedData.cutoffDay !== undefined) {
      updateData.cutoff_day = validatedData.cutoffDay;
    }
    if (validatedData.isRecurring !== undefined) {
      updateData.is_recurring = validatedData.isRecurring;
    }
    if (validatedData.appliesFirstFortnight !== undefined) {
      updateData.applies_first_fortnight = validatedData.appliesFirstFortnight;
    }
    if (validatedData.appliesSecondFortnight !== undefined) {
      updateData.applies_second_fortnight =
        validatedData.appliesSecondFortnight;
    }
    if (validatedData.isSubscription !== undefined) {
      updateData.is_subscription = validatedData.isSubscription;
    }

    const template = await prisma.expenseTemplate.update({
      where: { id: Number(id) },
      data: updateData,
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
        expenses: {
          select: {
            id: true,
            amount: true,
          },
        },
      },
    });

    const totalAmount = template.expenses.reduce(
      (sum, exp) => sum + Number(exp.amount),
      0,
    );

    return NextResponse.json(
      {
        id: template.id,
        name: template.name,
        category: template.category?.name ?? null,
        suggestedAmount: template.suggested_amount
          ? Number(template.suggested_amount)
          : null,
        paymentMethod: template.wallet?.name || null,
        paymentMethodId: template.wallet?.id || null,
        active: template.active,
        totalEstimatedAmount:
          totalAmount ||
          (template.suggested_amount ? Number(template.suggested_amount) : 0),
        expenseIds: template.expenses.map((e) => e.id),
        dueDay: template.due_day,
        cutoffDay: template.cutoff_day,
        isRecurring: template.is_recurring,
        appliesFirstFortnight: template.applies_first_fortnight,
        appliesSecondFortnight: template.applies_second_fortnight,
        isSubscription: template.is_subscription,
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
      return NextResponse.json(
        { error: 'Expense template not found' },
        { status: 404 },
      );
    }

    console.error('Error updating expense template:', error);
    return NextResponse.json(
      { error: 'Failed to update expense template' },
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

    // Check for related expenses
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
      { message: 'Expense template deleted successfully' },
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
        { error: 'Expense template not found' },
        { status: 404 },
      );
    }

    console.error('Error deleting expense template:', error);
    return NextResponse.json(
      { error: 'Failed to delete expense template' },
      { status: 500 },
    );
  }
}
