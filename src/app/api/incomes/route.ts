import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import prisma from '@/lib/prisma';

const createIncomeSchema = z.object({
  fortnight_id: z.number().int().positive(),
  amount: z.number().positive('Amount must be greater than 0'),
  source: z.string().optional().nullable(),
  received_at: z.string().min(1),
});

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
      select: { id: true, user_id: true, house_id: true },
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
          {
            error:
              'Fortnight does not belong to the same owner (user/house) as the income',
          },
          { status: 400 },
        );
      }
    } else {
      if (fortnight.house_id !== ownerId || fortnight.user_id != null) {
        return NextResponse.json(
          {
            error:
              'Fortnight does not belong to the same owner (user/house) as the income',
          },
          { status: 400 },
        );
      }
    }

    const created = await prisma.income.create({
      data: {
        fortnight_id: validated.fortnight_id,
        amount: validated.amount,
        source:
          validated.source && validated.source.length > 0
            ? validated.source
            : null,
        received_at: new Date(validated.received_at),
        ...ownerData,
      },
    });

    return NextResponse.json(created, { status: 201 });
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

