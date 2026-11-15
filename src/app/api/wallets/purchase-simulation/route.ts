import { NextResponse, type NextRequest } from 'next/server';
import { DomainError } from '@/lib/finance/domain-error';
import { loadSimulationWallets, simulatePurchase } from '@/lib/finance/purchase-simulation/purchase-simulation.service';
import { logFinanceEvent } from '@/lib/observability/finance-log';
import { withOwnerContext } from '@/lib/server/with-owner-context';
import { purchaseSimulationSchema } from '@/schemas/purchase-simulation.schema';

/** GET: the wallets the form offers (cards with corte, pago, límite and disponible). */
export async function GET(request: NextRequest) {
  return withOwnerContext(request, async (context) =>
    NextResponse.json({ wallets: await loadSimulationWallets(context.ownerFilter) }),
  );
}

/**
 * POST /api/wallets/purchase-simulation (MIC-I17)
 * Body: one purchase (total, date, contado | msi | credito…). Read-only: returns
 * the payment plan, the quincena series with and without it,
 * the verdict facts and other ways to pay. Nothing is stored.
 */
export async function POST(request: NextRequest) {
  const started = Date.now();
  try {
    return await withOwnerContext(request, async (context) => {
      const parsed = purchaseSimulationSchema.safeParse(await request.json().catch(() => null));
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        return NextResponse.json(
          {
            error: first?.message ?? 'Simulación inválida.',
            code: 'INVALID_BODY',
            field: typeof first?.path[0] === 'string' ? first.path[0] : null,
            issues: parsed.error.issues,
          },
          { status: 400 },
        );
      }
      const result = await simulatePurchase({ ownerFilter: context.ownerFilter, input: parsed.data });
      logFinanceEvent(
        'info',
        'finance.purchase_simulation.computed',
        {
          owner_type: context.ownerType,
          owner_id: context.ownerId,
          duration_ms: Date.now() - started,
          quincenas: result.series.length,
          mode: parsed.data.mode,
          level: result.verdict.level,
        },
        request,
      );
      return NextResponse.json(result);
    });
  } catch (error) {
    if (error instanceof DomainError) {
      const field = 'field' in error ? (error as DomainError & { field: string }).field : null;
      return NextResponse.json({ error: error.message, code: error.code, field }, { status: error.status });
    }
    console.error('purchase-simulation failed', error);
    return NextResponse.json(
      { error: 'No pudimos simular. No se guardó nada.', code: 'INTERNAL' },
      { status: 500 },
    );
  }
}
