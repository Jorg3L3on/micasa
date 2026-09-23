import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import {
  reportApiError,
  setOwnerSentryContext,
} from '@/lib/observability/report-error';
import { splitLenderForOwner } from '@/lib/finance/lender.service';
import { splitLenderSchema } from '@/schemas/lender.schema';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const route = 'POST /api/lenders/[id]/split';
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

    const { id } = await params;
    const lenderId = Number(id);
    if (!Number.isInteger(lenderId) || lenderId <= 0) {
      return NextResponse.json(
        { error: 'El id del prestamista es inválido' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const input = splitLenderSchema.parse(body);
    const lender = await splitLenderForOwner(
      lenderId,
      context.ownerType,
      context.ownerId,
      context.ownerFilter,
      input,
    );
    return NextResponse.json(lender, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Error de validación', details: error.issues },
        { status: 400 },
      );
    }
    const message =
      error instanceof Error
        ? error.message
        : 'Error al separar el prestamista';
    const notFound = message === 'Prestamista no encontrado';
    console.error('Error splitting lender:', error);
    reportApiError(error, { route, owner, status: notFound ? 404 : 400 });
    return NextResponse.json(
      { error: message },
      { status: notFound ? 404 : 400 },
    );
  }
}
