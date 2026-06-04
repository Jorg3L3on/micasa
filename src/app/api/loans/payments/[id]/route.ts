import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { updateLoanPaymentForOwner } from '@/lib/finance/loan.service';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import { updateLoanPaymentSchema } from '@/schemas/loan.schema';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;

    const { id } = await params;
    const paymentId = Number(id);
    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      return NextResponse.json(
        { error: 'El id del pago es inválido' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const input = updateLoanPaymentSchema.parse(body);
    const payment = await updateLoanPaymentForOwner(
      paymentId,
      context.ownerFilter,
      input,
    );

    return NextResponse.json(payment, { status: 200 });
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
        : 'Error al actualizar el pago del préstamo';
    console.error('Error updating loan payment:', error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
