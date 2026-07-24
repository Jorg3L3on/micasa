import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import {
  reportApiError,
  setOwnerSentryContext,
} from '@/lib/observability/report-error';
import {
  createLoanForOwner,
  listLoansByOwner,
} from '@/lib/finance/loan.service';
import { createLoanSchema } from '@/schemas/loan.schema';

export async function GET(request: NextRequest) {
  const route = 'GET /api/loans';
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    setOwnerSentryContext({
      userId: context.userId,
      ownerType: context.ownerType,
      ownerId: context.ownerId,
    });

    const loans = await listLoansByOwner(context.ownerFilter);
    return NextResponse.json(loans, { status: 200 });
  } catch (error) {
    console.error('Error fetching loans:', error);
    reportApiError(error, { route, status: 500 });
    return NextResponse.json(
      { error: 'Error al obtener los préstamos' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const route = 'POST /api/loans';
  let owner:
    | { userId: number; ownerType: 'user' | 'house'; ownerId: number }
    | undefined;
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    owner = {
      userId: context.userId,
      ownerType: context.ownerType,
      ownerId: context.ownerId,
    };
    setOwnerSentryContext(owner);

    const body = await request.json();
    const input = createLoanSchema.parse(body);
    const loan = await createLoanForOwner(
      context.ownerType,
      context.ownerId,
      context.ownerFilter,
      input,
    );

    return NextResponse.json(loan, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Error de validación', details: error.issues },
        { status: 400 },
      );
    }
    const message =
      error instanceof Error ? error.message : 'Error al crear el préstamo';
    console.error('Error creating loan:', error);
    // Unexpected failures historically returned 400; still report them.
    reportApiError(error, { route, owner });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
