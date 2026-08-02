import { NextRequest, NextResponse } from 'next/server';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import { getAlerts } from '@/features/alerts/server/alerts.service';
import type { PeriodView } from '@/features/alerts/server/alerts.types';

export async function GET(request: NextRequest) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerFilter } = context;

    const { searchParams } = new URL(request.url);
    const view = (searchParams.get('view') as PeriodView) || 'biweekly';
    const monthParam = searchParams.get('month');
    const yearParam = searchParams.get('year');
    const periodParam = searchParams.get('period') as 'FIRST' | 'SECOND' | null;

    const data = await getAlerts({
      ownerFilter,
      view,
      month: monthParam,
      year: yearParam,
      period: periodParam,
    });

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error('Alerts API error:', error);
    return NextResponse.json(
      { error: 'Failed to load alerts' },
      { status: 500 },
    );
  }
}
