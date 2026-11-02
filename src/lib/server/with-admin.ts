import type { NextResponse } from 'next/server';
import { runWithAuditActor } from '@/lib/server/audit/audit-context';
import { routeActor } from '@/lib/server/audit/route-actor';
import { requireAdminApi, type AdminContext } from '@/lib/server/require-admin';

/**
 * Admin route entry point: 401/403 like `requireAdminApi`, otherwise runs the
 * handler in an ADMIN audit scope so its writes are attributed to the admin.
 */
export const withAdmin = async <T>(
  request: Request,
  handler: (admin: AdminContext) => Promise<T>,
): Promise<T | NextResponse> => {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  return runWithAuditActor(
    routeActor(request, {
      source: 'ADMIN',
      userId: gate.admin.userId,
      actorName: gate.admin.name ?? gate.admin.email,
      sessionId: gate.admin.sessionId ?? null,
    }),
    () => handler(gate.admin),
  );
};
