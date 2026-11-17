import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma/client';
import { TransferType } from '@/generated/prisma/client';
import { withOwnerContext } from '@/lib/server/with-owner-context';
import { DomainError } from '@/lib/finance/domain-error';
import { transferUserToHouse } from '@/lib/finance/house-transfer.service';

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
    return await withOwnerContext(request, async (context) => {
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
    });
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
    return await withOwnerContext(request, async (context) => {
      const body = await request.json();
      const data = createTransferSchema.parse(body);

      const transfer = await transferUserToHouse(context, {
        userId: data.user_id,
        houseId: data.house_id,
        amount: data.amount,
        userWalletId: data.user_wallet_id ?? null,
        houseWalletId: data.house_wallet_id ?? null,
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
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 },
      );
    }
    if (error instanceof DomainError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Error creating transfer:', error);
    return NextResponse.json(
      { error: 'Failed to create transfer' },
      { status: 500 },
    );
  }
}
