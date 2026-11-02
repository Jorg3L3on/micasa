import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getOwnerContext } = vi.hoisted(() => ({ getOwnerContext: vi.fn() }));
vi.mock('@/lib/server/get-owner-context', () => ({ getOwnerContext }));

import { getAuditActor } from '@/lib/server/audit/audit-context';
import { withOwnerContext } from '@/lib/server/with-owner-context';

const ownerContext = {
  userId: 7,
  ownerType: 'house' as const,
  ownerId: 3,
  ownerFilter: { user_id: null, house_id: 3 },
  role: 'member' as const,
  sessionId: 'sid-7',
  userName: 'Luis Demo',
};

/** A service write: reads the actor the Prisma layer would send to Postgres. */
const serviceWrite = async () => {
  await Promise.resolve();
  return getAuditActor();
};

describe('withOwnerContext', () => {
  beforeEach(() => {
    getOwnerContext.mockReset();
  });

  it('runs the handler with the session user as the audit actor', async () => {
    getOwnerContext.mockResolvedValue(ownerContext);
    const request = new Request('http://localhost/api/expenses?ownerType=house&ownerId=3', {
      method: 'POST',
      headers: { 'x-request-id': 'req-1' },
    });

    const actor = await withOwnerContext(request, async (context) => {
      expect(context).toBe(ownerContext);
      return serviceWrite();
    });

    expect(actor).toMatchObject({
      source: 'WEB',
      userId: 7,
      actorName: 'Luis Demo',
      sessionId: 'sid-7',
      requestId: 'req-1',
      metadata: { route: 'POST /api/expenses' },
    });
    expect((actor as { batchId: string }).batchId).toEqual(expect.any(String));
  });

  it('returns the owner-context error response without running the handler', async () => {
    const error = Response.json({ error: 'Forbidden' }, { status: 403 });
    getOwnerContext.mockResolvedValue({ error });
    const handler = vi.fn();

    const response = await withOwnerContext(new Request('http://localhost/api/expenses'), handler);

    expect(response).toBe(error);
    expect(handler).not.toHaveBeenCalled();
  });

  it('getOwnerContext alone does not give the handler an actor (why the wrapper exists)', async () => {
    getOwnerContext.mockResolvedValue(ownerContext);
    const { getOwnerContext: resolve } = await import('@/lib/server/get-owner-context');
    await resolve(new Request('http://localhost/api/expenses'));
    expect(await serviceWrite()).toBeNull();
  });
});
