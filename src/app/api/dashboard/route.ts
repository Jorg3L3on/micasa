import { getDashboardData } from '@/features/dashboard/server/dashboard.service';
import { NextRequest, NextResponse } from 'next/server';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import type { PeriodView } from '@/types/dashboard';

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

    const data = await getDashboardData({
      ownerFilter,
      view,
      month: monthParam,
      year: yearParam,
      period: periodParam,
    });

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: 'Failed to load dashboard data' },
      { status: 500 },
    );
  }
}
