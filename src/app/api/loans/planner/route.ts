import { NextRequest, NextResponse } from 'next/server';
import { listLoanPaymentsForPlannerMonth } from '@/lib/finance/loan.service';
import { getOwnerContext } from '@/lib/server/get-owner-context';

export async function GET(request: NextRequest) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;

    const year = Number(request.nextUrl.searchParams.get('year'));
    const month = Number(request.nextUrl.searchParams.get('month'));
    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12
    ) {
      return NextResponse.json(
        { error: 'year y month inválidos (month 1-12)' },
        { status: 400 },
      );
    }

    const payments = await listLoanPaymentsForPlannerMonth(
      context.ownerFilter,
      year,
      month,
    );
    return NextResponse.json(payments, { status: 200 });
  } catch (error) {
    console.error('Error fetching planner loan payments:', error);
    return NextResponse.json(
      { error: 'Error al obtener pagos de préstamos' },
      { status: 500 },
    );
  }
}
