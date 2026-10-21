import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import {
  createExpenseTemplateForOwner,
  deleteExpenseTemplateForOwner,
  listExpenseTemplatesForOwner,
  updateExpenseTemplateForOwner,
} from '@/lib/finance/expense-template.service';
import {
  createExpenseTemplateSchema,
  updateExpenseTemplateSchema,
} from '@/schemas/expense-template.schema';
import { deriveLegacyDueDayForTemplate } from '@/lib/finance/expense-template-due';

/**
 * Nota producto: las compras en cuotas (pago repartido en varios meses en TC) viven como
 * gastos de tarjeta (import PDF / compra registrada), no como plantillas recurrentes por quincena.
 */

export async function GET(request: NextRequest) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerFilter } = context;

    const templates = await listExpenseTemplatesForOwner(ownerFilter);

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
        paymentMethodProviderIconKey: template.wallet?.provider_icon_key ?? null,
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

    const body = await request.json();
    const validatedData = createExpenseTemplateSchema.parse(body);

    const template = await createExpenseTemplateForOwner(context, validatedData);

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
        paymentMethodProviderIconKey: template.wallet?.provider_icon_key ?? null,
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

    const template = await updateExpenseTemplateForOwner(
      Number(id),
      ownerFilter,
      validatedData,
    );

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
        paymentMethodProviderIconKey: template.wallet?.provider_icon_key ?? null,
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

    const { detachedExpenseCount } = await deleteExpenseTemplateForOwner(
      Number(id),
      ownerFilter,
    );

    return NextResponse.json(
      {
        message: 'Expense template deleted successfully',
        detachedExpenseCount,
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
