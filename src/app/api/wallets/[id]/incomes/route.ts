import { parseCalendarDate } from '@/lib/calendar-dates';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import prisma from '@/lib/prisma';
import { getCalendarFortnightRefForYmd } from '@/lib/fortnight-calendar';
import { resolveOrCreateFortnight } from '@/lib/fortnights';
import {
  applyWalletAmountDelta,
  isSpendableCashWalletType,
} from '@/lib/finance/wallet-accounting';
import { dateStringSchema } from '@/schemas/common.schema';
import {
  assertOwnedCategoryOfKind,
  CategoryServiceError,
} from '@/lib/finance/category.service';

const bodySchema = z.object({
  date: dateStringSchema,
  amount: z.number().positive(),
  source: z.string().min(1),
  category_id: z.number().int().positive('La categoría es requerida'),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerFilter, ownerType, ownerId } = context;

    const { id } = await params;
    const walletId = Number(id);
    if (!Number.isFinite(walletId) || walletId <= 0) {
      return NextResponse.json(
        { error: 'Invalid wallet id' },
        { status: 400 },
      );
    }

    const wallet = await prisma.wallet.findFirst({
      where: { id: walletId, ...ownerFilter },
    });
    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet not found' },
        { status: 404 },
      );
    }
    if (!isSpendableCashWalletType(wallet.type)) {
      return NextResponse.json(
        {
          error:
            'Los ingresos en esta vista solo aplican a efectivo, débito y metas.',
        },
        { status: 400 },
      );
    }

    const body = await request.json();
    const data = bodySchema.parse(body);

    await assertOwnedCategoryOfKind(
      prisma,
      ownerType,
      ownerId,
      data.category_id,
      'INCOME',
    );

    const { year, month, period } = getCalendarFortnightRefForYmd(data.date);

    const fortnight = await resolveOrCreateFortnight({
      ownerType,
      ownerId,
      year,
      month,
      period,
    });

    const ownerData =
      ownerType === 'user'
        ? { user_id: ownerId, house_id: null }
        : { user_id: null, house_id: ownerId };

    const created = await prisma.$transaction(async (tx) => {
      const income = await tx.income.create({
        data: {
          fortnight_id: fortnight.id,
          amount: data.amount,
          source: data.source,
          received_at: parseCalendarDate(data.date),
          wallet_id: walletId,
          category_id: data.category_id,
          ...ownerData,
        },
      });
      await applyWalletAmountDelta(tx, walletId, data.amount);
      return income;
    });

    return NextResponse.json(
      {
        id: created.id,
        amount: Number(created.amount),
        source: created.source,
        received_at: created.received_at,
        fortnight_id: created.fortnight_id,
        wallet_id: created.wallet_id,
        category_id: created.category_id,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof CategoryServiceError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 },
      );
    }
    console.error('Error creating wallet income:', error);
    return NextResponse.json(
      { error: 'Failed to create income' },
      { status: 500 },
    );
  }
}
