import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import {
  deleteScheduledPayment,
  updateScheduledPayment,
} from '@/lib/finance/credit-card-scheduled-payment.service';
import { updateCreditCardScheduledPaymentSchema } from '@/schemas/credit-card-scheduled-payment.schema';

type RouteParams = { params: Promise<{ id: string; paymentId: string }> };

const parseIds = async (params: RouteParams['params']) => {
  const { id, paymentId } = await params;
  const walletId = Number(id);
  const scheduledPaymentId = Number(paymentId);
  if (
    !id ||
    !paymentId ||
    !Number.isFinite(walletId) ||
    walletId <= 0 ||
    !Number.isFinite(scheduledPaymentId) ||
    scheduledPaymentId <= 0
  ) {
    return null;
  }
  return { walletId, scheduledPaymentId };
};

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;

    const ids = await parseIds(params);
    if (ids == null) {
      return NextResponse.json(
        { error: 'Valid id parameters are required' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const validated = updateCreditCardScheduledPaymentSchema.parse(body);
    const item = await updateScheduledPayment(
      ids.scheduledPaymentId,
      ids.walletId,
      context.ownerFilter,
      validated,
    );

    return NextResponse.json(item, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 },
      );
    }

    const code = (error as { code?: string }).code;
    if (code === 'NOT_FOUND') {
      return NextResponse.json({ error: (error as Error).message }, { status: 404 });
    }
    if (code === 'ALREADY_PAID') {
      return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }

    console.error('Error updating scheduled card payment:', error);
    return NextResponse.json(
      { error: 'Failed to update scheduled payment' },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const context = await getOwnerContext(_request);
    if ('error' in context) return context.error;

    const ids = await parseIds(params);
    if (ids == null) {
      return NextResponse.json(
        { error: 'Valid id parameters are required' },
        { status: 400 },
      );
    }

    await deleteScheduledPayment(
      ids.scheduledPaymentId,
      ids.walletId,
      context.ownerFilter,
    );

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'NOT_FOUND') {
      return NextResponse.json({ error: (error as Error).message }, { status: 404 });
    }
    if (code === 'ALREADY_PAID') {
      return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }

    console.error('Error deleting scheduled card payment:', error);
    return NextResponse.json(
      { error: 'Failed to delete scheduled payment' },
      { status: 500 },
    );
  }
}
