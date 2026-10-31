import { NextRequest, NextResponse } from 'next/server';
import { withOwnerContext } from '@/lib/server/with-owner-context';
import { processTransactionBatch } from '@/lib/finance/transaction-batch.service';
import {
  getBatchReplay,
  rememberBatch,
} from '@/lib/finance/batch-idempotency';
import { logFinanceEvent } from '@/lib/observability/finance-log';
import { transactionBatchEnvelopeSchema } from '@/schemas/transaction-batch.schema';

export async function POST(request: NextRequest) {
  try {
    return await withOwnerContext(request, async (context) => {
      const { ownerType, ownerId, ownerFilter } = context;

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
      }
      const envelope = transactionBatchEnvelopeSchema.safeParse(body);
      if (!envelope.success) {
        return NextResponse.json(
          {
            error: envelope.error.issues[0]?.message ?? 'Solicitud inválida',
            details: envelope.error.issues,
          },
          { status: 400 },
        );
      }

      const ownerKey = `${ownerType}-${ownerId}-${context.userId}`;
      const idempotencyKey = request.headers.get('Idempotency-Key');
      if (idempotencyKey) {
        const replay = getBatchReplay(ownerKey, idempotencyKey);
        if (replay) return NextResponse.json(replay, { status: 200 });
      }

      const startedAt = Date.now();
      const response = await processTransactionBatch(
        { ownerType, ownerId, ownerFilter },
        envelope.data.items,
      );
      if (idempotencyKey) rememberBatch(ownerKey, idempotencyKey, response);

      logFinanceEvent(
        'info',
        'finance.api.transaction_batch',
        {
          route: 'POST /api/transactions/batch',
          total: response.summary.total,
          created: response.summary.created,
          failed: response.summary.failed,
          durationMs: Date.now() - startedAt,
        },
        request,
      );

      return NextResponse.json(response, { status: 200 });
    });
  } catch (error) {
    console.error('Error processing transaction batch:', error);
    return NextResponse.json(
      { error: 'No se pudo procesar el lote' },
      { status: 500 },
    );
  }
}
