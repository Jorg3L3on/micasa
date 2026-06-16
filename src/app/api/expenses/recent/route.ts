import { formatCalendarDate } from '@/lib/calendar-dates';
import { NextRequest, NextResponse } from 'next/server';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import prisma from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma/client';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

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

function parseCursor(raw: string | null): { date: Date; id: number } | null {
  if (!raw) return null;
  const [dateStr, idStr] = raw.split('_');
  if (!dateStr || !idStr) return null;
  const date = new Date(dateStr);
  const id = Number(idStr);
  if (Number.isNaN(date.getTime()) || !Number.isFinite(id)) return null;
  return { date, id };
}

function toDateStr(value: Date | string | null | undefined): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  return formatCalendarDate(d);
}

export async function GET(request: NextRequest) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerFilter } = context;

    const { searchParams } = new URL(request.url);
    const limitRaw = Number(searchParams.get('limit') ?? DEFAULT_LIMIT);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(1, Math.trunc(limitRaw)), MAX_LIMIT)
      : DEFAULT_LIMIT;
    const cursor = parseCursor(searchParams.get('cursor'));

    const where: Prisma.ExpenseWhereInput = {
      ...ownerFilter,
      is_paid: true,
      loan_payment_id: null,
    };

    if (cursor) {
      where.AND = [
        {
          OR: [
            { created_at: { lt: cursor.date } },
            {
              AND: [
                { created_at: cursor.date },
                { id: { lt: cursor.id } },
              ],
            },
          ],
        },
      ];
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, icon: true } },
        wallet: { select: { id: true, name: true, type: true } },
      },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const hasMore = expenses.length > limit;
    const pageItems = hasMore ? expenses.slice(0, limit) : expenses;

    const items = pageItems.map((e) => ({
      id: e.id,
      description: e.description,
      amount: decimalToNumber(e.amount),
      date: toDateStr(e.payment_date ?? e.created_at),
      category: e.category?.name ?? null,
      categoryIcon: e.category?.icon ?? null,
      paymentMethod: e.wallet?.name ?? null,
      walletType: e.wallet?.type ?? null,
      isPaid: e.is_paid,
      isRecurring: e.expense_template_id != null,
      creditInstallmentCurrent: e.credit_installment_current ?? null,
      creditInstallmentTotal: e.credit_installment_total ?? null,
      categoryId: e.category?.id ?? null,
      walletId: e.wallet?.id ?? null,
    }));

    const last = pageItems[pageItems.length - 1];
    const nextCursor =
      hasMore && last?.created_at
        ? `${new Date(last.created_at).toISOString()}_${last.id}`
        : null;

    return NextResponse.json({ items, nextCursor }, { status: 200 });
  } catch (error) {
    console.error('Error fetching recent expenses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recent expenses' },
      { status: 500 },
    );
  }
}
