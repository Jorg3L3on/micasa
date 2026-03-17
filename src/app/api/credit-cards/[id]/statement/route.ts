import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import {
  creditCardStatementQuerySchema,
} from '@/schemas/credit-card.schema';
import { getCreditCardStatementByOwner } from '@/lib/finance/credit-card-statement.service';

export async function GET(
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

    const { searchParams } = new URL(request.url);
    const query = creditCardStatementQuerySchema.parse({
      asOf: searchParams.get('asOf') ?? undefined,
    });

    const statement = await getCreditCardStatementByOwner(
      creditCardId,
      context.ownerFilter,
      query.asOf ? new Date(`${query.asOf}T12:00:00.000Z`) : undefined,
    );

    return NextResponse.json(statement, { status: 200 });
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

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'INVALID_CREDIT_CARD'
    ) {
      return NextResponse.json(
        { error: 'Wallet is not configured as a credit card' },
        { status: 400 },
      );
    }

    console.error('Error fetching credit card statement:', error);
    return NextResponse.json(
      { error: 'Failed to fetch credit card statement' },
      { status: 500 },
    );
  }
}
