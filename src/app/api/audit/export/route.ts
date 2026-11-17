import { NextResponse } from 'next/server';
import { todayCalendarDate } from '@/lib/calendar-dates';
import {
  auditRowsToCsv,
  auditScopeFromOwner,
  exportAuditRows,
} from '@/lib/server/audit/audit-read.service';
import { reportApiError } from '@/lib/observability/report-error';
import { withOwnerContext } from '@/lib/server/with-owner-context';
import { auditQuerySchema, searchParamsObject } from '@/schemas/audit.schema';

/** CSV of Actividad → Cambios with the same filters as GET /api/audit. */
export async function GET(request: Request) {
  const route = 'GET /api/audit/export';
  try {
    return await withOwnerContext(request, async (context) => {
      const parsed = auditQuerySchema.safeParse(searchParamsObject(new URL(request.url).searchParams));
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Parámetros inválidos', details: parsed.error.issues },
          { status: 400 },
        );
      }
      const rows = await exportAuditRows(auditScopeFromOwner(context.ownerType, context.ownerId), parsed.data);
      return new NextResponse(auditRowsToCsv(rows), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="actividad-${todayCalendarDate()}.csv"`,
        },
      });
    });
  } catch (error) {
    reportApiError(error, { route, status: 500 });
    return NextResponse.json({ error: 'Error al exportar la actividad' }, { status: 500 });
  }
}
