import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireAdminApi } = vi.hoisted(() => ({ requireAdminApi: vi.fn() }));
vi.mock('@/lib/server/require-admin', () => ({ requireAdminApi }));

import { getAuditActor } from '@/lib/server/audit/audit-context';
import { withAdmin } from '@/lib/server/with-admin';

describe('withAdmin', () => {
  beforeEach(() => requireAdminApi.mockReset());

  it('runs the handler in an ADMIN audit scope', async () => {
    requireAdminApi.mockResolvedValue({
      ok: true,
      admin: { userId: 1, email: 'admin@example.test', name: 'Soporte', sessionId: 'sid-a' },
    });
    const request = new Request('http://localhost/api/admin/users/5/password', { method: 'POST' });

    const actor = await withAdmin(request, async (admin) => {
      expect(admin.userId).toBe(1);
      return getAuditActor();
    });

    expect(actor).toMatchObject({
      source: 'ADMIN',
      userId: 1,
      actorName: 'Soporte',
      sessionId: 'sid-a',
      metadata: { route: 'POST /api/admin/users/5/password' },
    });
  });

  it('returns the 401/403 response from requireAdminApi', async () => {
    const response = Response.json({ error: 'Prohibido' }, { status: 403 });
    requireAdminApi.mockResolvedValue({ ok: false, response });
    const handler = vi.fn();
    expect(await withAdmin(new Request('http://localhost/api/admin/users'), handler)).toBe(response);
    expect(handler).not.toHaveBeenCalled();
  });
});
