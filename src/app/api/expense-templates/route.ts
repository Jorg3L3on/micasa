import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import {
  createExpenseTemplateSchema,
  updateExpenseTemplateSchema,
} from '@/schemas/expense-template.schema';
import { deriveLegacyDueDayForTemplate } from '@/lib/finance/expense-template-due';

/**
 * Nota producto: las compras en cuotas (pago repartido en varios meses en TC) viven como
 * gastos de tarjeta (import PDF / compra registrada), no como plantillas recurrentes por quincena.
 */

const prismaDueFieldsFromPayload = (validated: {
  dueDayFirst?: number | null | undefined;
  dueDaySecond?: number | null | undefined;
}) => {
  const first = validated.dueDayFirst ?? null;
  const second = validated.dueDaySecond ?? null;
  return {
    due_day_first_fortnight: first,
    due_day_second_fortnight: second,
    due_day: first ?? second ?? null,
  };
};

export async function GET(request: NextRequest) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerFilter } = context;

    const templates = await prisma.expenseTemplate.findMany({
      where: ownerFilter,
      include: {
        category: {
          select: {
            name: true,
            icon: true,
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
        categoryIcon: template.category?.icon ?? null,
        suggestedAmount: template.suggested_amount
          ? Number(template.suggested_amount)
          : null,
        paymentMethod: template.wallet?.name || null,
        paymentMethodId: template.wallet?.id || null,
        active: template.active,
        totalEstimatedAmount: totalAmount,
        expenseIds: [], // Will be populated from form selections in UI
        dueDayFirst: template.due_day_first_fortnight,
        dueDaySecond: template.due_day_second_fortnight,
        dueDay: deriveLegacyDueDayForTemplate(template),
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
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerType, ownerId } = context;

    const body = await request.json();
    const validatedData = createExpenseTemplateSchema.parse(body);

    const dueFields = prismaDueFieldsFromPayload(validatedData);

    const template = await prisma.expenseTemplate.create({
      data: {
        name: validatedData.name,
        category_id: validatedData.categoryId,
        suggested_amount: validatedData.suggestedAmount
          ? validatedData.suggestedAmount.toString()
          : null,
        wallet_id: validatedData.paymentMethodId ?? undefined,
        active: validatedData.active ?? true,
        ...dueFields,
        cutoff_day: validatedData.cutoffDay ?? null,
        is_recurring: validatedData.isRecurring,
        applies_first_fortnight: validatedData.appliesFirstFortnight,
        applies_second_fortnight: validatedData.appliesSecondFortnight,
        is_subscription: validatedData.isSubscription,
        user_id: ownerType === 'user' ? ownerId : null,
        house_id: ownerType === 'house' ? ownerId : null,
      },
      include: {
        category: {
          select: {
            name: true,
            icon: true,
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
        categoryIcon: template.category?.icon ?? null,
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
        dueDayFirst: template.due_day_first_fortnight,
        dueDaySecond: template.due_day_second_fortnight,
        dueDay: deriveLegacyDueDayForTemplate(template),
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
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerFilter } = context;

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

    const updateData: Prisma.ExpenseTemplateUncheckedUpdateInput = {};
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

    Object.assign(updateData, prismaDueFieldsFromPayload(validatedData));
    updateData.cutoff_day = validatedData.cutoffDay ?? null;
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
      where: { id: Number(id), ...ownerFilter },
      data: updateData,
      include: {
        category: {
          select: {
            name: true,
            icon: true,
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
        categoryIcon: template.category?.icon ?? null,
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
        dueDayFirst: template.due_day_first_fortnight,
        dueDaySecond: template.due_day_second_fortnight,
        dueDay: deriveLegacyDueDayForTemplate(template),
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
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerFilter } = context;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || isNaN(Number(id))) {
      return NextResponse.json(
        { error: 'Valid id parameter is required' },
        { status: 400 },
      );
    }

    const templateId = Number(id);
    const existing = await prisma.expenseTemplate.findFirst({
      where: { id: templateId, ...ownerFilter },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'Expense template not found' },
        { status: 404 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const detachedExpenses = await tx.expense.updateMany({
        where: { expense_template_id: templateId },
        data: { expense_template_id: null },
      });

      await tx.expenseTemplate.delete({
        where: { id: templateId },
      });

      return detachedExpenses;
    });

    return NextResponse.json(
      {
        message: 'Expense template deleted successfully',
        detachedExpenseCount: result.count,
      },
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
