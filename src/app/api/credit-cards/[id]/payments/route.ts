import { NextRequest, NextResponse } from 'next/server';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import { listCreditCardPaymentsByOwner } from '@/lib/finance/credit-card.service';

export async function GET(
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
        { error: 'Se requiere un id válido' },
        { status: 400 },
      );
    }

    const payments = await listCreditCardPaymentsByOwner(
      creditCardId,
      context.ownerFilter,
    );

    return NextResponse.json(payments, { status: 200 });
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2025'
    ) {
      return NextResponse.json({ error: 'Tarjeta no encontrada' }, { status: 404 });
    }

    console.error('Error fetching credit card payments:', error);
    return NextResponse.json(
      { error: 'No se pudieron cargar los pagos' },
      { status: 500 },
    );
  }
}
