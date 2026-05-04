import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import {
  createCreditCardSchema,
} from '@/schemas/credit-card.schema';
import {
  createCreditCardForOwner,
  listCreditCardsByOwner,
} from '@/lib/finance/credit-card.service';
import { AssigneeInvalidError } from '@/lib/server/house-members';

export async function GET(request: NextRequest) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;

    const cards = await listCreditCardsByOwner(context.ownerFilter);
    return NextResponse.json(cards, { status: 200 });
  } catch (error) {
    console.error('Error fetching credit cards:', error);
    return NextResponse.json(
      { error: 'No se pudieron cargar las tarjetas' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;

    const body = await request.json();
    const validatedData = createCreditCardSchema.parse(body);

    const card = await createCreditCardForOwner(
      context.ownerType,
      context.ownerId,
      validatedData,
    );

    return NextResponse.json(card, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Error de validación', details: error.issues },
        { status: 400 },
      );
    }

    if (error instanceof AssigneeInvalidError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('Error creating credit card:', error);
    return NextResponse.json(
      { error: 'No se pudo crear la tarjeta' },
      { status: 500 },
    );
  }
}
