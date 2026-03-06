import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { TransferType } from '@/generated/prisma/client';
import { createUserToHouseTransfer } from '@/lib/transfers';

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
    const { searchParams } = new URL(request.url);

    const userIdParam = searchParams.get('user_id');
    const houseIdParam = searchParams.get('house_id');
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    const where: any = {
      type: TransferType.USER_TO_HOUSE,
    };

    if (userIdParam) {
      const userId = Number(userIdParam);
      if (!Number.isNaN(userId)) {
        where.user_id = userId;
      }
    }

    if (houseIdParam) {
      const houseId = Number(houseIdParam);
      if (!Number.isNaN(houseId)) {
        where.house_id = houseId;
      }
    }

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
    const body = await request.json();
    const data = createTransferSchema.parse(body);

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

    let userWalletId: number | null | undefined = data.user_wallet_id ?? undefined;
    let houseWalletId: number | null | undefined =
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
      user_expense_id: (transfer as any).userExpenseId,
      house_income_id: (transfer as any).houseIncomeId,
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

