import { NextRequest, NextResponse } from 'next/server';
import { withOwnerContext } from '@/lib/server/with-owner-context';
import { getCreditCardPaymentPlanViews } from '@/lib/finance/credit-card-payment-plan.service';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    return await withOwnerContext(_request, async (context) => {
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
    });
  } catch (error) {
    console.error('Error fetching credit card payment plan:', error);
    return NextResponse.json(
      { error: 'Failed to fetch credit card payment plan' },
      { status: 500 },
    );
  }
}
