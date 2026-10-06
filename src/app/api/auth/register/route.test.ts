import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findUniqueUser, transaction } = vi.hoisted(() => ({
  findUniqueUser: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    user: { findUnique: findUniqueUser },
    $transaction: transaction,
  },
}));

vi.mock('bcryptjs', () => ({
  hash: vi.fn(async () => 'hashed-password'),
}));

import { resetRateLimitStoreForTests } from '@/lib/server/rate-limit';
import { GENERIC_REGISTER_ERROR_MESSAGE } from '@/schemas/auth.schema';
import { POST } from './route';

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimitStoreForTests();
  });

  it('returns 400 when email is invalid', async () => {
    const response = await POST(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test User',
          email: 'not-an-email',
          password: 'secret12',
        }),
      }) as Parameters<typeof POST>[0],
    );

    expect(response.status).toBe(400);
    expect(findUniqueUser).not.toHaveBeenCalled();
  });

  it('returns 400 when the password is shorter than 8 characters', async () => {
    const response = await POST(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test User',
          email: 'new@example.com',
          password: 'short7c',
        }),
      }) as Parameters<typeof POST>[0],
    );

    expect(response.status).toBe(400);
    expect(findUniqueUser).not.toHaveBeenCalled();
  });

  it('returns generic 400 when email is already registered', async () => {
    findUniqueUser.mockResolvedValue({ id: 1, email: 'exists@example.com' });

    const response = await POST(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test User',
          email: 'exists@example.com',
          password: 'secret12',
        }),
      }) as Parameters<typeof POST>[0],
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: GENERIC_REGISTER_ERROR_MESSAGE,
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  const categoryTxStub = () => {
    let nextId = 1;
    return {
      count: vi.fn(async () => 0),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: nextId++,
        ...data,
      })),
      createMany: vi.fn(async ({ data }: { data: unknown[] }) => ({
        count: data.length,
      })),
      createManyAndReturn: vi.fn(
        async ({ data }: { data: { name: string; user_id?: number | null }[] }) =>
          data.map((row) => ({ id: nextId++, name: row.name })),
      ),
    };
  };

  it('normalizes email before uniqueness check and persistence', async () => {
    findUniqueUser.mockResolvedValue(null);
    transaction.mockImplementation(async (callback) =>
      callback({
        user: {
          create: vi.fn(async ({ data }: { data: { email: string } }) => ({
            id: 42,
            email: data.email,
            name: 'New User',
          })),
        },
        house: {
          create: vi.fn(async () => ({ id: 7, name: 'Casa de New User' })),
        },
        houseMember: {
          create: vi.fn(async () => ({})),
        },
        category: categoryTxStub(),
      }),
    );

    const response = await POST(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'New User',
          email: '  New@Example.COM  ',
          password: 'secret12',
        }),
      }) as Parameters<typeof POST>[0],
    );

    expect(response.status).toBe(201);
    expect(findUniqueUser).toHaveBeenCalledWith({
      where: { email: 'new@example.com' },
    });
    await expect(response.json()).resolves.toEqual({
      id: 42,
      email: 'new@example.com',
      name: 'New User',
      house: { id: 7, name: 'Casa de New User' },
    });
  });

  it('creates user, house, and membership on success', async () => {
    findUniqueUser.mockResolvedValue(null);
    transaction.mockImplementation(async (callback) =>
      callback({
        user: {
          create: vi.fn(async () => ({
            id: 42,
            email: 'new@example.com',
            name: 'New User',
          })),
        },
        house: {
          create: vi.fn(async () => ({ id: 7, name: 'Casa de New User' })),
        },
        houseMember: {
          create: vi.fn(async () => ({})),
        },
        category: categoryTxStub(),
      }),
    );

    const response = await POST(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'New User',
          email: 'new@example.com',
          password: 'secret12',
        }),
      }) as Parameters<typeof POST>[0],
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      id: 42,
      email: 'new@example.com',
      name: 'New User',
      house: { id: 7, name: 'Casa de New User' },
    });
  });

  it('seeds only personal categories, in batches, with an explicit timeout', async () => {
    findUniqueUser.mockResolvedValue(null);
    const category = categoryTxStub();
    transaction.mockImplementation(async (callback) =>
      callback({
        user: {
          create: vi.fn(async () => ({
            id: 42,
            email: 'new@example.com',
            name: 'New User',
          })),
        },
        house: {
          create: vi.fn(async () => ({ id: 7, name: 'Casa de New User' })),
        },
        houseMember: { create: vi.fn(async () => ({})) },
        category,
      }),
    );

    const response = await POST(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '192.168.60.1',
        },
        body: JSON.stringify({
          name: 'New User',
          email: 'new@example.com',
          password: 'secret12',
        }),
      }) as Parameters<typeof POST>[0],
    );

    expect(response.status).toBe(201);
    expect(category.create).not.toHaveBeenCalled();
    // Expense + income catalogs for the user only; the house seeds lazily.
    expect(category.createManyAndReturn).toHaveBeenCalledTimes(2);
    for (const [args] of category.createManyAndReturn.mock.calls) {
      expect(args.data.every((row) => row.user_id === 42)).toBe(true);
    }
    expect(transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ timeout: expect.any(Number) }),
    );
  });

  it('returns 503 with a retry message when the transaction times out', async () => {
    findUniqueUser.mockResolvedValue(null);
    const { Prisma } = await import('@/generated/prisma/client');
    transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Transaction API error', {
        code: 'P2028',
        clientVersion: 'test',
      }),
    );

    const response = await POST(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '192.168.60.2',
        },
        body: JSON.stringify({
          name: 'New User',
          email: 'slow@example.com',
          password: 'secret12',
        }),
      }) as Parameters<typeof POST>[0],
    );

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toMatch(/tardó demasiado/);
  });

  it('returns 429 when registration rate limit is exceeded', async () => {
    findUniqueUser.mockResolvedValue({ id: 1, email: 'exists@example.com' });

    const makeRequest = () =>
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '192.168.50.10',
        },
        body: JSON.stringify({
          name: 'Test User',
          email: 'exists@example.com',
          password: 'secret12',
        }),
      }) as Parameters<typeof POST>[0];

    for (let i = 0; i < 10; i += 1) {
      await POST(makeRequest());
    }

    const response = await POST(makeRequest());
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBeTruthy();
  });
});
