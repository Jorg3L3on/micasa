import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma/client';
import { TransferType } from '@/generated/prisma/client';
import { createUserToHouseTransfer } from '@/lib/transfers';
import { getOwnerContext } from '@/lib/server/get-owner-context';

const createTransferSchema = z.object({
  amount: z.number().positive(),
  user_id: z.number().int().positive(),
  house_id: z.number().int().positive(),
  user_wallet_id: z.number().int().positive().optional().nullable(),
  house_wallet_id: z.number().int().positive().optional().nullable(),
  user_fortnight_id: z.number().int().positive(),
  house_fortnight_id: z.number().int().positive(),
  note: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerType, ownerId } = context;

    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    const where: Prisma.TransferWhereInput = {
      type: TransferType.USER_TO_HOUSE,
      ...(ownerType === 'user'
        ? { user_id: ownerId }
        : { house_id: ownerId }),
    };

    if (fromParam || toParam) {
      where.created_at = {};
      if (fromParam) {
        const fromDate = new Date(fromParam);
        if (!Number.isNaN(fromDate.getTime())) {
          where.created_at.gte = fromDate;
        }
      }
      if (toParam) {
        const toDate = new Date(toParam);
        if (!Number.isNaN(toDate.getTime())) {
          where.created_at.lte = toDate;
        }
      }
      if (Object.keys(where.created_at).length === 0) {
        delete where.created_at;
      }
    }

    const transfers = await prisma.transfer.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
          },
        },
        house: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    const result = transfers.map((transfer) => ({
      id: transfer.id,
      amount: transfer.amount,
      type: transfer.type,
      user_id: transfer.user_id,
      house_id: transfer.house_id,
      userName: transfer.user.name,
      houseName: transfer.house.name,
      note: transfer.note ?? null,
      created_at: transfer.created_at,
    }));

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Error fetching transfers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transfers' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { userId, ownerType, ownerId } = context;

    const body = await request.json();
    const data = createTransferSchema.parse(body);

    // Only the authenticated user may transfer from their personal account.
    if (data.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Active owner context must match the transfer's user or house side.
    if (ownerType === 'user' && data.user_id !== ownerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (ownerType === 'house' && data.house_id !== ownerId) {
      return NextResponse.json(
        { error: 'Transfer house does not match active house context' },
        { status: 400 },
      );
    }

    const membership = await prisma.houseMember.findFirst({
      where: {
        house_id: data.house_id,
        user_id: userId,
      },
      select: { id: true },
    });
    if (!membership) {
      return NextResponse.json(
        { error: 'User is not a member of this house' },
        { status: 403 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: data.user_id },
      select: { id: true, active: true },
    });

    if (!user || !user.active) {
      return NextResponse.json(
        { error: 'User not found or inactive' },
        { status: 404 },
      );
    }

    const house = await prisma.house.findUnique({
      where: { id: data.house_id },
      select: { id: true },
    });

    if (!house) {
      return NextResponse.json(
        { error: 'House not found' },
        { status: 404 },
      );
    }

    const userFortnight = await prisma.fortnight.findUnique({
      where: { id: data.user_fortnight_id },
      select: { id: true, user_id: true, house_id: true },
    });

    if (
      !userFortnight ||
      userFortnight.user_id !== data.user_id ||
      userFortnight.house_id !== null
    ) {
      return NextResponse.json(
        { error: 'Invalid user fortnight for this transfer' },
        { status: 400 },
      );
    }

    const houseFortnight = await prisma.fortnight.findUnique({
      where: { id: data.house_fortnight_id },
      select: { id: true, user_id: true, house_id: true },
    });

    if (
      !houseFortnight ||
      houseFortnight.house_id !== data.house_id ||
      houseFortnight.user_id !== null
    ) {
      return NextResponse.json(
        { error: 'Invalid house fortnight for this transfer' },
        { status: 400 },
      );
    }

    const userWalletId: number | null | undefined = data.user_wallet_id ?? undefined;
    const houseWalletId: number | null | undefined =
      data.house_wallet_id ?? undefined;

    if (userWalletId != null) {
      const wallet = await prisma.wallet.findUnique({
        where: { id: userWalletId },
        select: { id: true, user_id: true, house_id: true },
      });
      if (!wallet || wallet.user_id !== data.user_id || wallet.house_id !== null) {
        return NextResponse.json(
          { error: 'Invalid user wallet for this transfer' },
          { status: 400 },
        );
      }
    }

    if (houseWalletId != null) {
      const wallet = await prisma.wallet.findUnique({
        where: { id: houseWalletId },
        select: { id: true, user_id: true, house_id: true },
      });
      if (!wallet || wallet.house_id !== data.house_id || wallet.user_id !== null) {
        return NextResponse.json(
          { error: 'Invalid house wallet for this transfer' },
          { status: 400 },
        );
      }
    }

    const transfer = await createUserToHouseTransfer({
      userId: data.user_id,
      houseId: data.house_id,
      amount: data.amount,
      userWalletId: userWalletId ?? null,
      houseWalletId: houseWalletId ?? null,
      userFortnightId: data.user_fortnight_id,
      houseFortnightId: data.house_fortnight_id,
      note: data.note ?? null,
    });

    const result = {
      id: transfer.id,
      amount: transfer.amount,
      type: transfer.type,
      user_id: transfer.user_id,
      house_id: transfer.house_id,
      note: transfer.note ?? null,
      created_at: transfer.created_at,
      user_expense_id: transfer.user_expense_id,
      house_income_id: transfer.house_income_id,
    };

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 },
      );
    }

    console.error('Error creating transfer:', error);
    return NextResponse.json(
      { error: 'Failed to create transfer' },
      { status: 500 },
    );
  }
}
