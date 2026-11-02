import { NextResponse } from 'next/server';
import { auditScopeFromOwner, listAuditSessions } from '@/lib/server/audit/audit-read.service';
import { reportApiError } from '@/lib/observability/report-error';
import { withOwnerContext } from '@/lib/server/with-owner-context';
import { auditSessionsQuerySchema, searchParamsObject } from '@/schemas/audit.schema';

/**
 * Actividad → Sesiones. Account context: the caller's own auth events. House
 * context: logins, logouts and failed attempts of every current member.
 */
export async function GET(request: Request) {
  const route = 'GET /api/audit/sessions';
  try {
    return await withOwnerContext(request, async (context) => {
      const parsed = auditSessionsQuerySchema.safeParse(
        searchParamsObject(new URL(request.url).searchParams),
      );
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Parámetros inválidos', details: parsed.error.issues },
          { status: 400 },
        );
      }
      const scope = auditScopeFromOwner(context.ownerType, context.ownerId);
      return NextResponse.json(await listAuditSessions(scope, context.userId, parsed.data));
    });
  } catch (error) {
    reportApiError(error, { route, status: 500 });
    return NextResponse.json({ error: 'Error al cargar las sesiones' }, { status: 500 });
  }
}
