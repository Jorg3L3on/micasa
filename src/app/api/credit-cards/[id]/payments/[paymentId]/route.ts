import { NextRequest, NextResponse } from 'next/server';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import { reverseCreditCardPayment } from '@/lib/finance/credit-card.service';
import { logFinanceEvent } from '@/lib/observability/finance-log';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> },
) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;

    const { id, paymentId: paymentIdParam } = await params;
    const creditCardId = Number(id);
    const paymentId = Number(paymentIdParam);

    if (
      !id ||
      Number.isNaN(creditCardId) ||
      !paymentIdParam ||
      Number.isNaN(paymentId)
    ) {
      return NextResponse.json(
        { error: 'Se requiere un id válido' },
        { status: 400 },
      );
    }

    const result = await reverseCreditCardPayment(
      creditCardId,
      paymentId,
      context.ownerFilter,
    );

    logFinanceEvent(
      'info',
      'credit_card.payment.reversed',
      {
        credit_card_wallet_id: creditCardId,
        payment_id: result.id,
        amount: result.amount,
        expense_id: result.expense_id,
        owner_type: context.ownerType,
        owner_id: context.ownerId,
      },
      request,
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'PAYMENT_NOT_FOUND'
    ) {
      return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 });
    }

    console.error('Error reversing credit card payment:', error);
    return NextResponse.json(
      { error: 'No se pudo revertir el pago' },
      { status: 500 },
    );
  }
}
