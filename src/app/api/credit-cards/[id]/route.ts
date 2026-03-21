import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import { updateCreditCardSchema } from '@/schemas/credit-card.schema';
import {
  getCreditCardByOwner,
  updateCreditCardForOwner,
} from '@/lib/finance/credit-card.service';

const parseCreditCardId = async (params: Promise<{ id: string }>) => {
  const { id } = await params;
  const creditCardId = Number(id);

  if (!id || Number.isNaN(creditCardId)) {
    const error = new Error('Se requiere un id válido');
    (error as { code?: string }).code = 'INVALID_ID';
    throw error;
  }

  return creditCardId;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;

    const creditCardId = await parseCreditCardId(params);
    const card = await getCreditCardByOwner(creditCardId, context.ownerFilter);
    return NextResponse.json(card, { status: 200 });
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'INVALID_ID'
    ) {
      return NextResponse.json(
        { error: 'Se requiere un id válido' },
        { status: 400 },
      );
    }

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2025'
    ) {
      return NextResponse.json({ error: 'Tarjeta no encontrada' }, { status: 404 });
    }

    console.error('Error fetching credit card:', error);
    return NextResponse.json(
      { error: 'No se pudo cargar la tarjeta' },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;

    const creditCardId = await parseCreditCardId(params);
    const body = await request.json();
    const validatedData = updateCreditCardSchema.parse(body);

    const card = await updateCreditCardForOwner(
      creditCardId,
      validatedData,
      context.ownerFilter,
    );

    return NextResponse.json(card, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Error de validación', details: error.issues },
        { status: 400 },
      );
    }

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'INVALID_ID'
    ) {
      return NextResponse.json(
        { error: 'Se requiere un id válido' },
        { status: 400 },
      );
    }

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2025'
    ) {
      return NextResponse.json({ error: 'Tarjeta no encontrada' }, { status: 404 });
    }

    console.error('Error updating credit card:', error);
    return NextResponse.json(
      { error: 'No se pudo actualizar la tarjeta' },
      { status: 500 },
    );
  }
}
