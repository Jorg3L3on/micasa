import { NextRequest, NextResponse } from 'next/server';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import { listBudgetPeriodExpensesByAllocation } from '@/lib/finance/budget-period.service';

type ErrorWithCode = Error & { code?: string };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ periodId: string }> },
) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerFilter } = context;

    const { periodId: periodIdParam } = await params;
    const periodId = Number(periodIdParam);
    if (isNaN(periodId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const groups = await listBudgetPeriodExpensesByAllocation(periodId, ownerFilter);
    return NextResponse.json({ groups }, { status: 200 });
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as ErrorWithCode).code === 'P2025'
    ) {
      return NextResponse.json({ error: 'Período de presupuesto no encontrado' }, { status: 404 });
    }
    console.error('Error fetching budget period expenses:', error);
    return NextResponse.json({ error: 'Failed to fetch budget period expenses' }, { status: 500 });
  }
}
