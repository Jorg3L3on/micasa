import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findUniqueUser, updateUser, createAudit } = vi.hoisted(() => ({
  findUniqueUser: vi.fn(),
  updateUser: vi.fn(),
  createAudit: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    user: {
      findUnique: findUniqueUser,
      update: updateUser,
    },
    adminAuditLog: {
      create: createAudit,
    },
  },
}));

vi.mock('bcryptjs', () => ({
  hash: vi.fn(async () => 'hashed-temp'),
}));

import { setTemporaryPasswordForUser } from './password-override';

describe('setTemporaryPasswordForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createAudit.mockResolvedValue({ id: 99 });
  });

  it('returns not_found when user missing', async () => {
    findUniqueUser.mockResolvedValue(null);
    const result = await setTemporaryPasswordForUser({
      admin: { userId: 1, email: 'a@test.com' },
      targetUserId: 2,
      temporaryPassword: 'temp1234',
    });
    expect(result).toEqual({ ok: false, reason: 'not_found' });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('hashes password, updates user, and audits without plaintext', async () => {
    findUniqueUser.mockResolvedValue({ id: 2, email: 'u@test.com' });
    updateUser.mockResolvedValue({ id: 2 });

    const result = await setTemporaryPasswordForUser({
      admin: { userId: 1, email: 'a@test.com' },
      targetUserId: 2,
      temporaryPassword: 'temp1234',
    });

    expect(result).toEqual({ ok: true, targetEmail: 'u@test.com' });
    expect(updateUser).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { password: 'hashed-temp' },
    });
    expect(createAudit).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actor_user_id: 1,
        target_user_id: 2,
        action: 'admin.password_override',
        metadata: {
          target_email: 'u@test.com',
          password_length: 8,
        },
      }),
    });
    const metadata = createAudit.mock.calls[0][0].data.metadata as Record<
      string,
      unknown
    >;
    expect(metadata).not.toHaveProperty('temporaryPassword');
    expect(JSON.stringify(metadata)).not.toContain('temp1234');
  });
});
