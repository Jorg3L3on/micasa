import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import prisma from '@/lib/prisma';
import { getFortnightPeriodForDay } from '@/lib/fortnight-calendar';
import { resolveOrCreateFortnight } from '@/lib/fortnights';
import { createExpense } from '@/lib/finance/expense.service';
import { logFinanceEvent } from '@/lib/observability/finance-log';

const bodySchema = z.object({
  name: z.string().min(1),
  categoryId: z.number().int().positive(),
  amount: z.number().positive(),
  paymentMethodId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isPaid: z.boolean(),
  isRecurring: z.boolean(),
  applyToBothFortnights: z.boolean(),
  expenseTemplateId: z.number().int().positive().nullable().optional(),
});

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

function toDateStr(value: Date | string | null | undefined): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  return d.toISOString().split('T')[0];
}

export async function POST(request: NextRequest) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerFilter, ownerType, ownerId } = context;

    const body = await request.json();
    const data = bodySchema.parse(body);

    const category = await prisma.category.findFirst({
      where: { id: data.categoryId, ...ownerFilter },
    });
    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 },
      );
    }

    const wallet = await prisma.wallet.findFirst({
      where: { id: data.paymentMethodId, ...ownerFilter },
      select: { id: true },
    });
    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet not found' },
        { status: 404 },
      );
    }

    const [yearStr, monthStr, dayStr] = data.date.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    const period = getFortnightPeriodForDay(day);

    const fortnight = await resolveOrCreateFortnight({
      ownerType,
      ownerId,
      year,
      month,
      period,
    });

    const created = await createExpense({
      fortnightId: fortnight.id,
      categoryId: data.categoryId,
      description: data.name,
      amount: data.amount,
      isPaid: data.isPaid,
      paymentDate: data.isPaid ? data.date : null,
      expenseTemplateId: data.expenseTemplateId ?? null,
      walletId: data.paymentMethodId,
    });

    if (data.isRecurring && data.applyToBothFortnights) {
      const otherPeriod = period === 'FIRST' ? 'SECOND' : 'FIRST';
      const otherDay = otherPeriod === 'FIRST' ? Math.min(day, 15) : 16;
      const otherDate = `${yearStr}-${monthStr}-${String(otherDay).padStart(2, '0')}`;
      const otherFortnight = await resolveOrCreateFortnight({
        ownerType,
        ownerId,
        year,
        month,
        period: otherPeriod,
      });
      try {
        await createExpense({
          fortnightId: otherFortnight.id,
          categoryId: data.categoryId,
          description: data.name,
          amount: data.amount,
          isPaid: false,
          paymentDate: null,
          expenseTemplateId: data.expenseTemplateId ?? null,
          walletId: data.paymentMethodId,
        });
      } catch (err) {
        logFinanceEvent(
          'warn',
          'finance.api.client_error',
          {
            route: 'POST /api/expenses',
            error: err instanceof Error ? err.message : String(err),
            context: 'applyToBothFortnights',
          },
          request,
        );
      }
      void otherDate;
    }

    return NextResponse.json(
      {
        id: created.id,
        description: created.description,
        amount: decimalToNumber(created.amount),
        date: toDateStr(created.payment_date),
        category: created.category ?? null,
        paymentMethod: created.paymentMethod ?? null,
        walletType: null,
        isPaid: data.isPaid,
        isRecurring: data.expenseTemplateId != null,
        creditInstallmentCurrent: null,
        creditInstallmentTotal: null,
        categoryId: data.categoryId,
        walletId: data.paymentMethodId,
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
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Invalid expense' },
        { status: 400 },
      );
    }
    console.error('Error creating expense from feed:', error);
    return NextResponse.json(
      { error: 'Failed to create expense' },
      { status: 500 },
    );
  }
}
