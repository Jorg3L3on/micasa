import { NextRequest, NextResponse } from 'next/server';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import {
  getDuePaymentsForCurrentFortnight,
  getDuePaymentsForPlannerMonth,
} from '@/lib/finance/credit-card-statement.service';

export async function GET(request: NextRequest) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerFilter } = context;

    const yearRaw = request.nextUrl.searchParams.get('year');
    const monthRaw = request.nextUrl.searchParams.get('month');
    if (yearRaw != null && monthRaw != null) {
      const year = Number(yearRaw);
      const month = Number(monthRaw);
      if (
        !Number.isFinite(year) ||
        !Number.isFinite(month) ||
        month < 1 ||
        month > 12
      ) {
        return NextResponse.json(
          { error: 'year y month inválidos (month 1–12)' },
          { status: 400 },
        );
      }
      const partitioned = await getDuePaymentsForPlannerMonth(
        ownerFilter,
        year,
        month,
      );
      return NextResponse.json(partitioned, { status: 200 });
    }

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
