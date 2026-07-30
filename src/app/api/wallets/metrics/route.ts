import { NextRequest, NextResponse } from 'next/server';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import {
  listWalletMetricsByOwner,
  parseMetricsMonths,
} from '@/lib/finance/wallet-balance-evolution.service';

export async function GET(request: NextRequest) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerFilter } = context;

    const { searchParams } = new URL(request.url);
    const months = parseMetricsMonths(searchParams.get('months'));

    const metrics = await listWalletMetricsByOwner(ownerFilter, months);
    return NextResponse.json(metrics, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error fetching wallet metrics';
    console.error('Error fetching wallet metrics:', message, error);
    return NextResponse.json(
      { error: 'Failed to fetch wallet metrics', detail: message },
      { status: 500 },
    );
  }
}
