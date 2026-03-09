import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import prisma from '@/lib/prisma';
import {
  createTransactionSchema,
  updateTransactionSchema,
} from '@/schemas/transaction.schema';

function decimalToNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (
    typeof value === 'object' &&
    value != null &&
    'toNumber' in value &&
    typeof (value as { toNumber: () => number }).toNumber === 'function'
  ) {
    return (value as { toNumber: () => number }).toNumber();
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(request: NextRequest) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerFilter } = context;

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const period = searchParams.get('period');
    const type = searchParams.get('type');
    const isPaidParam = searchParams.get('is_paid');

    let fortnightIds: number[] | undefined;
    if (month || year || period) {
      const base: { month?: number; year?: number; period?: 'FIRST' | 'SECOND' } = {};
      if (month) base.month = parseInt(month, 10);
      if (year) base.year = parseInt(year, 10);
      if (period) base.period = period as 'FIRST' | 'SECOND';

      const fortnights = await prisma.fortnight.findMany({
        where: { ...ownerFilter, ...base },
        select: { id: true },
      });
      fortnightIds = fortnights.map((f) => f.id);
      if (fortnightIds.length === 0) fortnightIds = [];
    }

    const is_paid =
      isPaidParam === 'true'
        ? true
        : isPaidParam === 'false'
          ? false
          : undefined;

    const where: Record<string, unknown> = { ...ownerFilter };
    if (fortnightIds !== undefined) where.fortnight_id = { in: fortnightIds };
    if (is_paid !== undefined) where.is_paid = is_paid;

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        category: { select: { name: true } },
        wallet: { select: { name: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    const transactions = expenses.map((expense) => {
      const dateValue = expense.payment_date || expense.created_at;
      const dateStr =
        dateValue instanceof Date
          ? dateValue.toISOString().split('T')[0]
          : new Date(dateValue).toISOString().split('T')[0];
      return {
        id: expense.id,
        date: dateStr,
        description: expense.description,
        amount: decimalToNumber(expense.amount),
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
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerType, ownerId } = context;

    let ownerData: { user_id?: number; house_id?: number } = {};
    if (ownerType === 'user') {
      ownerData = { user_id: ownerId };
    }
    if (ownerType === 'house') {
      ownerData = { house_id: ownerId };
    }

    const body = await request.json();
    const validatedData = createTransactionSchema.parse(body);

    if (validatedData.amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 },
      );
    }

    const category = await prisma.category.findUnique({
      where: { id: validatedData.category_id },
    });
    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 },
      );
    }

    const fortnight = await prisma.fortnight.findUnique({
      where: { id: validatedData.fortnight_id },
      select: { id: true, user_id: true, house_id: true },
    });
    if (
      !fortnight ||
      (fortnight.user_id == null && fortnight.house_id == null) ||
      (fortnight.user_id != null && fortnight.house_id != null)
    ) {
      return NextResponse.json(
        { error: 'Invalid fortnight for this transaction' },
        { status: 400 },
      );
    }

    const walletId =
      (validatedData as { wallet_id?: number | null }).wallet_id ??
      validatedData.payment_method_id ??
      validatedData.card_id ??
      null;

    if (walletId != null) {
      const wallet = await prisma.wallet.findUnique({
        where: { id: walletId },
        select: { id: true, user_id: true, house_id: true },
      });
      if (!wallet) {
        return NextResponse.json(
          { error: 'Wallet not found' },
          { status: 404 },
        );
      }
      if (ownerType === 'user') {
        if (wallet.user_id !== ownerId || wallet.house_id != null) {
          return NextResponse.json(
            {
              error:
                'Wallet does not belong to the same owner (user/house) as the fortnight',
            },
            { status: 400 },
          );
        }
      } else {
        if (wallet.house_id !== ownerId || wallet.user_id != null) {
          return NextResponse.json(
            {
              error:
                'Wallet does not belong to the same owner (user/house) as the fortnight',
            },
            { status: 400 },
          );
        }
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          fortnight_id: validatedData.fortnight_id,
          category_id: validatedData.category_id,
          description: validatedData.description,
          amount: validatedData.amount,
          is_paid: validatedData.is_paid ?? false,
          payment_date: validatedData.payment_date
            ? new Date(validatedData.payment_date)
            : null,
          expense_template_id: validatedData.expense_template_id ?? null,
          wallet_id: walletId ?? undefined,
          ...ownerData,
        },
        include: {
          category: { select: { name: true } },
          wallet: { select: { name: true } },
        },
      });

      if (expense.is_paid && expense.wallet_id != null) {
        await tx.wallet.update({
          where: { id: expense.wallet_id },
          data: { amount: { decrement: expense.amount } },
        });
      }

      return expense;
    });

    const dateValue = created.payment_date || created.created_at;
    const dateStr =
      dateValue instanceof Date
        ? dateValue.toISOString().split('T')[0]
        : new Date(dateValue).toISOString().split('T')[0];

    return NextResponse.json(
      {
        id: created.id,
        date: dateStr,
        description: created.description,
        amount: decimalToNumber(created.amount),
        category: created.category?.name ?? '',
        paymentMethod: created.wallet?.name || 'Efectivo',
        type: 'expense',
        is_paid: created.is_paid,
        payment_date: created.payment_date,
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

    console.error('Error creating transaction:', error);
    return NextResponse.json(
      { error: 'Failed to create transaction' },
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
    const validatedData = updateTransactionSchema.parse(body);

    if (validatedData.amount !== undefined && validatedData.amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 },
      );
    }

    const existing = await prisma.expense.findFirst({
      where: { id: Number(id), ...ownerFilter },
      include: {
        transferAsUser: { select: { id: true } },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 },
      );
    }

    if (existing.transferAsUser != null) {
      return NextResponse.json(
        {
          error:
            'No se pueden actualizar gastos generados automáticamente por transferencias',
        },
        { status: 400 },
      );
    }

    const updateData: {
      fortnight_id?: number;
      category_id?: number;
      description?: string;
      amount?: number;
      is_paid?: boolean;
      payment_date?: Date | null;
      wallet_id?: number | null;
    } = {};
    if (validatedData.fortnight_id !== undefined)
      updateData.fortnight_id = validatedData.fortnight_id;
    if (validatedData.category_id !== undefined)
      updateData.category_id = validatedData.category_id;
    if (validatedData.description !== undefined)
      updateData.description = validatedData.description;
    if (validatedData.amount !== undefined) updateData.amount = validatedData.amount;
    if (validatedData.is_paid !== undefined)
      updateData.is_paid = validatedData.is_paid;
    if (validatedData.payment_date !== undefined) {
      updateData.payment_date = validatedData.payment_date
        ? new Date(validatedData.payment_date)
        : null;
    }
    const walletId =
      (validatedData as { wallet_id?: number | null }).wallet_id ??
      validatedData.card_id;
    if (walletId !== undefined) updateData.wallet_id = walletId ?? null;

    const transaction = await prisma.expense.update({
      where: { id: Number(id), ...ownerFilter },
      data: updateData,
      include: {
        category: { select: { name: true } },
        wallet: { select: { name: true } },
      },
    });

    const dateValue = transaction.payment_date || transaction.created_at;
    const dateStr =
      dateValue instanceof Date
        ? dateValue.toISOString().split('T')[0]
        : new Date(dateValue).toISOString().split('T')[0];

    return NextResponse.json(
      {
        id: transaction.id,
        date: dateStr,
        description: transaction.description,
        amount: decimalToNumber(transaction.amount),
        category: transaction.category?.name ?? '',
        paymentMethod: transaction.wallet?.name || 'Efectivo',
        type: 'expense',
        is_paid: transaction.is_paid,
        payment_date: transaction.payment_date,
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
      (error as { code: string }).code === 'P2025'
    ) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 },
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

    const expenseId = Number(id);

    const existing = await prisma.expense.findFirst({
      where: { id: expenseId, ...ownerFilter },
      select: {
        id: true,
        wallet_id: true,
        amount: true,
        is_paid: true,
        transferAsUser: { select: { id: true } },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 },
      );
    }

    if (existing.transferAsUser != null) {
      return NextResponse.json(
        {
          error:
            'No se pueden eliminar gastos generados automáticamente por transferencias',
        },
        { status: 400 },
      );
    }

    await prisma.$transaction(async (tx) => {
      if (existing.is_paid === true && existing.wallet_id != null) {
        await tx.wallet.update({
          where: { id: existing.wallet_id },
          data: { amount: { increment: existing.amount } },
        });
      }
      await tx.expense.delete({
        where: { id: expenseId, ...ownerFilter },
      });
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
      (error as { code: string }).code === 'P2025'
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
