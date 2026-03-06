import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { updatePaidSchema } from '@/schemas/transaction.schema';
import { toggleExpensePaid } from '@/lib/finance/expense.service';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    if (!id || isNaN(Number(id))) {
      return NextResponse.json(
        { error: 'Valid id parameter is required' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const validatedData = updatePaidSchema.parse(body);

    const expense = await toggleExpensePaid({
      id: Number(id),
      paid: validatedData.paid,
    });

    return NextResponse.json(
      {
        id: expense.id,
        date: expense.created_at,
        description: expense.description,
        amount: expense.amount,
        category: expense.category?.name ?? '',
        paymentMethod: expense.wallet?.name || 'Efectivo',
        is_paid: expense.is_paid,
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

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'EXPENSE_TRANSFER_LOCKED'
    ) {
      return NextResponse.json(
        {
          error:
            'No se puede cambiar el estado de pago de un gasto generado por una transferencia',
        },
        { status: 400 },
      );
    }

    console.error('Error updating expense paid status:', error);
    return NextResponse.json(
      { error: 'Failed to update expense paid status' },
      { status: 500 },
    );
  }
}
