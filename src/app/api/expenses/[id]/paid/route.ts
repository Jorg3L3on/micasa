import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import { updatePaidSchema } from '@/schemas/transaction.schema';
import { toggleExpensePaid } from '@/lib/finance/expense.service';
import { logFinanceEvent } from '@/lib/observability/finance-log';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let paidToggleLog: {
    owner_type: string;
    owner_id: number;
    expense_id: number;
    wallet_id: number | null;
    amount: number;
    paid: boolean;
  } | null = null;

  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerFilter } = context;

    const { id } = await params;

    if (!id || isNaN(Number(id))) {
      return NextResponse.json(
        { error: 'Valid id parameter is required' },
        { status: 400 },
      );
    }

    const expenseId = Number(id);
    const existing = await prisma.expense.findFirst({
      where: { id: expenseId, ...ownerFilter },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = updatePaidSchema.parse(body);

    paidToggleLog = {
      owner_type: context.ownerType,
      owner_id: context.ownerId,
      expense_id: expenseId,
      wallet_id: existing.wallet_id,
      amount: Number(existing.amount),
      paid: validatedData.paid,
    };

    const expense = await toggleExpensePaid({
      id: expenseId,
      paid: validatedData.paid,
      ownerFilter,
    });

    return NextResponse.json(
      {
        id: expense.id,
        date: expense.created_at,
        description: expense.description,
        amount: expense.amount,
        category: expense.category?.name ?? '',
        categoryIcon: expense.category?.icon ?? null,
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

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'EXPENSE_LOAN_PAYMENT_LOCKED'
    ) {
      return NextResponse.json(
        {
          error:
            'No se puede cambiar el estado de pago de un gasto generado por un préstamo',
        },
        { status: 400 },
      );
    }

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'EXPENSE_CARD_PAYMENT_LOCKED'
    ) {
      return NextResponse.json(
        {
          error:
            'No se puede cambiar el estado de pago de un gasto generado por un pago de tarjeta; revierte el pago desde la tarjeta',
        },
        { status: 400 },
      );
    }

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error.code === 'CREDIT_LIMIT_EXCEEDED' ||
        error.code === 'INSUFFICIENT_WALLET_BALANCE')
    ) {
      if (paidToggleLog) {
        logFinanceEvent(
          'warn',
          'finance.api.client_error',
          {
            route: 'PATCH /api/expenses/[id]/paid',
            error_code: error.code,
            ...paidToggleLog,
          },
          request,
        );
      }
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : 'No se puede marcar como pagado',
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
