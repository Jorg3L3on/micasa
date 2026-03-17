import { NextRequest, NextResponse } from 'next/server';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import { getDuePaymentsForCurrentFortnight } from '@/lib/finance/credit-card-statement.service';

export async function GET(request: NextRequest) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerFilter } = context;

    const duePayments = await getDuePaymentsForCurrentFortnight(ownerFilter);
    return NextResponse.json(duePayments, { status: 200 });
  } catch (error) {
    console.error('Error fetching due payments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch due payments' },
      { status: 500 },
    );
  }
}
