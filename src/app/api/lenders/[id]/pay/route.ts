import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import {
  reportApiError,
  setOwnerSentryContext,
} from '@/lib/observability/report-error';
import { payLenderForOwner } from '@/lib/finance/lender.service';
import { payLenderSchema } from '@/schemas/lender.schema';
import { logFinanceEvent } from '@/lib/observability/finance-log';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const route = 'POST /api/lenders/[id]/pay';
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
    const input = payLenderSchema.parse(body);
    const result = await payLenderForOwner(
      lenderId,
      context.ownerFilter,
      input,
    );

    logFinanceEvent(
      'info',
      'lender.payment.created',
      {
        lender_id: lenderId,
        amount: result.payment.amount,
        mode: result.payment.mode,
        owner_type: context.ownerType,
        owner_id: context.ownerId,
      },
      request,
    );

    return NextResponse.json(result, { status: 201 });
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
        : 'Error al pagar al prestamista';
    const notFound = message === 'Prestamista no encontrado';
    console.error('Error paying lender:', error);
    reportApiError(error, { route, owner, status: notFound ? 404 : 400 });
    return NextResponse.json(
      { error: message },
      { status: notFound ? 404 : 400 },
    );
  }
}
