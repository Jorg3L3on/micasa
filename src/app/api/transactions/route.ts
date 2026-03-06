import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import {
  createTransactionSchema,
  updateTransactionSchema,
} from '@/schemas/transaction.schema';
import {
  createExpense,
  updateExpense,
} from '@/lib/finance/expense.service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const period = searchParams.get('period');
    const type = searchParams.get('type');

    const where: any = {};

    const isPaid = searchParams.get('is_paid');
    if (isPaid) {
      where.is_paid = isPaid === 'true';
    }

    if (month || year || period) {
      const fortnightWhere: any = {};
      if (month) {
        fortnightWhere.month = parseInt(month, 10);
      }
      if (year) {
        fortnightWhere.year = parseInt(year, 10);
      }
      if (period) {
        fortnightWhere.period = period;
      }

      // Find fortnights that match the month/year/period criteria
      const fortnights = await prisma.fortnight.findMany({
        where: fortnightWhere,
        select: { id: true },
      });

      const fortnightIds = fortnights.map((f) => f.id);
      if (fortnightIds.length > 0) {
        where.fortnight_id = { in: fortnightIds };
      } else {
        // No matching fortnights, return empty result
        where.fortnight_id = { in: [] };
      }
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        category: {
          select: {
            name: true,
          },
        },
        wallet: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    const transactions = expenses.map((expense) => {
      // Normalize date to ISO string format for consistent grouping
      const dateValue = expense.payment_date || expense.created_at;
      const dateStr =
        dateValue instanceof Date
          ? dateValue.toISOString().split('T')[0]
          : new Date(dateValue).toISOString().split('T')[0];

      return {
        id: expense.id,
        date: dateStr,
        description: expense.description,
        amount: expense.amount,
        category: expense.category?.name ?? '',
        paymentMethod: expense.wallet?.name || 'Efectivo',
        type: 'expense',
        is_paid: expense.is_paid,
        payment_date: expense.payment_date,
        due_day: (expense as { due_day?: number | null }).due_day ?? null,
      };
    });

    let filteredTransactions = transactions;
    if (type) {
      filteredTransactions = transactions.filter((t) => t.type === type);
    }

    return NextResponse.json(filteredTransactions, { status: 200 });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createTransactionSchema.parse(body);

    try {
      const transaction = await createExpense({
        fortnightId: validatedData.fortnight_id,
        categoryId: validatedData.category_id,
        description: validatedData.description,
        amount: validatedData.amount,
        isPaid: validatedData.is_paid,
        paymentDate: validatedData.payment_date ?? null,
        expenseTemplateId: validatedData.expense_template_id ?? null,
        walletId:
          (validatedData as { wallet_id?: number | null }).wallet_id ??
          validatedData.payment_method_id ??
          validatedData.card_id ??
          null,
      });

      return NextResponse.json(transaction, { status: 201 });
    } catch (error: any) {
      if (error.code === 'INVALID_AMOUNT') {
        return NextResponse.json(
          { error: 'Amount must be greater than 0' },
          { status: 400 },
        );
      }
      if (error.code === 'CATEGORY_NOT_FOUND') {
        return NextResponse.json(
          { error: 'Category not found' },
          { status: 404 },
        );
      }
      if (error.code === 'INVALID_FORTNIGHT') {
        return NextResponse.json(
          { error: 'Invalid fortnight for this transaction' },
          { status: 400 },
        );
      }
      if (error.code === 'WALLET_NOT_FOUND') {
        return NextResponse.json(
          { error: 'Wallet not found' },
          { status: 404 },
        );
      }
      if (error.code === 'INVALID_WALLET_OWNER') {
        return NextResponse.json(
          {
            error:
              'Wallet does not belong to the same owner (user/house) as the fortnight',
          },
          { status: 400 },
        );
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 },
      );
    }

    console.error('Error creating transaction:', error);
    return NextResponse.json(
      { error: 'Failed to create transaction' },
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
    const validatedData = updateTransactionSchema.parse(body);

    if (validatedData.amount !== undefined && validatedData.amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 },
      );
    }
    try {
      const transaction = await updateExpense({
        id: Number(id),
        fortnightId: validatedData.fortnight_id,
        categoryId: validatedData.category_id,
        description: validatedData.description,
        amount: validatedData.amount,
        isPaid: validatedData.is_paid,
        paymentDate: validatedData.payment_date ?? null,
        walletId:
          (validatedData as { wallet_id?: number | null }).wallet_id ??
          validatedData.card_id ??
          undefined,
      });

      return NextResponse.json(transaction, { status: 200 });
    } catch (error: any) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          { error: 'Transaction not found' },
          { status: 404 },
        );
      }
      if (error.code === 'EXPENSE_TRANSFER_LOCKED') {
        return NextResponse.json(
          {
            error:
              'No se pueden actualizar gastos generados automáticamente por transferencias',
          },
          { status: 400 },
        );
      }
      if (error.code === 'INVALID_FORTNIGHT') {
        return NextResponse.json(
          { error: 'Invalid fortnight for this transaction' },
          { status: 400 },
        );
      }
      if (
        error.code === 'INVALID_WALLET_OWNER' ||
        error.code === 'WALLET_NOT_FOUND'
      ) {
        const message =
          error.code === 'WALLET_NOT_FOUND'
            ? 'Wallet not found'
            : error.message ?? 'Invalid wallet owner';
        const status = error.code === 'WALLET_NOT_FOUND' ? 404 : 400;
        return NextResponse.json({ error: message }, { status });
      }
      throw error;
    }
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
        { error: 'Transaction not found' },
        { status: 404 },
      );
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
            'No se pueden actualizar gastos generados automáticamente por transferencias',
        },
        { status: 400 },
      );
    }

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error.code === 'INVALID_FORTNIGHT' ||
        error.code === 'INVALID_WALLET_OWNER' ||
        error.code === 'WALLET_NOT_FOUND')
    ) {
      return NextResponse.json(
        { error: (error as { message?: string }).message ?? 'Invalid data' },
        { status: 400 },
      );
    }

    console.error('Error updating transaction:', error);
    return NextResponse.json(
      { error: 'Failed to update transaction' },
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

    await prisma.expense.delete({
      where: { id: Number(id) },
    });

    return NextResponse.json(
      { message: 'Transaction deleted successfully' },
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
        { error: 'Transaction not found' },
        { status: 404 },
      );
    }

    console.error('Error deleting transaction:', error);
    return NextResponse.json(
      { error: 'Failed to delete transaction' },
      { status: 500 },
    );
  }
}
