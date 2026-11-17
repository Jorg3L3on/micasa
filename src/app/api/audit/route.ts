import { NextResponse } from 'next/server';
import {
  auditScopeFromOwner,
  listAuditBatches,
  listAuditRows,
} from '@/lib/server/audit/audit-read.service';
import { reportApiError } from '@/lib/observability/report-error';
import { withOwnerContext } from '@/lib/server/with-owner-context';
import { auditQuerySchema, searchParamsObject } from '@/schemas/audit.schema';

/**
 * Actividad → Cambios. Rows of the selected house (any member) or of the
 * caller's personal context. `groupBy=batch` returns one summary per batch;
 * `batchId=` expands one.
 */
export async function GET(request: Request) {
  const route = 'GET /api/audit';
  try {
    return await withOwnerContext(request, async (context) => {
      const parsed = auditQuerySchema.safeParse(searchParamsObject(new URL(request.url).searchParams));
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Parámetros inválidos', details: parsed.error.issues },
          { status: 400 },
        );
      }
      const scope = auditScopeFromOwner(context.ownerType, context.ownerId);
      const page =
        parsed.data.groupBy === 'batch'
          ? await listAuditBatches(scope, parsed.data)
          : await listAuditRows(scope, parsed.data);
      return NextResponse.json(page);
    });
  } catch (error) {
    reportApiError(error, { route, status: 500 });
    return NextResponse.json({ error: 'Error al cargar la actividad' }, { status: 500 });
  }
}
