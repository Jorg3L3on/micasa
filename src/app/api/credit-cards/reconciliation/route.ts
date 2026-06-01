import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import {
  getCreditCardReconciliationReport,
  repairCreditCardReconciliationIssues,
} from '@/lib/finance/credit-card-reconciliation.service';

const repairSchema = z.object({
  dryRun: z.boolean().optional(),
  walletId: z.number().int().positive().optional(),
  kinds: z
    .array(
      z.enum([
        'wallet_debt_drift',
        'orphan_payment',
        'stale_covered_plan',
        'tampered_generated_expense',
        'import_sync_drift',
      ]),
    )
    .optional(),
});

export async function GET(request: NextRequest) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;

    const walletIdParam = request.nextUrl.searchParams.get('walletId');
    const walletId =
      walletIdParam != null && walletIdParam !== ''
        ? Number(walletIdParam)
        : undefined;

    if (
      walletIdParam != null &&
      walletIdParam !== '' &&
      (!Number.isFinite(walletId) || walletId! <= 0)
    ) {
      return NextResponse.json(
        { error: 'walletId must be a positive integer' },
        { status: 400 },
      );
    }

    const report = await getCreditCardReconciliationReport(
      context.ownerFilter,
      walletId,
    );
    return NextResponse.json(report, { status: 200 });
  } catch (error) {
    console.error('credit card reconciliation GET', error);
    return NextResponse.json(
      { error: 'No se pudo generar el reporte de reconciliación' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;

    const body = repairSchema.parse(await request.json().catch(() => ({})));
    const result = await repairCreditCardReconciliationIssues(
      context.ownerFilter,
      body,
    );
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Error de validación', details: error.issues },
        { status: 400 },
      );
    }
    console.error('credit card reconciliation POST', error);
    return NextResponse.json(
      { error: 'No se pudo ejecutar la reparación' },
      { status: 500 },
    );
  }
}
