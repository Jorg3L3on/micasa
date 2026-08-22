import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { batchUpdateLoanPaymentsForOwner } from '@/lib/finance/loan.service';
import {
  reportApiError,
  setOwnerSentryContext,
} from '@/lib/observability/report-error';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import { batchUpdateLoanPaymentsSchema } from '@/schemas/loan.schema';

export async function POST(request: NextRequest) {
  const route = 'POST /api/loans/payments/batch';
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

    const body = await request.json();
    const input = batchUpdateLoanPaymentsSchema.parse(body);
    const payments = await batchUpdateLoanPaymentsForOwner(context.ownerFilter, {
      paymentIds: input.paymentIds,
      action: input.action,
      paidAt: input.paidAt,
      sourceWalletId: input.sourceWalletId ?? undefined,
      note: input.note,
    });

    return NextResponse.json({ payments }, { status: 200 });
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
        : 'Error al actualizar los pagos del préstamo';
    console.error('Error batch updating loan payments:', error);
    reportApiError(error, { route, owner });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
