import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, findFirstApiKey, updateApiKey } = vi.hoisted(() => ({
  authMock: vi.fn(),
  findFirstApiKey: vi.fn(),
  updateApiKey: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  auth: authMock,
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    apiKey: {
      findFirst: findFirstApiKey,
      update: updateApiKey,
    },
  },
}));

import { DELETE, PATCH } from './route';

const makeParams = (id: string) => Promise.resolve({ id });

const makePatchRequest = (body: unknown) =>
  new Request('http://localhost/api/account/api-keys/5', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as Parameters<typeof PATCH>[0];

const makeDeleteRequest = () =>
  new Request('http://localhost/api/account/api-keys/5', {
    method: 'DELETE',
  }) as Parameters<typeof DELETE>[0];

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: { id: '7' } });
});

describe('PATCH /api/account/api-keys/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    authMock.mockResolvedValue(null);

    const response = await PATCH(makePatchRequest({ name: 'Nuevo' }), {
      params: makeParams('5'),
    });

    expect(response.status).toBe(401);
    expect(updateApiKey).not.toHaveBeenCalled();
  });

  it('returns 404 when the key belongs to another user', async () => {
    findFirstApiKey.mockResolvedValue(null);

    const response = await PATCH(makePatchRequest({ name: 'Nuevo' }), {
      params: makeParams('5'),
    });

    expect(response.status).toBe(404);
    expect(findFirstApiKey).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 5, user_id: 7 } }),
    );
    expect(updateApiKey).not.toHaveBeenCalled();
  });

  it('rejects an empty name', async () => {
    findFirstApiKey.mockResolvedValue({ id: 5 });

    const response = await PATCH(makePatchRequest({ name: '  ' }), {
      params: makeParams('5'),
    });

    expect(response.status).toBe(400);
    expect(updateApiKey).not.toHaveBeenCalled();
  });

  it('renames an owned key', async () => {
    findFirstApiKey.mockResolvedValue({ id: 5 });
    updateApiKey.mockResolvedValue({ id: 5, name: 'Claude' });

    const response = await PATCH(makePatchRequest({ name: 'Claude' }), {
      params: makeParams('5'),
    });

    expect(response.status).toBe(200);
    expect(updateApiKey).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 5 },
        data: { name: 'Claude' },
      }),
    );
    await expect(response.json()).resolves.toMatchObject({
      id: 5,
      name: 'Claude',
    });
  });
});

describe('DELETE /api/account/api-keys/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    authMock.mockResolvedValue(null);

    const response = await DELETE(makeDeleteRequest(), {
      params: makeParams('5'),
    });

    expect(response.status).toBe(401);
    expect(updateApiKey).not.toHaveBeenCalled();
  });

  it('returns 404 when the key belongs to another user', async () => {
    findFirstApiKey.mockResolvedValue(null);

    const response = await DELETE(makeDeleteRequest(), {
      params: makeParams('5'),
    });

    expect(response.status).toBe(404);
    expect(updateApiKey).not.toHaveBeenCalled();
  });

  it('revokes (does not delete) an owned key', async () => {
    findFirstApiKey.mockResolvedValue({ id: 5 });
    updateApiKey.mockResolvedValue({ id: 5 });

    const response = await DELETE(makeDeleteRequest(), {
      params: makeParams('5'),
    });

    expect(response.status).toBe(200);
    expect(updateApiKey).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 5 },
        data: { revoked_at: expect.any(Date) },
      }),
    );
    await expect(response.json()).resolves.toEqual({ revoked: true });
  });
});
