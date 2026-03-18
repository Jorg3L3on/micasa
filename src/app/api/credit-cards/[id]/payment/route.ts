import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import { createCreditCardPaymentSchema } from '@/schemas/credit-card.schema';
import { createCreditCardPayment } from '@/lib/finance/credit-card.service';

export async function POST(
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

    const body = await request.json();
    const validatedData = createCreditCardPaymentSchema.parse(body);

    const payment = await createCreditCardPayment(
      creditCardId,
      context.ownerFilter,
      validatedData,
    );

    return NextResponse.json(payment, { status: 201 });
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
      error.code === 'WALLET_NOT_FOUND'
    ) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'INVALID_PAYMENT_AMOUNT'
    ) {
      return NextResponse.json(
        { error: 'Payment amount cannot exceed current card debt' },
        { status: 400 },
      );
    }

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error.code === 'INVALID_CREDIT_CARD' ||
        error.code === 'INVALID_PAYMENT_SOURCE_WALLET' ||
        error.code === 'INVALID_PAYMENT_SOURCE_OWNER')
    ) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Invalid payment request' },
        { status: 400 },
      );
    }

    console.error('Error creating credit card payment:', error);
    return NextResponse.json(
      { error: 'Failed to create credit card payment' },
      { status: 500 },
    );
  }
}
