import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HOUSE_A,
  USER_B,
  requestFor,
} from '@/test/isolation/helpers';

const { authMock, findFirstHouseMember } = vi.hoisted(() => ({
  authMock: vi.fn(),
  findFirstHouseMember: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  auth: authMock,
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    houseMember: { findFirst: findFirstHouseMember },
  },
}));

import { getOwnerContext } from '@/lib/server/get-owner-context';

describe('isolation: getOwnerContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: String(USER_B) } });
  });

  it('returns 403 when User B requests User A house context without membership', async () => {
    findFirstHouseMember.mockResolvedValue(null);

    const result = await getOwnerContext(
      requestFor('/api/wallets', {
        ownerType: 'house',
        ownerId: HOUSE_A,
      }),
    );

    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error.status).toBe(403);
    }
  });

  it('returns 403 when User B requests User A personal ownerId', async () => {
    const result = await getOwnerContext(
      requestFor('/api/wallets', {
        ownerType: 'user',
        ownerId: 1,
      }),
    );

    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error.status).toBe(403);
    }
  });
});
