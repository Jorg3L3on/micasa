import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getOwnerContext,
  findManyTransfer,
  findFirstHouseMember,
  findUniqueUser,
  findUniqueHouse,
  findUniqueFortnight,
  findUniqueWallet,
  createUserToHouseTransfer,
} = vi.hoisted(() => ({
  getOwnerContext: vi.fn(),
  findManyTransfer: vi.fn(),
  findFirstHouseMember: vi.fn(),
  findUniqueUser: vi.fn(),
  findUniqueHouse: vi.fn(),
  findUniqueFortnight: vi.fn(),
  findUniqueWallet: vi.fn(),
  createUserToHouseTransfer: vi.fn(),
}));

vi.mock('@/lib/server/get-owner-context', () => ({
  getOwnerContext,
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    transfer: { findMany: findManyTransfer },
    houseMember: { findFirst: findFirstHouseMember },
    user: { findUnique: findUniqueUser },
    house: { findUnique: findUniqueHouse },
    fortnight: { findUnique: findUniqueFortnight },
    wallet: { findUnique: findUniqueWallet },
  },
}));

vi.mock('@/lib/transfers', () => ({
  createUserToHouseTransfer,
}));

import { GET, POST } from './route';

const personalContext = {
  userId: 10,
  ownerType: 'user' as const,
  ownerId: 10,
  ownerFilter: { user_id: 10, house_id: null },
  role: 'owner' as const,
};

const houseContext = {
  userId: 10,
  ownerType: 'house' as const,
  ownerId: 5,
  ownerFilter: { user_id: null, house_id: 5 },
  role: 'member' as const,
};

describe('GET /api/transfers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOwnerContext.mockResolvedValue(personalContext);
    findManyTransfer.mockResolvedValue([]);
  });

  it('returns owner-context errors', async () => {
    getOwnerContext.mockResolvedValue({
      error: new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
      }),
    });

    const response = await GET(
      new Request('http://localhost/api/transfers') as Parameters<typeof GET>[0],
    );
    expect(response.status).toBe(401);
  });

  it('scopes transfers to the personal user in user context', async () => {
    const response = await GET(
      new Request(
        'http://localhost/api/transfers?ownerType=user&ownerId=10',
      ) as Parameters<typeof GET>[0],
    );

    expect(response.status).toBe(200);
    expect(findManyTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ user_id: 10 }),
      }),
    );
  });

  it('scopes transfers to the house in house context', async () => {
    getOwnerContext.mockResolvedValue(houseContext);

    const response = await GET(
      new Request(
        'http://localhost/api/transfers?ownerType=house&ownerId=5',
      ) as Parameters<typeof GET>[0],
    );

    expect(response.status).toBe(200);
    expect(findManyTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ house_id: 5 }),
      }),
    );
  });
});

describe('POST /api/transfers', () => {
  const validBody = {
    amount: 100,
    user_id: 10,
    house_id: 5,
    user_fortnight_id: 1,
    house_fortnight_id: 2,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getOwnerContext.mockResolvedValue(personalContext);
    findFirstHouseMember.mockResolvedValue({ id: 1 });
    findUniqueUser.mockResolvedValue({ id: 10, active: true });
    findUniqueHouse.mockResolvedValue({ id: 5 });
    findUniqueFortnight
      .mockResolvedValueOnce({ id: 1, user_id: 10, house_id: null })
      .mockResolvedValueOnce({ id: 2, user_id: null, house_id: 5 });
    createUserToHouseTransfer.mockResolvedValue({
      id: 99,
      amount: 100,
      type: 'USER_TO_HOUSE',
      user_id: 10,
      house_id: 5,
      note: null,
      created_at: new Date('2026-07-01T12:00:00.000Z'),
      user_expense_id: 1,
      house_income_id: 2,
    });
  });

  it('rejects transfers from a different user_id than the session', async () => {
    const response = await POST(
      new Request('http://localhost/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validBody, user_id: 99 }),
      }) as Parameters<typeof POST>[0],
    );

    expect(response.status).toBe(403);
    expect(createUserToHouseTransfer).not.toHaveBeenCalled();
  });

  it('rejects when the caller is not a house member', async () => {
    findFirstHouseMember.mockResolvedValue(null);

    const response = await POST(
      new Request('http://localhost/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validBody),
      }) as Parameters<typeof POST>[0],
    );

    expect(response.status).toBe(403);
    expect(createUserToHouseTransfer).not.toHaveBeenCalled();
  });

  it('rejects house-context posts when body house_id does not match', async () => {
    getOwnerContext.mockResolvedValue(houseContext);

    const response = await POST(
      new Request(
        'http://localhost/api/transfers?ownerType=house&ownerId=5',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...validBody, house_id: 99 }),
        },
      ) as Parameters<typeof POST>[0],
    );

    expect(response.status).toBe(400);
    expect(createUserToHouseTransfer).not.toHaveBeenCalled();
  });

  it('creates a transfer when membership and fortnights are valid', async () => {
    const response = await POST(
      new Request('http://localhost/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validBody),
      }) as Parameters<typeof POST>[0],
    );

    expect(response.status).toBe(201);
    expect(createUserToHouseTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 10,
        houseId: 5,
        amount: 100,
        userFortnightId: 1,
        houseFortnightId: 2,
      }),
    );
  });
});
