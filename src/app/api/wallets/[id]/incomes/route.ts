import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import prisma from '@/lib/prisma';
import { getFortnightPeriodForDay } from '@/lib/fortnight-calendar';
import { resolveOrCreateFortnight } from '@/lib/fortnights';
import { applyWalletAmountDelta } from '@/lib/finance/wallet-accounting';

const bodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().positive(),
  source: z.string().min(1),
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
    if (wallet.type !== 'CASH' && wallet.type !== 'DEBIT_CARD') {
      return NextResponse.json(
        {
          error:
            'Los ingresos en esta vista solo aplican a efectivo y débito.',
        },
        { status: 400 },
      );
    }

    const body = await request.json();
    const data = bodySchema.parse(body);

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
          received_at: new Date(`${data.date}T12:00:00.000Z`),
          wallet_id: walletId,
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
    console.error('Error creating wallet income:', error);
    return NextResponse.json(
      { error: 'Failed to create income' },
      { status: 500 },
    );
  }
}
