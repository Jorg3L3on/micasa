import { randomUUID } from 'node:crypto';
import type { AuditActorInput, AuditSource } from './audit-context';

/** Request id for audit rows: client `x-request-id`, else Vercel's id, else a new uuid. */
export const auditRequestId = (request?: Request): string =>
  request?.headers.get('x-request-id')?.trim() ||
  request?.headers.get('x-vercel-id')?.trim() ||
  randomUUID();

/** `METHOD /path` of the request, stored as `metadata.route` on audit rows. */
export const routeLabel = (request: Request): string => {
  try {
    return `${request.method} ${new URL(request.url).pathname}`;
  } catch {
    return request.method;
  }
};

export const routeActor = (
  request: Request,
  input: {
    source: AuditSource;
    userId: number | null;
    actorName?: string | null;
    sessionId?: string | null;
  },
): AuditActorInput => ({
  source: input.source,
  userId: input.userId,
  actorName: input.actorName ?? null,
  sessionId: input.sessionId ?? null,
  requestId: auditRequestId(request),
  metadata: { route: routeLabel(request) },
});
