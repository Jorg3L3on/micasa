import { coerceToCalendarDate } from '@/lib/calendar-dates';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import prisma from '@/lib/prisma';
import { resolveOrCreateFortnight } from '@/lib/fortnights';
import { createUserToHouseTransfer } from '@/lib/finance/transfer.service';
import { applyWalletAmountDelta } from '@/lib/finance/wallet-accounting';

const createIncomeSchema = z.object({
  fortnight_id: z.number().int().positive(),
  amount: z.number().positive('Amount must be greater than 0'),
  source: z.string().optional().nullable(),
  received_at: z.string().min(1),
  transfer_from_user_id: z.number().int().positive().optional(),
  income_template_id: z.number().int().positive().optional().nullable(),
  wallet_id: z.number().int().positive().optional().nullable(),
});

const updateIncomeAmountSchema = z.object({
  amount: z.number().min(0, 'El monto debe ser mayor o igual a 0'),
  wallet_id: z.number().int().positive().optional().nullable(),
  force_wallet_credit: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerFilter } = context;

    const { searchParams } = new URL(request.url);
    const fortnightIdRaw = searchParams.get('fortnightId');
    const fortnightId = fortnightIdRaw ? parseInt(fortnightIdRaw, 10) : NaN;
    if (Number.isNaN(fortnightId) || fortnightId < 1) {
      return NextResponse.json(
        { error: 'Valid fortnightId parameter is required' },
        { status: 400 },
      );
    }

    const incomes = await prisma.income.findMany({
      where: { ...ownerFilter, fortnight_id: fortnightId },
      orderBy: { received_at: 'asc' },
    });

    return NextResponse.json(
      incomes.map((i) => ({
        id: i.id,
        amount: Number(i.amount),
        source: i.source,
        received_at: i.received_at,
        fortnight_id: i.fortnight_id,
        income_template_id: i.income_template_id,
        wallet_id: i.wallet_id,
      })),
      { status: 200 },
    );
  } catch (error) {
    console.error('Error fetching incomes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch incomes' },
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
    const idRaw = searchParams.get('id');
    const id = idRaw ? parseInt(idRaw, 10) : NaN;
    if (Number.isNaN(id) || id < 1) {
      return NextResponse.json(
        { error: 'Valid id parameter is required' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const validated = updateIncomeAmountSchema.parse(body);

    const income = await prisma.income.findFirst({
      where: { id, ...ownerFilter },
    });
    if (!income) {
      return NextResponse.json(
        { error: 'Income not found' },
        { status: 404 },
      );
    }

    const oldAmount = Number(income.amount);
    const newAmount = validated.amount;
    const oldWalletId = income.wallet_id;
    // Use wallet from request if explicitly provided, otherwise keep existing
    const newWalletId = validated.wallet_id !== undefined ? validated.wallet_id : oldWalletId;

    const updated = await prisma.$transaction(async (tx) => {
      if (oldWalletId === null && newWalletId != null) {
        // First time assigning a wallet — credit the full amount
        await applyWalletAmountDelta(tx, newWalletId, newAmount);
      } else if (oldWalletId != null && newWalletId === null) {
        // Wallet removed — reverse the previous credit
        await applyWalletAmountDelta(tx, oldWalletId, -oldAmount);
      } else if (oldWalletId != null && newWalletId != null) {
        if (oldWalletId === newWalletId) {
          if (validated.force_wallet_credit === true) {
            // Recovery path: explicit re-credit when historical data has wallet_id set
            // but the wallet balance was never incremented.
            await applyWalletAmountDelta(tx, newWalletId, newAmount);
          } else {
            // Same wallet — only adjust by the difference
            const delta = newAmount - oldAmount;
            if (delta !== 0) await applyWalletAmountDelta(tx, newWalletId, delta);
          }
        } else {
          // Wallet changed — reverse old, credit new
          await applyWalletAmountDelta(tx, oldWalletId, -oldAmount);
          await applyWalletAmountDelta(tx, newWalletId, newAmount);
        }
      }
      // oldWalletId === null && newWalletId === null → nothing to do

      return tx.income.update({
        where: { id },
        data: {
          amount: newAmount,
          wallet_id: newWalletId,
        },
      });
    });

    return NextResponse.json(
      {
        id: updated.id,
        amount: Number(updated.amount),
        source: updated.source,
        received_at: updated.received_at,
        fortnight_id: updated.fortnight_id,
        income_template_id: updated.income_template_id,
        wallet_id: updated.wallet_id,
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
    console.error('Error updating income amount:', error);
    return NextResponse.json(
      { error: 'Failed to update income amount' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerType, ownerId } = context;

    const ownerData: { user_id?: number | null; house_id?: number | null } =
      ownerType === 'user'
        ? { user_id: ownerId, house_id: null }
        : { user_id: null, house_id: ownerId };

    const body = await request.json();
    const validated = createIncomeSchema.parse(body);

    const fortnight = await prisma.fortnight.findUnique({
      where: { id: validated.fortnight_id },
      select: {
        id: true,
        user_id: true,
        house_id: true,
        year: true,
        month: true,
        period: true,
      },
    });

    if (
      !fortnight ||
      (fortnight.user_id == null && fortnight.house_id == null) ||
      (fortnight.user_id != null && fortnight.house_id != null)
    ) {
      return NextResponse.json(
        { error: 'Invalid fortnight for this income' },
        { status: 400 },
      );
    }

    if (ownerType === 'user') {
      if (fortnight.user_id !== ownerId || fortnight.house_id != null) {
        return NextResponse.json(
          { error: 'Fortnight does not belong to the same owner (user/house) as the income' },
          { status: 400 },
        );
      }
    } else {
      if (fortnight.house_id !== ownerId || fortnight.user_id != null) {
        return NextResponse.json(
          { error: 'Fortnight does not belong to the same owner (user/house) as the income' },
          { status: 400 },
        );
      }
    }

    const transferFromUserId = validated.transfer_from_user_id;

    if (ownerType === 'house' && transferFromUserId != null) {
      const membership = await prisma.houseMember.findFirst({
        where: {
          house_id: ownerId,
          user_id: transferFromUserId,
        },
      });

      if (!membership) {
        return NextResponse.json(
          { error: 'User is not a member of this house' },
          { status: 400 },
        );
      }

      const userFortnight = await resolveOrCreateFortnight({
        ownerType: 'user',
        ownerId: transferFromUserId,
        year: fortnight.year,
        month: fortnight.month,
        period: fortnight.period,
      });

      const transfer = await createUserToHouseTransfer({
        userId: transferFromUserId,
        houseId: ownerId,
        amount: validated.amount,
        userFortnightId: userFortnight.id,
        houseFortnightId: validated.fortnight_id,
        note:
          validated.source && validated.source.length > 0
            ? validated.source
            : null,
        date: coerceToCalendarDate(validated.received_at),
        userWalletId: null,
        houseWalletId: null,
      });

      type TransferWithHouseIncome = {
        house_income: {
          id: number;
          amount: unknown;
          source: string | null;
          received_at: Date;
          fortnight_id: number;
          house_id: number;
          wallet_id: number | null;
        };
      };
      const houseIncome = (transfer as unknown as TransferWithHouseIncome).house_income;
      return NextResponse.json(
        {
          id: houseIncome.id,
          amount: houseIncome.amount,
          source: houseIncome.source,
          received_at: houseIncome.received_at,
          fortnight_id: houseIncome.fortnight_id,
          house_id: houseIncome.house_id,
          user_id: null,
          wallet_id: houseIncome.wallet_id ?? null,
        },
        { status: 201 },
      );
    }

    const walletId = validated.wallet_id ?? null;

    const created = await prisma.$transaction(async (tx) => {
      const income = await tx.income.create({
        data: {
          fortnight_id: validated.fortnight_id,
          amount: validated.amount,
          source:
            validated.source && validated.source.length > 0
              ? validated.source
              : null,
          received_at: coerceToCalendarDate(validated.received_at),
          income_template_id: validated.income_template_id ?? null,
          wallet_id: walletId,
          ...ownerData,
        },
      });

      // Credit the wallet
      if (walletId != null) {
        await applyWalletAmountDelta(tx, walletId, validated.amount);
      }

      return income;
    });

    return NextResponse.json(
      {
        id: created.id,
        amount: Number(created.amount),
        source: created.source,
        received_at: created.received_at,
        fortnight_id: created.fortnight_id,
        income_template_id: created.income_template_id,
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

    console.error('Error creating income:', error);
    return NextResponse.json(
      { error: 'Failed to create income' },
      { status: 500 },
    );
  }
}
