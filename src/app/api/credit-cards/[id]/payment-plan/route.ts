import { NextRequest, NextResponse } from 'next/server';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import { getCreditCardPaymentPlanViews } from '@/lib/finance/credit-card-payment-plan.service';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const context = await getOwnerContext(_request);
    if ('error' in context) return context.error;

    const { id } = await params;
    const walletId = Number(id);
    if (!id || !Number.isFinite(walletId) || walletId <= 0) {
      return NextResponse.json(
        { error: 'Valid id parameter is required' },
        { status: 400 },
      );
    }

    const items = await getCreditCardPaymentPlanViews(context.ownerFilter, walletId);
    return NextResponse.json({ items }, { status: 200 });
  } catch (error) {
    console.error('Error fetching credit card payment plan:', error);
    return NextResponse.json(
      { error: 'Failed to fetch credit card payment plan' },
      { status: 500 },
    );
  }
}
