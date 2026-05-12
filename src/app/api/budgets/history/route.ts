import { NextRequest, NextResponse } from 'next/server';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import { listHistoryPeriods } from '@/lib/finance/budget-period.service';

export async function GET(request: NextRequest) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerFilter } = context;

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const monthParam = searchParams.get('month');

    const now = new Date();
    const year = yearParam ? parseInt(yearParam, 10) : now.getFullYear();
    const month = monthParam ? parseInt(monthParam, 10) : now.getMonth() + 1;

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: 'Año y mes inválidos' }, { status: 400 });
    }

    const history = await listHistoryPeriods(ownerFilter, year, month);
    return NextResponse.json(history, { status: 200 });
  } catch (error) {
    console.error('Error fetching budget history:', error);
    return NextResponse.json({ error: 'Failed to fetch budget history' }, { status: 500 });
  }
}
