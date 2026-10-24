import { NextRequest, NextResponse } from 'next/server';
import { withOwnerContext } from '@/lib/server/with-owner-context';
import { listBudgetsByOwner } from '@/lib/finance/budget.service';

export async function GET(request: NextRequest) {
  try {
    return await withOwnerContext(request, async (context) => {
      const { ownerFilter } = context;

      const templates = await listBudgetsByOwner(ownerFilter);
      return NextResponse.json(templates, { status: 200 });
    });
  } catch (error) {
    console.error('Error fetching budget templates:', error);
    return NextResponse.json({ error: 'Failed to fetch budget templates' }, { status: 500 });
  }
}
