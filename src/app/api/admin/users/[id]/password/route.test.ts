import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  requireAdminApiMock,
  setTemporaryPasswordForUserMock,
} = vi.hoisted(() => ({
  requireAdminApiMock: vi.fn(),
  setTemporaryPasswordForUserMock: vi.fn(),
}));

vi.mock('@/lib/server/require-admin', () => ({
  requireAdminApi: requireAdminApiMock,
}));

vi.mock('@/lib/server/admin/password-override', () => ({
  setTemporaryPasswordForUser: setTemporaryPasswordForUserMock,
}));

import { POST } from './route';

describe('POST /api/admin/users/[id]/password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 when not admin', async () => {
    requireAdminApiMock.mockResolvedValue({
      ok: false,
      response: Response.json({ error: 'Prohibido' }, { status: 403 }),
    });

    const response = await POST(
      new Request('http://localhost/api/admin/users/2/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          temporaryPassword: 'temp1234',
          confirmPassword: 'temp1234',
        }),
      }),
      { params: Promise.resolve({ id: '2' }) },
    );
    expect(response.status).toBe(403);
    expect(setTemporaryPasswordForUserMock).not.toHaveBeenCalled();
  });

  it('sets temporary password for admin', async () => {
    requireAdminApiMock.mockResolvedValue({
      ok: true,
      admin: { userId: 1, email: 'admin@test.com' },
    });
    setTemporaryPasswordForUserMock.mockResolvedValue({
      ok: true,
      targetEmail: 'u@test.com',
    });

    const response = await POST(
      new Request('http://localhost/api/admin/users/2/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          temporaryPassword: 'temp1234',
          confirmPassword: 'temp1234',
        }),
      }),
      { params: Promise.resolve({ id: '2' }) },
    );
    expect(response.status).toBe(200);
    expect(setTemporaryPasswordForUserMock).toHaveBeenCalledWith({
      admin: { userId: 1, email: 'admin@test.com' },
      targetUserId: 2,
      temporaryPassword: 'temp1234',
    });
  });

  it('rejects mismatched passwords', async () => {
    requireAdminApiMock.mockResolvedValue({
      ok: true,
      admin: { userId: 1, email: 'admin@test.com' },
    });

    const response = await POST(
      new Request('http://localhost/api/admin/users/2/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          temporaryPassword: 'temp1234',
          confirmPassword: 'other',
        }),
      }),
      { params: Promise.resolve({ id: '2' }) },
    );
    expect(response.status).toBe(400);
    expect(setTemporaryPasswordForUserMock).not.toHaveBeenCalled();
  });
});
