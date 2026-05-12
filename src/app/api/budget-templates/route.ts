import { NextRequest, NextResponse } from 'next/server';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import { listBudgetsByOwner } from '@/lib/finance/budget.service';

export async function GET(request: NextRequest) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerFilter } = context;

    const templates = await listBudgetsByOwner(ownerFilter);
    return NextResponse.json(templates, { status: 200 });
  } catch (error) {
    console.error('Error fetching budget templates:', error);
    return NextResponse.json({ error: 'Failed to fetch budget templates' }, { status: 500 });
  }
}
