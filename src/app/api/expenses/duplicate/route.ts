import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import prisma from '@/lib/prisma';
import { getFortnightPeriodForDay } from '@/lib/fortnight-calendar';
import { resolveOrCreateFortnight } from '@/lib/fortnights';
import { createExpense } from '@/lib/finance/expense.service';

const bodySchema = z.object({
  id: z.number().int().positive(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
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

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function POST(request: NextRequest) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerFilter, ownerType, ownerId } = context;

    const body = await request.json();
    const data = bodySchema.parse(body);
    const date = data.date ?? todayStr();

    const source = await prisma.expense.findFirst({
      where: { id: data.id, ...ownerFilter },
      select: {
        description: true,
        amount: true,
        category_id: true,
        wallet_id: true,
      },
    });
    if (!source || source.category_id == null || source.wallet_id == null) {
      return NextResponse.json(
        { error: 'Expense not found' },
        { status: 404 },
      );
    }

    const [yearStr, monthStr, dayStr] = date.split('-');
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
      categoryId: source.category_id,
      description: source.description,
      amount: decimalToNumber(source.amount),
      isPaid: true,
      paymentDate: date,
      expenseTemplateId: null,
      walletId: source.wallet_id,
    });

    return NextResponse.json(
      {
        id: created.id,
        description: created.description,
        amount: decimalToNumber(created.amount),
        date: toDateStr(created.payment_date),
        category: created.category ?? null,
        categoryIcon: created.categoryIcon ?? null,
        paymentMethod: created.paymentMethod ?? null,
        walletType: null,
        isPaid: true,
        isRecurring: false,
        creditInstallmentCurrent: null,
        creditInstallmentTotal: null,
        categoryId: source.category_id,
        walletId: source.wallet_id,
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
    console.error('Error duplicating expense:', error);
    return NextResponse.json(
      { error: 'Failed to duplicate expense' },
      { status: 500 },
    );
  }
}
