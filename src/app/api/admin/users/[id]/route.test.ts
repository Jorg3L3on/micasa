import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  requireAdminApiMock,
  getAdminUserDetailMock,
  buildAdminRecentActivityMock,
} = vi.hoisted(() => ({
  requireAdminApiMock: vi.fn(),
  getAdminUserDetailMock: vi.fn(),
  buildAdminRecentActivityMock: vi.fn(),
}));

vi.mock('@/lib/server/require-admin', () => ({
  requireAdminApi: requireAdminApiMock,
}));

vi.mock('@/lib/server/admin/users', () => ({
  getAdminUserDetail: getAdminUserDetailMock,
  buildAdminRecentActivity: buildAdminRecentActivityMock,
}));

import { GET } from './route';

describe('GET /api/admin/users/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 when not admin', async () => {
    requireAdminApiMock.mockResolvedValue({
      ok: false,
      response: Response.json({ error: 'Prohibido' }, { status: 403 }),
    });

    const response = await GET(new Request('http://localhost/api/admin/users/2'), {
      params: Promise.resolve({ id: '2' }),
    });
    expect(response.status).toBe(403);
  });

  it('returns detail and activity for admin', async () => {
    requireAdminApiMock.mockResolvedValue({
      ok: true,
      admin: { userId: 1, email: 'admin@test.com' },
    });
    getAdminUserDetailMock.mockResolvedValue({
      id: 2,
      name: 'User',
      email: 'u@test.com',
      wallets: [],
      fortnights: [],
      loans: [],
      memberships: [],
    });
    buildAdminRecentActivityMock.mockResolvedValue([]);

    const response = await GET(new Request('http://localhost/api/admin/users/2'), {
      params: Promise.resolve({ id: '2' }),
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      user: { id: 2 },
      recent_activity: [],
    });
  });
});
