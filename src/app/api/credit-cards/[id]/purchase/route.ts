import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import { createCreditCardPurchaseSchema } from '@/schemas/credit-card.schema';
import { createCreditCardPurchase } from '@/lib/finance/credit-card.service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;

    const { id } = await params;
    const creditCardId = Number(id);

    if (!id || Number.isNaN(creditCardId)) {
      return NextResponse.json(
        { error: 'Valid id parameter is required' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const validatedData = createCreditCardPurchaseSchema.parse(body);

    const [fortnight, category] = await Promise.all([
      prisma.fortnight.findFirst({
        where: { id: validatedData.fortnight_id, ...context.ownerFilter },
        select: { id: true },
      }),
      prisma.category.findFirst({
        where: { id: validatedData.category_id, ...context.ownerFilter },
        select: { id: true },
      }),
    ]);

    if (!fortnight) {
      return NextResponse.json({ error: 'Fortnight not found' }, { status: 404 });
    }

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const purchase = await createCreditCardPurchase(
      creditCardId,
      context.ownerFilter,
      validatedData,
    );

    return NextResponse.json(purchase, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 },
      );
    }

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2025'
    ) {
      return NextResponse.json({ error: 'Credit card not found' }, { status: 404 });
    }

    console.error('Error creating credit card purchase:', error);
    return NextResponse.json(
      { error: 'Failed to create credit card purchase' },
      { status: 500 },
    );
  }
}
