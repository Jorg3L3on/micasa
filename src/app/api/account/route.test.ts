import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, findUniqueUser, updateUser } = vi.hoisted(() => ({
  authMock: vi.fn(),
  findUniqueUser: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  auth: authMock,
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    user: {
      findUnique: findUniqueUser,
      update: updateUser,
    },
  },
}));

vi.mock('bcryptjs', () => ({
  compare: vi.fn(async (plain: string, hash: string) => {
    return plain === 'correct-current' && hash === 'stored-hash';
  }),
  hash: vi.fn(async () => 'new-hashed-password'),
}));

import { PATCH } from './route';

describe('PATCH /api/account', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: '7' } });
  });

  it('returns 401 when unauthenticated', async () => {
    authMock.mockResolvedValue(null);

    const response = await PATCH(
      new Request('http://localhost/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated' }),
      }) as Parameters<typeof PATCH>[0],
    );

    expect(response.status).toBe(401);
  });

  it('rejects password change when current password is wrong', async () => {
    findUniqueUser.mockResolvedValue({ password: 'stored-hash' });

    const response = await PATCH(
      new Request('http://localhost/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: 'wrong-current',
          newPassword: 'newpass1',
          confirmPassword: 'newpass1',
        }),
      }) as Parameters<typeof PATCH>[0],
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'La contraseña actual no es correcta',
      field: 'currentPassword',
    });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('updates password when current password is correct', async () => {
    findUniqueUser.mockResolvedValue({ password: 'stored-hash' });
    updateUser.mockResolvedValue({ id: 7, name: 'User' });

    const response = await PATCH(
      new Request('http://localhost/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: 'correct-current',
          newPassword: 'newpass1',
          confirmPassword: 'newpass1',
        }),
      }) as Parameters<typeof PATCH>[0],
    );

    expect(response.status).toBe(200);
    expect(updateUser).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { password: 'new-hashed-password' },
    });
  });

  it('updates name without requiring password fields', async () => {
    findUniqueUser.mockResolvedValue({ password: 'stored-hash' });
    updateUser.mockResolvedValue({ id: 7, name: 'Updated Name' });

    const response = await PATCH(
      new Request('http://localhost/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated Name' }),
      }) as Parameters<typeof PATCH>[0],
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ name: 'Updated Name' });
    expect(updateUser).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { name: 'Updated Name' },
    });
  });
});
