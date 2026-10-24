import { NextResponse } from 'next/server';
import { listAdminSessions } from '@/lib/server/audit/audit-read.service';
import { reportApiError } from '@/lib/observability/report-error';
import { withAdmin } from '@/lib/server/with-admin';
import { adminAuditSessionsQuerySchema, searchParamsObject } from '@/schemas/audit.schema';

/**
 * /admin/audit → Sesiones: every auth event, including failed logins on
 * unknown emails (the only place they are shown). Admins only.
 */
export async function GET(request: Request) {
  const route = 'GET /api/admin/audit/sessions';
  try {
    return await withAdmin(request, async () => {
      const parsed = adminAuditSessionsQuerySchema.safeParse(
        searchParamsObject(new URL(request.url).searchParams),
      );
      if (!parsed.success) {
        return NextResponse.json({ error: 'Parámetros inválidos', details: parsed.error.issues }, { status: 400 });
      }
      return NextResponse.json(await listAdminSessions(parsed.data));
    });
  } catch (error) {
    reportApiError(error, { route, status: 500 });
    return NextResponse.json({ error: 'Error al cargar las sesiones' }, { status: 500 });
  }
}
