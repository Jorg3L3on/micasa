import { NextRequest, NextResponse } from 'next/server';
import { withOwnerContext } from '@/lib/server/with-owner-context';
import { getAlerts } from '@/features/alerts/server/alerts.service';
import type { PeriodView } from '@/features/alerts/server/alerts.types';
import {
  fortnightPeriodParamError,
  parseFortnightPeriod,
} from '@/lib/finance/report-helpers';

export async function GET(request: NextRequest) {
  try {
    return await withOwnerContext(request, async (context) => {
      const { ownerFilter } = context;

      const { searchParams } = new URL(request.url);
      const view = (searchParams.get('view') as PeriodView) || 'biweekly';
      const monthParam = searchParams.get('month');
      const yearParam = searchParams.get('year');
      const periodRaw = searchParams.get('period');
      const periodError = fortnightPeriodParamError(periodRaw);
      if (periodError) {
        return NextResponse.json({ error: periodError }, { status: 400 });
      }

      const data = await getAlerts({
        ownerFilter,
        view,
        month: monthParam,
        year: yearParam,
        period: parseFortnightPeriod(periodRaw) ?? null,
      });

      return NextResponse.json(data, { status: 200 });
    });
  } catch (error) {
    console.error('Alerts API error:', error);
    return NextResponse.json(
      { error: 'Failed to load alerts' },
      { status: 500 },
    );
  }
}
