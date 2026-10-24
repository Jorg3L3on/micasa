import { NextResponse } from 'next/server';
import {
  auditScopeFromOwner,
  listAuditBatches,
  listAuditRows,
  type AdminAuditScope,
} from '@/lib/server/audit/audit-read.service';
import { reportApiError } from '@/lib/observability/report-error';
import { withAdmin } from '@/lib/server/with-admin';
import { adminAuditQuerySchema, searchParamsObject } from '@/schemas/audit.schema';

/**
 * /admin/audit → Cambios: rows of every house and user, the "Fuera de la app"
 * rows, and the older AdminAuditLog actions. Admins only.
 */
export async function GET(request: Request) {
  const route = 'GET /api/admin/audit';
  try {
    return await withAdmin(request, async () => {
      const parsed = adminAuditQuerySchema.safeParse(searchParamsObject(new URL(request.url).searchParams));
      if (!parsed.success) {
        return NextResponse.json({ error: 'Parámetros inválidos', details: parsed.error.issues }, { status: 400 });
      }
      const { ownerType, ownerId, missingActor, ...query } = parsed.data;
      const scope: AdminAuditScope = {
        kind: 'admin',
        owner: ownerType && ownerId ? auditScopeFromOwner(ownerType, ownerId) : undefined,
        missingActor,
      };
      const page =
        query.groupBy === 'batch' ? await listAuditBatches(scope, query) : await listAuditRows(scope, query);
      return NextResponse.json(page);
    });
  } catch (error) {
    reportApiError(error, { route, status: 500 });
    return NextResponse.json({ error: 'Error al cargar la auditoría' }, { status: 500 });
  }
}
