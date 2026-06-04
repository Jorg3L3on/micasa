import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import {
  createTransactionSchema,
  updateTransactionSchema,
} from '@/schemas/transaction.schema';
import {
  createExpense,
  deleteExpense,
  updateExpense,
} from '@/lib/finance/expense.service';
import { logFinanceEvent } from '@/lib/observability/finance-log';
import { listPlanningTransactions } from '@/lib/finance/planning-transactions.service';

const decimalToNumber = (value: unknown): number => {
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
};

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
    const excludeCreditInstallment =
      searchParams.get('exclude_credit_installment') === 'true' ||
      searchParams.get('exclude_credit_msi') === 'true';

    const isPaid =
      isPaidParam === 'true'
        ? true
        : isPaidParam === 'false'
          ? false
          : undefined;

    const combined = await listPlanningTransactions({
      ownerFilter,
      month,
      year,
      period,
      type,
      isPaid,
      excludeCreditInstallment,
    });

    return NextResponse.json(combined, { status: 200 });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  let transactionCreateLog: {
    owner_type: string;
    owner_id: number;
    wallet_id: number | null;
    amount: number;
  } | null = null;

  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerFilter } = context;

    const body = await request.json();
    const validatedData = createTransactionSchema.parse(body);

    if (validatedData.amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 },
      );
    }

    const category = await prisma.category.findFirst({
      where: { id: validatedData.category_id, ...ownerFilter },
    });
    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 },
      );
    }

    const fortnight = await prisma.fortnight.findFirst({
      where: { id: validatedData.fortnight_id, ...ownerFilter },
      select: { id: true },
    });
    if (!fortnight) {
      return NextResponse.json(
        { error: 'Fortnight not found' },
        { status: 404 },
      );
    }

    const walletId =
      (validatedData as { wallet_id?: number | null }).wallet_id ??
      validatedData.payment_method_id ??
      validatedData.card_id ??
      null;

    if (walletId != null) {
      const wallet = await prisma.wallet.findFirst({
        where: { id: walletId, ...ownerFilter },
        select: { id: true },
      });
      if (!wallet) {
        return NextResponse.json(
          { error: 'Wallet not found' },
          { status: 404 },
        );
      }
    }

    transactionCreateLog = {
      owner_type: context.ownerType,
      owner_id: context.ownerId,
      wallet_id: walletId,
      amount: validatedData.amount,
    };

    const created = await createExpense({
      fortnightId: validatedData.fortnight_id,
      categoryId: validatedData.category_id,
      description: validatedData.description,
      amount: validatedData.amount,
      isPaid: validatedData.is_paid ?? false,
      paymentDate: validatedData.payment_date ?? null,
      expenseTemplateId: validatedData.expense_template_id ?? null,
      walletId,
      creditInstallmentCurrent: validatedData.credit_installment_current ?? null,
      creditInstallmentTotal: validatedData.credit_installment_total ?? null,
    });

    return NextResponse.json(
      {
        ...created,
        amount: decimalToNumber(created.amount),
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
      ((error as { code: string }).code === 'CREDIT_LIMIT_EXCEEDED' ||
        (error as { code: string }).code === 'INSUFFICIENT_WALLET_BALANCE')
    ) {
      if (transactionCreateLog) {
        logFinanceEvent(
          'warn',
          'finance.api.client_error',
          {
            route: 'POST /api/transactions',
            error_code: (error as { code: string }).code,
            ...transactionCreateLog,
          },
          request,
        );
      }
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : 'Invalid transaction',
          code: (error as { code: string }).code,
        },
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
  let transactionUpdateLog: {
    owner_type: string;
    owner_id: number;
    expense_id: number;
    wallet_id: number | null | undefined;
    amount: number | undefined;
  } | null = null;

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
        loan_payment: { select: { id: true } },
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

    if (existing.loan_payment != null) {
      return NextResponse.json(
        {
          error:
            'No se pueden actualizar gastos generados automáticamente por pagos de préstamos',
        },
        { status: 400 },
      );
    }

    const walletId =
      (validatedData as { wallet_id?: number | null }).wallet_id ??
      validatedData.card_id;

    if (validatedData.fortnight_id !== undefined) {
      const fortnight = await prisma.fortnight.findFirst({
        where: { id: validatedData.fortnight_id, ...ownerFilter },
        select: { id: true },
      });

      if (!fortnight) {
        return NextResponse.json({ error: 'Fortnight not found' }, { status: 404 });
      }
    }

    if (validatedData.category_id !== undefined) {
      const category = await prisma.category.findFirst({
        where: { id: validatedData.category_id, ...ownerFilter },
        select: { id: true },
      });

      if (!category) {
        return NextResponse.json({ error: 'Category not found' }, { status: 404 });
      }
    }

    if (walletId !== undefined && walletId !== null) {
      const wallet = await prisma.wallet.findFirst({
        where: { id: walletId, ...ownerFilter },
        select: { id: true },
      });

      if (!wallet) {
        return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
      }
    }

    transactionUpdateLog = {
      owner_type: context.ownerType,
      owner_id: context.ownerId,
      expense_id: Number(id),
      wallet_id: walletId,
      amount: validatedData.amount,
    };

    const transaction = await updateExpense({
      id: Number(id),
      fortnightId: validatedData.fortnight_id,
      categoryId: validatedData.category_id,
      description: validatedData.description,
      amount: validatedData.amount,
      isPaid: validatedData.is_paid,
      paymentDate: validatedData.payment_date,
      walletId,
    });

    return NextResponse.json(
      {
        ...transaction,
        amount: decimalToNumber(transaction.amount),
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
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      ((error as { code: string }).code === 'CREDIT_LIMIT_EXCEEDED' ||
        (error as { code: string }).code === 'INSUFFICIENT_WALLET_BALANCE')
    ) {
      if (transactionUpdateLog) {
        logFinanceEvent(
          'warn',
          'finance.api.client_error',
          {
            route: 'PUT /api/transactions',
            error_code: (error as { code: string }).code,
            ...transactionUpdateLog,
          },
          request,
        );
      }
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : 'Invalid transaction',
          code: (error as { code: string }).code,
        },
        { status: 400 },
      );
    }
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'EXPENSE_CARD_PAYMENT_LOCKED'
    ) {
      return NextResponse.json(
        {
          error:
            'No se pueden modificar gastos generados automáticamente por pagos de tarjeta; revierte el pago desde la tarjeta',
        },
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
        loan_payment: { select: { id: true } },
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

    if (existing.loan_payment != null) {
      return NextResponse.json(
        {
          error:
            'No se pueden eliminar gastos generados automáticamente por pagos de préstamos',
        },
        { status: 400 },
      );
    }

    const cardPaymentExpense = await prisma.creditCardPayment.findFirst({
      where: { expense_id: expenseId },
      select: { id: true },
    });
    if (cardPaymentExpense != null) {
      return NextResponse.json(
        {
          error:
            'No se pueden eliminar gastos generados automáticamente por pagos de tarjeta; revierte el pago desde la tarjeta',
        },
        { status: 400 },
      );
    }

    await deleteExpense({ id: expenseId });

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
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'EXPENSE_LOAN_PAYMENT_LOCKED'
    ) {
      return NextResponse.json(
        {
          error:
            'No se pueden modificar gastos generados automáticamente por pagos de préstamos',
        },
        { status: 400 },
      );
    }
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'EXPENSE_CARD_PAYMENT_LOCKED'
    ) {
      return NextResponse.json(
        {
          error:
            'No se pueden modificar gastos generados automáticamente por pagos de tarjeta; revierte el pago desde la tarjeta',
        },
        { status: 400 },
      );
    }
    console.error('Error deleting transaction:', error);
    return NextResponse.json(
      { error: 'Failed to delete transaction' },
      { status: 500 },
    );
  }
}
