import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import { createCreditCardPaymentSchema } from '@/schemas/credit-card.schema';
import { createCreditCardPayment } from '@/lib/finance/credit-card.service';
import { logFinanceEvent } from '@/lib/observability/finance-log';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let paymentLogContext: {
    owner_type: string;
    owner_id: number;
    credit_card_wallet_id: number;
    source_wallet_id: number;
    amount: number;
  } | null = null;

  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;

    const { id } = await params;
    const creditCardId = Number(id);

    if (!id || Number.isNaN(creditCardId)) {
      return NextResponse.json(
        { error: 'Se requiere un id válido' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const validatedData = createCreditCardPaymentSchema.parse(body);

    paymentLogContext = {
      owner_type: context.ownerType,
      owner_id: context.ownerId,
      credit_card_wallet_id: creditCardId,
      source_wallet_id: validatedData.source_wallet_id,
      amount: validatedData.amount,
    };

    const payment = await createCreditCardPayment(
      creditCardId,
      context.ownerFilter,
      validatedData,
    );

    logFinanceEvent(
      'info',
      'credit_card.payment.created',
      {
        credit_card_wallet_id: creditCardId,
        source_wallet_id: payment.source_wallet_id,
        amount: payment.amount,
        owner_type: context.ownerType,
        owner_id: context.ownerId,
      },
      request,
    );

    return NextResponse.json(payment, { status: 201 });
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
      error.code === 'P2025'
    ) {
      return NextResponse.json({ error: 'Tarjeta no encontrada' }, { status: 404 });
    }

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'WALLET_NOT_FOUND'
    ) {
      return NextResponse.json(
        { error: 'Billetera no encontrada' },
        { status: 404 },
      );
    }

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'INVALID_PAYMENT_AMOUNT'
    ) {
      return NextResponse.json(
        { error: 'El monto del pago no puede superar la deuda actual de la tarjeta' },
        { status: 400 },
      );
    }

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'INSUFFICIENT_SOURCE_BALANCE'
    ) {
      if (paymentLogContext) {
        logFinanceEvent(
          'warn',
          'finance.api.client_error',
          {
            route: 'POST /api/credit-cards/[id]/payment',
            error_code: 'INSUFFICIENT_SOURCE_BALANCE',
            ...paymentLogContext,
          },
          request,
        );
      }
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : 'Saldo insuficiente en la billetera de origen',
        },
        { status: 400 },
      );
    }

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'CATEGORY_NOT_FOUND'
    ) {
      return NextResponse.json(
        { error: 'Categoría no encontrada' },
        { status: 404 },
      );
    }

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error.code === 'INVALID_CREDIT_CARD' ||
        error.code === 'INVALID_PAYMENT_SOURCE_WALLET' ||
        error.code === 'INVALID_PAYMENT_SOURCE_OWNER' ||
        error.code === 'INVALID_CARD_OWNER')
    ) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : 'Solicitud de pago no válida',
        },
        { status: 400 },
      );
    }

    console.error('Error creating credit card payment:', error);
    return NextResponse.json(
      { error: 'No se pudo registrar el pago' },
      { status: 500 },
    );
  }
}
