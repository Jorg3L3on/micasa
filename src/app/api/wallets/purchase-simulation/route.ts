import { NextResponse, type NextRequest } from 'next/server';
import { formatCalendarDate } from '@/lib/calendar-dates';
import { CREDIT_MAX_MONTHS } from '@/lib/finance/purchase-simulation/constants';
import { addMonthsYmd } from '@/lib/finance/purchase-simulation/plan';
import { loadSimulationBaseline, loadSimulationWallets } from '@/lib/finance/purchase-simulation/purchase-simulation.service';
import { defaultBaselineUntil } from '@/lib/finance/purchase-simulation/simulate';
import { logFinanceEvent } from '@/lib/observability/finance-log';
import { withOwnerContext } from '@/lib/server/with-owner-context';
import { dateStringSchema } from '@/schemas/common.schema';

/**
 * GET /api/wallets/purchase-simulation (MIC-I17), read-only.
 * Returns the wallets the form offers and the quincenas from today through
 * `until` (YYYY-MM-DD, optional) without any purchase. The browser simulates
 * each purchase on top of it, so changing the form asks nothing more.
 */
export async function GET(request: NextRequest) {
  const started = Date.now();
  try {
    return await withOwnerContext(request, async (context) => {
      const asOf = new Date();
      const todayYmd = formatCalendarDate(asOf);
      const param = request.nextUrl.searchParams.get('until');
      if (param != null && !dateStringSchema.safeParse(param).success) {
        return NextResponse.json({ error: 'Fecha inválida.', code: 'INVALID_UNTIL', field: 'until' }, { status: 400 });
      }
      const max = addMonthsYmd(todayYmd, CREDIT_MAX_MONTHS + 14, 28);
      const requested = param ?? defaultBaselineUntil(todayYmd);
      const until = requested < todayYmd ? todayYmd : requested > max ? max : requested;
      const wallets = await loadSimulationWallets(context.ownerFilter);
      const baseline = await loadSimulationBaseline(context.ownerFilter, wallets, until, asOf);
      logFinanceEvent(
        'info',
        'finance.purchase_simulation.baseline_loaded',
        {
          owner_type: context.ownerType,
          owner_id: context.ownerId,
          duration_ms: Date.now() - started,
          until,
          flows: baseline.flows.length,
        },
        request,
      );
      return NextResponse.json({ wallets, baseline });
    });
  } catch (error) {
    console.error('purchase-simulation baseline failed', error);
    return NextResponse.json({ error: 'No pudimos cargar tus quincenas.', code: 'INTERNAL' }, { status: 500 });
  }
}
