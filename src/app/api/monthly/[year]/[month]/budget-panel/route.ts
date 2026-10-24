import { NextResponse } from 'next/server';
import { getMonthlyBudgetPanel } from '@/lib/finance/monthly-budget-panel.service';
import { withOwnerContext } from '@/lib/server/with-owner-context';

export async function GET(
  request: Request,
  context: { params: Promise<{ year: string; month: string }> },
) {
  return await withOwnerContext(request, async (ownerContext) => {
    const { year: yearParam, month: monthParam } = await context.params;
    const year = parseInt(yearParam, 10);
    const month = parseInt(monthParam, 10);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }

    const panel = await getMonthlyBudgetPanel(ownerContext.ownerFilter, year, month);
    return NextResponse.json(panel);
  });
}
