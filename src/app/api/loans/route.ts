import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import {
  createLoanForOwner,
  listLoansByOwner,
} from '@/lib/finance/loan.service';
import { createLoanSchema } from '@/schemas/loan.schema';

export async function GET(request: NextRequest) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;

    const loans = await listLoansByOwner(context.ownerFilter);
    return NextResponse.json(loans, { status: 200 });
  } catch (error) {
    console.error('Error fetching loans:', error);
    return NextResponse.json(
      { error: 'Error al obtener los préstamos' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;

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
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
