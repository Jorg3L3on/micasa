import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, findUniqueUser } = vi.hoisted(() => ({
  authMock: vi.fn(),
  findUniqueUser: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  auth: authMock,
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    user: {
      findUnique: findUniqueUser,
    },
  },
}));

import {
  isEmailInAdminAllowlist,
  parseAdminEmailAllowlist,
  requireAdmin,
  requireAdminApi,
  userHasAdminAccess,
} from './require-admin';

describe('parseAdminEmailAllowlist', () => {
  it('parses comma-separated emails case-insensitively', () => {
    expect(
      parseAdminEmailAllowlist(' Admin@Example.com , other@test.com '),
    ).toEqual(new Set(['admin@example.com', 'other@test.com']));
  });

  it('returns empty set for blank input', () => {
    expect(parseAdminEmailAllowlist(undefined).size).toBe(0);
    expect(parseAdminEmailAllowlist('  ').size).toBe(0);
  });
});

describe('userHasAdminAccess', () => {
  const originalEnv = process.env.MICASA_ADMIN_EMAILS;

  beforeEach(() => {
    process.env.MICASA_ADMIN_EMAILS = '';
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.MICASA_ADMIN_EMAILS;
    } else {
      process.env.MICASA_ADMIN_EMAILS = originalEnv;
    }
  });

  it('grants access when is_admin is true', () => {
    expect(
      userHasAdminAccess({ email: 'user@test.com', is_admin: true }),
    ).toBe(true);
  });

  it('grants access when email is on allowlist', () => {
    process.env.MICASA_ADMIN_EMAILS = 'ops@micasa.app';
    expect(
      userHasAdminAccess({ email: 'OPS@micasa.app', is_admin: false }),
    ).toBe(true);
  });

  it('denies when neither flag nor allowlist match', () => {
    process.env.MICASA_ADMIN_EMAILS = 'ops@micasa.app';
    expect(
      userHasAdminAccess({ email: 'user@test.com', is_admin: false }),
    ).toBe(false);
  });
});

describe('isEmailInAdminAllowlist', () => {
  it('matches against an explicit set', () => {
    const set = new Set(['a@b.com']);
    expect(isEmailInAdminAllowlist('A@B.com', set)).toBe(true);
    expect(isEmailInAdminAllowlist('nope@b.com', set)).toBe(false);
  });
});

describe('requireAdmin', () => {
  const originalEnv = process.env.MICASA_ADMIN_EMAILS;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MICASA_ADMIN_EMAILS = '';
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.MICASA_ADMIN_EMAILS;
    } else {
      process.env.MICASA_ADMIN_EMAILS = originalEnv;
    }
  });

  it('returns null when unauthenticated', async () => {
    authMock.mockResolvedValue(null);
    await expect(requireAdmin()).resolves.toBeNull();
    expect(findUniqueUser).not.toHaveBeenCalled();
  });

  it('returns null when user is not admin', async () => {
    authMock.mockResolvedValue({
      user: { id: '3', email: 'user@test.com' },
    });
    findUniqueUser.mockResolvedValue({
      id: 3,
      email: 'user@test.com',
      is_admin: false,
      active: true,
    });

    await expect(requireAdmin()).resolves.toBeNull();
  });

  it('returns context when is_admin is true', async () => {
    authMock.mockResolvedValue({
      user: { id: '3', email: 'admin@test.com' },
    });
    findUniqueUser.mockResolvedValue({
      id: 3,
      email: 'admin@test.com',
      is_admin: true,
      active: true,
    });

    await expect(requireAdmin()).resolves.toEqual({
      userId: 3,
      email: 'admin@test.com',
    });
  });

  it('returns context when email is allowlisted', async () => {
    process.env.MICASA_ADMIN_EMAILS = 'allow@test.com';
    authMock.mockResolvedValue({
      user: { id: '9', email: 'allow@test.com' },
    });
    findUniqueUser.mockResolvedValue({
      id: 9,
      email: 'allow@test.com',
      is_admin: false,
      active: true,
    });

    await expect(requireAdmin()).resolves.toEqual({
      userId: 9,
      email: 'allow@test.com',
    });
  });

  it('returns null when user is inactive', async () => {
    authMock.mockResolvedValue({
      user: { id: '3', email: 'admin@test.com' },
    });
    findUniqueUser.mockResolvedValue({
      id: 3,
      email: 'admin@test.com',
      is_admin: true,
      active: false,
    });

    await expect(requireAdmin()).resolves.toBeNull();
  });
});

describe('requireAdminApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MICASA_ADMIN_EMAILS = '';
  });

  it('returns 401 when unauthenticated', async () => {
    authMock.mockResolvedValue(null);
    const result = await requireAdminApi();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(401);
  });

  it('returns 403 when authenticated but not admin', async () => {
    authMock.mockResolvedValue({
      user: { id: '3', email: 'user@test.com' },
    });
    findUniqueUser.mockResolvedValue({
      id: 3,
      email: 'user@test.com',
      is_admin: false,
      active: true,
    });

    const result = await requireAdminApi();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(403);
  });
});
