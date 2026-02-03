import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { overrideAmountSchema } from '@/schemas/fortnight.schema';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    if (!id || isNaN(Number(id))) {
      return NextResponse.json(
        { error: 'Valid id parameter is required' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const validatedData = overrideAmountSchema.parse(body);

    // Find the fortnight
    const fortnight = await prisma.fortnight.findUnique({
      where: { id: Number(id) },
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

    // Get the first active user (override applies to total, not per-user)
    const firstUser = await prisma.user.findFirst({
      where: { active: true },
      select: { id: true },
    });

    if (!firstUser) {
      return NextResponse.json(
        { error: 'No active user found' },
        { status: 404 },
      );
    }

    // Delete existing override (marked with source = '__OVERRIDE__')
    await prisma.income.deleteMany({
      where: {
        fortnight_id: Number(id),
        source: '__OVERRIDE__',
      },
    });

    // Create override entry (override applies to total). Income requires received_at.
    await prisma.income.create({
      data: {
        fortnight_id: Number(id),
        user_id: firstUser.id,
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
