import { NextRequest, NextResponse } from 'next/server';
import { getLiquidityDebtBreakdown } from '@/lib/finance/liquidity-debt-breakdown.service';
import { reportApiError } from '@/lib/observability/report-error';
import { getOwnerContext } from '@/lib/server/get-owner-context';

/**
 * GET /api/wallets/liquidity-debt-breakdown
 * Plazos, resto de tarjetas y cuotas de préstamo en un solo fetch.
 */
export async function GET(request: NextRequest) {
  const route = 'GET /api/wallets/liquidity-debt-breakdown';
  let owner:
    | { userId: number; ownerType: 'user' | 'house'; ownerId: number }
    | undefined;
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    owner = {
      userId: context.userId,
      ownerType: context.ownerType,
      ownerId: context.ownerId,
    };

    const breakdown = await getLiquidityDebtBreakdown(context.ownerFilter);
    return NextResponse.json(breakdown, { status: 200 });
  } catch (error) {
    console.error('liquidity-debt-breakdown:', error);
    reportApiError(error, { route, status: 500, owner });
    return NextResponse.json(
      { error: 'No se pudo calcular el desglose de deudas.' },
      { status: 500 },
    );
  }
}
