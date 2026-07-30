import { NextRequest, NextResponse } from 'next/server';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import { listScheduledPeriods } from '@/lib/finance/budget-period.service';

export async function GET(request: NextRequest) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerFilter } = context;

    const scheduled = await listScheduledPeriods(ownerFilter, new Date());
    return NextResponse.json(scheduled, { status: 200 });
  } catch (error) {
    console.error('Error fetching scheduled budgets:', error);
    return NextResponse.json({ error: 'Failed to fetch scheduled budgets' }, { status: 500 });
  }
}
