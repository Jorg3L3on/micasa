import { NextRequest, NextResponse } from 'next/server';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import {
  reportApiError,
  setOwnerSentryContext,
} from '@/lib/observability/report-error';
import { undoLenderPaymentForOwner } from '@/lib/finance/lender.service';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> },
) {
  const route = 'DELETE /api/lenders/[id]/payments/[paymentId]';
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

    const { id, paymentId: paymentIdParam } = await params;
    const lenderId = Number(id);
    const paymentId = Number(paymentIdParam);
    if (
      !Number.isInteger(lenderId) ||
      lenderId <= 0 ||
      !Number.isInteger(paymentId) ||
      paymentId <= 0
    ) {
      return NextResponse.json(
        { error: 'El id del pago es inválido' },
        { status: 400 },
      );
    }

    const lender = await undoLenderPaymentForOwner(
      lenderId,
      paymentId,
      context.ownerFilter,
    );
    return NextResponse.json(lender, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Error al deshacer el pago del prestamista';
    const notFound =
      message === 'Prestamista no encontrado' ||
      message === 'Pago del prestamista no encontrado';
    console.error('Error undoing lender payment:', error);
    reportApiError(error, { route, owner, status: notFound ? 404 : 400 });
    return NextResponse.json(
      { error: message },
      { status: notFound ? 404 : 400 },
    );
  }
}
