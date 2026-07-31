import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireAdminApiMock, searchAdminUsersMock } = vi.hoisted(() => ({
  requireAdminApiMock: vi.fn(),
  searchAdminUsersMock: vi.fn(),
}));

vi.mock('@/lib/server/require-admin', () => ({
  requireAdminApi: requireAdminApiMock,
}));

vi.mock('@/lib/server/admin/users', () => ({
  searchAdminUsers: searchAdminUsersMock,
}));

import { GET } from './route';

describe('GET /api/admin/users', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 when not admin', async () => {
    requireAdminApiMock.mockResolvedValue({
      ok: false,
      response: Response.json({ error: 'Prohibido' }, { status: 403 }),
    });

    const response = await GET(
      new NextRequest('http://localhost/api/admin/users'),
    );
    expect(response.status).toBe(403);
    expect(searchAdminUsersMock).not.toHaveBeenCalled();
  });

  it('returns users for admin', async () => {
    requireAdminApiMock.mockResolvedValue({
      ok: true,
      admin: { userId: 1, email: 'admin@test.com' },
    });
    searchAdminUsersMock.mockResolvedValue([
      {
        id: 2,
        name: 'User',
        email: 'u@test.com',
        active: true,
        onboarding_completed: true,
        is_admin: false,
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ]);

    const response = await GET(
      new NextRequest('http://localhost/api/admin/users?q=u'),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      users: [{ id: 2, email: 'u@test.com' }],
    });
    expect(searchAdminUsersMock).toHaveBeenCalledWith({
      q: 'u',
      take: undefined,
    });
  });
});
