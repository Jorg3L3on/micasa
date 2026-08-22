import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import {
  createScheduledPayment,
  listScheduledPaymentsForCard,
} from '@/lib/finance/credit-card-scheduled-payment.service';
import { createCreditCardScheduledPaymentSchema } from '@/schemas/credit-card-scheduled-payment.schema';

type RouteParams = { params: Promise<{ id: string }> };

const parseWalletId = async (params: RouteParams['params']) => {
  const { id } = await params;
  const walletId = Number(id);
  if (!id || !Number.isFinite(walletId) || walletId <= 0) {
    return null;
  }
  return walletId;
};

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const context = await getOwnerContext(_request);
    if ('error' in context) return context.error;

    const walletId = await parseWalletId(params);
    if (walletId == null) {
      return NextResponse.json(
        { error: 'Valid id parameter is required' },
        { status: 400 },
      );
    }

    const items = await listScheduledPaymentsForCard(
      walletId,
      context.ownerFilter,
    );
    return NextResponse.json({ items }, { status: 200 });
  } catch (error) {
    console.error('Error listing scheduled card payments:', error);
    return NextResponse.json(
      { error: 'Failed to list scheduled payments' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;

    const walletId = await parseWalletId(params);
    if (walletId == null) {
      return NextResponse.json(
        { error: 'Valid id parameter is required' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const validated = createCreditCardScheduledPaymentSchema.parse(body);
    const item = await createScheduledPayment(
      walletId,
      context.ownerFilter,
      validated,
    );

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 },
      );
    }

    const code = (error as { code?: string }).code;
    if (code === 'WALLET_NOT_FOUND') {
      return NextResponse.json({ error: (error as Error).message }, { status: 404 });
    }

    console.error('Error creating scheduled card payment:', error);
    return NextResponse.json(
      { error: 'Failed to create scheduled payment' },
      { status: 500 },
    );
  }
}
