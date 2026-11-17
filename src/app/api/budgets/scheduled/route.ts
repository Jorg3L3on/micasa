import { NextRequest, NextResponse } from 'next/server';
import { withOwnerContext } from '@/lib/server/with-owner-context';
import { listScheduledPeriods } from '@/lib/finance/budget-period.service';

export async function GET(request: NextRequest) {
  try {
    return await withOwnerContext(request, async (context) => {
      const { ownerFilter } = context;

      const scheduled = await listScheduledPeriods(ownerFilter, new Date());
      return NextResponse.json(scheduled, { status: 200 });
    });
  } catch (error) {
    console.error('Error fetching scheduled budgets:', error);
    return NextResponse.json({ error: 'Failed to fetch scheduled budgets' }, { status: 500 });
  }
}
