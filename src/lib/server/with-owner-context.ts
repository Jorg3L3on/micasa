import type { NextResponse } from 'next/server';
import { runWithAuditActor } from '@/lib/server/audit/audit-context';
import { routeActor } from '@/lib/server/audit/route-actor';
import {
  getOwnerContext,
  type OwnerContextSuccess,
} from '@/lib/server/get-owner-context';

/**
 * Route entry point: resolves the owner like `getOwnerContext` and runs the
 * handler inside the audit actor scope (user, JWT sid, route), so every write
 * it causes is attributed in the audit log.
 *
 * Why a wrapper and not `getOwnerContext` alone: an AsyncLocalStorage scope
 * opened inside an awaited helper ends when the helper returns, so it would
 * never reach the handler's writes.
 */
export async function withOwnerContext<T>(
  request: Request,
  handler: (context: OwnerContextSuccess) => Promise<T>,
): Promise<T | NextResponse> {
  const context = await getOwnerContext(request);
  if ('error' in context) return context.error;
  return runWithAuditActor(
    routeActor(request, {
      source: 'WEB',
      userId: context.userId,
      actorName: context.userName,
      sessionId: context.sessionId,
    }),
    () => handler(context),
  );
}

/**
 * Server-component entry point: runs a data loader that may write (on-demand
 * fortnights, budget period reconciliation) in the session user's audit scope.
 * Each async server component opens its own: React renders children outside
 * the parent's scope.
 */
export function withPageActor<T>(
  context: OwnerContextSuccess,
  route: string,
  loader: () => Promise<T>,
): Promise<T> {
  return runWithAuditActor(
    {
      source: 'WEB',
      userId: context.userId,
      actorName: context.userName ?? null,
      sessionId: context.sessionId ?? null,
      metadata: { route: `page ${route}` },
    },
    loader,
  );
}
