import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  authMock,
  findFirstHouseMember,
  findManyWallet,
  groupByExpense,
  findManyFortnight,
  findManyExpense,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  findFirstHouseMember: vi.fn(),
  findManyWallet: vi.fn(),
  groupByExpense: vi.fn(),
  findManyFortnight: vi.fn(),
  findManyExpense: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  auth: authMock,
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    houseMember: { findFirst: findFirstHouseMember },
    wallet: { findMany: findManyWallet },
    expense: { findMany: findManyExpense, groupBy: groupByExpense },
    fortnight: { findMany: findManyFortnight },
  },
}));

import { getOwnerContext } from '@/lib/server/get-owner-context';
import { listWalletsByOwner } from '@/lib/finance/wallet.service';
import { listFortnightsForCatalog } from '@/lib/finance/fortnight.service';
import { listExpensesByOwner } from '@/lib/finance/expense.service';

describe('getOwnerContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: '10' } });
  });

  it('returns 401 when unauthenticated', async () => {
    authMock.mockResolvedValue(null);
    const result = await getOwnerContext(
      new Request('http://localhost/api/wallets'),
    );
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error.status).toBe(401);
    }
  });

  it('defaults to personal owner matching the session user', async () => {
    const result = await getOwnerContext(
      new Request('http://localhost/api/wallets'),
    );
    expect(result).toEqual({
      userId: 10,
      ownerType: 'user',
      ownerId: 10,
      ownerFilter: { user_id: 10, house_id: null },
      role: 'owner',
    });
  });

  it('rejects personal ownerId that does not match the session user', async () => {
    const result = await getOwnerContext(
      new Request('http://localhost/api/wallets?ownerType=user&ownerId=99'),
    );
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error.status).toBe(403);
    }
  });

  it('allows house context when the user is a member', async () => {
    findFirstHouseMember.mockResolvedValue({
      house_id: 5,
      user_id: 10,
      role: 'MEMBER',
    });

    const result = await getOwnerContext(
      new Request('http://localhost/api/wallets?ownerType=house&ownerId=5'),
    );

    expect(result).toEqual({
      userId: 10,
      ownerType: 'house',
      ownerId: 5,
      ownerFilter: { user_id: null, house_id: 5 },
      role: 'member',
    });
  });

  it('rejects house context when the user is not a member', async () => {
    findFirstHouseMember.mockResolvedValue(null);

    const result = await getOwnerContext(
      new Request('http://localhost/api/wallets?ownerType=house&ownerId=5'),
    );

    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error.status).toBe(403);
    }
  });
});

describe('house-mode owner scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findManyWallet.mockResolvedValue([]);
    groupByExpense.mockResolvedValue([]);
    findManyFortnight.mockResolvedValue([]);
    findManyExpense.mockResolvedValue([]);
  });

  it('listWalletsByOwner scopes wallets to the house ownerFilter', async () => {
    await listWalletsByOwner({ user_id: null, house_id: 5 });

    expect(findManyWallet).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user_id: null, house_id: 5 },
      }),
    );
  });

  it('listWalletsByOwner scopes wallets to the personal ownerFilter', async () => {
    await listWalletsByOwner({ user_id: 10, house_id: null });

    expect(findManyWallet).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user_id: 10, house_id: null },
      }),
    );
  });

  it('listFortnightsForCatalog scopes fortnights to the house ownerFilter', async () => {
    await listFortnightsForCatalog({ user_id: null, house_id: 5 });

    expect(findManyFortnight).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user_id: null, house_id: 5 },
      }),
    );
  });

  it('listExpensesByOwner excludes personal expenses in house mode', async () => {
    await listExpensesByOwner({ user_id: null, house_id: 5 });

    expect(findManyExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user_id: null, house_id: 5 },
      }),
    );
  });

  it('listExpensesByOwner excludes house expenses in personal mode', async () => {
    await listExpensesByOwner({ user_id: 10, house_id: null });

    expect(findManyExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user_id: 10, house_id: null },
      }),
    );
  });
});
