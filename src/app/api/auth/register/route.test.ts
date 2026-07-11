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

  it('returns 409 when email is already registered', async () => {
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

    expect(response.status).toBe(409);
    expect(transaction).not.toHaveBeenCalled();
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
