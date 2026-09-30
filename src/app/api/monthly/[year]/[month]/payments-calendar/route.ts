import { NextResponse } from 'next/server';
import { listPaymentsCalendarForMonth } from '@/lib/finance/payments-calendar.service';
import { getOwnerContext } from '@/lib/server/get-owner-context';

export async function GET(
  request: Request,
  context: { params: Promise<{ year: string; month: string }> },
) {
  const ownerContext = await getOwnerContext(request);
  if ('error' in ownerContext) {
    return NextResponse.json({ error: ownerContext.error }, { status: 401 });
  }

  const { year: yearParam, month: monthParam } = await context.params;
  const year = parseInt(yearParam, 10);
  const month = parseInt(monthParam, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
  }

  const calendar = await listPaymentsCalendarForMonth(
    ownerContext.ownerFilter,
    year,
    month,
  );
  return NextResponse.json(calendar);
}
