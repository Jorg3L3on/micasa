import { formatCalendarDate } from '@/lib/calendar-dates';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import prisma from '@/lib/prisma';
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
import type { Prisma } from '@/generated/prisma/client';
import { whereExcludeCreditInstallments } from '@/lib/finance/expense-planning-scope';
import {
  buildFortnightWhereForReport,
  listOrphanCreditCardPaymentsForPlanning,
  unionPaidAtRangeFromFortnights,
} from '@/lib/finance/planning-credit-card-payments';

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
    const excludeCreditInstallment =
      searchParams.get('exclude_credit_installment') === 'true' ||
      searchParams.get('exclude_credit_msi') === 'true';

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

    let expenseWhere: Prisma.ExpenseWhereInput = { ...ownerFilter };
    if (fortnightIds !== undefined) {
      expenseWhere.fortnight_id = { in: fortnightIds };
    }
    if (is_paid !== undefined) {
      expenseWhere.is_paid = is_paid;
    }
    if (excludeCreditInstallment) {
      expenseWhere = {
        AND: [expenseWhere, whereExcludeCreditInstallments()],
      };
    }

    const expenses = await prisma.expense.findMany({
      where: expenseWhere,
      include: {
        category: { select: { name: true, icon: true } },
        wallet: { select: { name: true, type: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    let orphanCardPayments: Awaited<
      ReturnType<typeof listOrphanCreditCardPaymentsForPlanning>
    > = [];
    if (excludeCreditInstallment && type !== 'income') {
      const fnWhere = buildFortnightWhereForReport(
        ownerFilter,
        month,
        year,
        period,
      );
      if (fnWhere != null) {
        const planningFortnights = await prisma.fortnight.findMany({
          where: fnWhere as Prisma.FortnightWhereInput,
          select: { start_date: true, end_date: true },
        });
        const paidAtRange = unionPaidAtRangeFromFortnights(planningFortnights);
        orphanCardPayments = await listOrphanCreditCardPaymentsForPlanning(
          ownerFilter,
          paidAtRange,
        );
      }
    }

    const expenseTransactions = expenses.map((expense) => {
      const dateValue = expense.payment_date || expense.created_at;
      const dateStr =
        dateValue instanceof Date
          ? formatCalendarDate(dateValue)
          : formatCalendarDate(new Date(dateValue));
      return {
        id: expense.id,
        date: dateStr,
        description: expense.description,
        amount: decimalToNumber(expense.amount),
        category: expense.category?.name ?? '',
        categoryIcon: expense.category?.icon ?? null,
        paymentMethod: expense.wallet?.name || 'Efectivo',
        wallet_id: expense.wallet_id ?? null,
        wallet_type: expense.wallet?.type ?? null,
        planning_row_kind: 'expense' as const,
        type: 'expense',
        is_paid: expense.is_paid,
        payment_date: expense.payment_date,
        due_day: (expense as { due_day?: number | null }).due_day ?? null,
      };
    });

    const cardPaymentTransactions =
      is_paid === false
        ? []
        : orphanCardPayments.map((p) => {
            const note = p.note?.trim();
            return {
              id: p.id,
              date: formatCalendarDate(p.paid_at),
              description: note
                ? `Pago tarjeta (${p.credit_card_wallet.name}): ${note}`
                : `Pago tarjeta: ${p.credit_card_wallet.name}`,
              amount: decimalToNumber(p.amount),
              category: 'Pago a tarjeta',
              categoryIcon: '💳',
              paymentMethod: p.source_wallet.name,
              wallet_type: p.source_wallet.type,
              planning_row_kind: 'card_payment' as const,
              type: 'expense' as const,
              is_paid: true,
              due_day: null,
            };
          });

    const incomeWhere: Record<string, unknown> = {
      ...ownerFilter,
      source: { not: '__OVERRIDE__' },
    };
    if (fortnightIds !== undefined) {
      incomeWhere.fortnight_id = { in: fortnightIds };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    incomeWhere.received_at = { lte: today };

    const incomes = await prisma.income.findMany({
      where: incomeWhere,
      orderBy: { received_at: 'desc' },
    });

    const incomeTransactions = incomes.map((income) => {
      const dateValue = income.received_at || income.created_at;
      const dateStr =
        dateValue instanceof Date
          ? formatCalendarDate(dateValue)
          : formatCalendarDate(new Date(dateValue));
      return {
        id: income.id,
        date: dateStr,
        description: income.source ?? 'Ingreso',
        amount: decimalToNumber(income.amount),
        category: '',
        categoryIcon: null,
        paymentMethod: 'Ingreso',
        type: 'income' as const,
        is_paid: true,
        due_day: null,
      };
    });

    let combined: Array<
      | (typeof expenseTransactions)[number]
      | (typeof cardPaymentTransactions)[number]
      | (typeof incomeTransactions)[number]
    > = [
      ...expenseTransactions,
      ...cardPaymentTransactions,
      ...incomeTransactions,
    ];

    if (type === 'income' || type === 'expense') {
      combined = combined.filter((t) => t.type === type);
    }

    combined.sort((a, b) => b.date.localeCompare(a.date));

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
    console.error('Error deleting transaction:', error);
    return NextResponse.json(
      { error: 'Failed to delete transaction' },
      { status: 500 },
    );
  }
}
