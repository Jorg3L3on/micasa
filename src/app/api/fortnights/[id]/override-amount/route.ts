import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import { overrideAmountSchema } from '@/schemas/fortnight.schema';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerFilter } = context;

    const { id } = await params;

    if (!id || isNaN(Number(id))) {
      return NextResponse.json(
        { error: 'Valid id parameter is required' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const validatedData = overrideAmountSchema.parse(body);

    const fortnight = await prisma.fortnight.findFirst({
      where: { id: Number(id), ...ownerFilter },
    });

    if (!fortnight) {
      return NextResponse.json(
        { error: 'Fortnight not found' },
        { status: 404 },
      );
    }

    // Verify the fortnight matches the year/month
    if (
      fortnight.year !== validatedData.year ||
      fortnight.month !== validatedData.month
    ) {
      return NextResponse.json(
        { error: 'Fortnight year/month mismatch' },
        { status: 400 },
      );
    }

    // NOTE: The current schema does not have a dedicated field for storing
    // fortnight-specific amount overrides. We store the override in Income
    // with a special source marker (__OVERRIDE__). The reports API checks
    // for this override when calculating "Tenemos".

    const fortnightId = Number(id);
    const isUserContext = ownerFilter.user_id !== null;
    const userIdForOverride = isUserContext ? ownerFilter.user_id : null;
    const houseIdForOverride = !isUserContext ? ownerFilter.house_id : null;

    await prisma.income.deleteMany({
      where: {
        fortnight_id: fortnightId,
        source: '__OVERRIDE__',
      },
    });

    await prisma.income.create({
      data: {
        fortnight_id: fortnightId,
        user_id: userIdForOverride,
        house_id: houseIdForOverride,
        amount: validatedData.amount.toString(),
        source: '__OVERRIDE__',
        received_at: fortnight.start_date,
      },
    });

    return NextResponse.json(
      {
        message: 'Override amount saved successfully',
        amount: validatedData.amount,
        fortnightId: Number(id),
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

    console.error('Error saving override amount:', error);
    return NextResponse.json(
      { error: 'Failed to save override amount' },
      { status: 500 },
    );
  }
}
