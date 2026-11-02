import { auth } from '@/lib/auth';
import { runWithAuditActor } from '@/lib/server/audit/audit-context';
import { routeActor } from '@/lib/server/audit/route-actor';

/**
 * For routes authenticated with `auth()` directly (account, houses,
 * onboarding) or not at all (register): the actor is the session user, if any.
 */
export async function withSessionActor<T>(
  request: Request,
  handler: () => Promise<T>,
): Promise<T> {
  const session = await auth();
  const userId = Number(session?.user?.id);
  return runWithAuditActor(
    routeActor(request, {
      source: 'WEB',
      userId: Number.isFinite(userId) ? userId : null,
      actorName: session?.user?.name ?? null,
      sessionId: session?.sid ?? null,
    }),
    handler,
  );
}
