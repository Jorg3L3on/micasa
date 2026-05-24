import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import {
  clearCreditCardPaymentPlan,
  upsertCreditCardPaymentPlan,
} from '@/lib/finance/credit-card-payment-plan.service';
import { cardPaymentPlanSchema } from '@/schemas/credit-card-payment-plan.schema';

type RouteParams = { params: Promise<{ id: string }> };

const parseFortnightId = async (params: RouteParams['params']) => {
  const { id } = await params;
  const fortnightId = Number(id);
  if (!id || !Number.isFinite(fortnightId) || fortnightId <= 0) {
    return null;
  }
  return fortnightId;
};

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;

    const fortnightId = await parseFortnightId(params);
    if (fortnightId == null) {
      return NextResponse.json(
        { error: 'Valid id parameter is required' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const validated = cardPaymentPlanSchema.parse(body);

    const plan = await upsertCreditCardPaymentPlan(
      context.ownerFilter,
      fortnightId,
      validated.walletId,
      validated.plannedAmount,
    );

    return NextResponse.json(
      {
        walletId: plan.credit_card_wallet_id,
        fortnightId: plan.fortnight_id,
        plannedAmount: Number(plan.planned_amount),
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 },
      );
    }

    const code = (error as { code?: string }).code;
    if (code === 'FORTNIGHT_NOT_FOUND' || code === 'WALLET_NOT_FOUND') {
      return NextResponse.json({ error: (error as Error).message }, { status: 404 });
    }
    if (code === 'AMOUNT_EXCEEDS_BALANCE') {
      return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }

    console.error('Error saving card payment plan:', error);
    return NextResponse.json(
      { error: 'Failed to save card payment plan' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;

    const fortnightId = await parseFortnightId(params);
    if (fortnightId == null) {
      return NextResponse.json(
        { error: 'Valid id parameter is required' },
        { status: 400 },
      );
    }

    const walletIdRaw = request.nextUrl.searchParams.get('walletId');
    const walletId = walletIdRaw != null ? Number(walletIdRaw) : NaN;
    if (!Number.isFinite(walletId) || walletId <= 0) {
      return NextResponse.json(
        { error: 'walletId query parameter is required' },
        { status: 400 },
      );
    }

    await clearCreditCardPaymentPlan(
      context.ownerFilter,
      fortnightId,
      walletId,
    );

    return NextResponse.json({ walletId, fortnightId }, { status: 200 });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'FORTNIGHT_NOT_FOUND') {
      return NextResponse.json({ error: (error as Error).message }, { status: 404 });
    }

    console.error('Error clearing card payment plan:', error);
    return NextResponse.json(
      { error: 'Failed to clear card payment plan' },
      { status: 500 },
    );
  }
}
