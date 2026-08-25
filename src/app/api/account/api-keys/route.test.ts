import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  authMock,
  findManyApiKey,
  createApiKey,
  findUniqueOrThrowApiKey,
  enforceRateLimitMock,
  validateSelectableContextsMock,
  replaceApiKeyAllowedContextsMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  findManyApiKey: vi.fn(),
  createApiKey: vi.fn(),
  findUniqueOrThrowApiKey: vi.fn(),
  enforceRateLimitMock: vi.fn(),
  validateSelectableContextsMock: vi.fn(),
  replaceApiKeyAllowedContextsMock: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  auth: authMock,
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    apiKey: {
      findMany: findManyApiKey,
      create: createApiKey,
      findUniqueOrThrow: findUniqueOrThrowApiKey,
    },
  },
}));

vi.mock('@/lib/server/agent-allowed-contexts', () => ({
  validateSelectableContexts: validateSelectableContextsMock,
  replaceApiKeyAllowedContexts: replaceApiKeyAllowedContextsMock,
}));

vi.mock('@/lib/server/rate-limit', () => ({
  enforceRateLimit: enforceRateLimitMock,
}));

vi.mock('@/lib/server/agent-token', () => ({
  generateAgentToken: vi.fn(() => ({
    token: 'micasa_test-token-plaintext',
    keyPrefix: 'micasa_test-tok',
  })),
  hashAgentToken: vi.fn(() => 'sha256:hashed-token'),
}));

import { GET, POST } from './route';

const NOW = new Date('2026-08-23T10:00:00.000Z');

const makePostRequest = (body: unknown) =>
  new Request('http://localhost/api/account/api-keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as Parameters<typeof POST>[0];

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: { id: '7' } });
  enforceRateLimitMock.mockResolvedValue(null);
  validateSelectableContextsMock.mockResolvedValue([
    { ownerType: 'user', ownerId: 7 },
  ]);
  replaceApiKeyAllowedContextsMock.mockResolvedValue(undefined);
  findUniqueOrThrowApiKey.mockImplementation(async () => ({
    id: 5,
    name: 'Grok Bot',
    key_prefix: 'micasa_test-tok',
    scopes: ['read', 'write'],
    last_used_at: null,
    expires_at: null,
    revoked_at: null,
    created_at: NOW,
    allowedContexts: [{ owner_type: 'USER', owner_id: 7 }],
  }));
});

describe('GET /api/account/api-keys', () => {
  it('returns 401 when unauthenticated', async () => {
    authMock.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(findManyApiKey).not.toHaveBeenCalled();
  });

  it('lists only the session user keys, without hashes', async () => {
    findManyApiKey.mockResolvedValue([
      {
        id: 1,
        name: 'Grok Bot',
        key_prefix: 'micasa_abcd1234',
        scopes: ['read', 'write'],
        allowedContexts: [],
        last_used_at: NOW,
        revoked_at: null,
        created_at: NOW,
      },
    ]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(findManyApiKey).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user_id: 7 } }),
    );
    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      id: 1,
      name: 'Grok Bot',
      key_prefix: 'micasa_abcd1234',
      scopes: ['read', 'write'],
    });
    expect(body[0]).not.toHaveProperty('key_hash');
    expect(body[0]).not.toHaveProperty('token');
  });
});

describe('POST /api/account/api-keys', () => {
  it('returns 401 when unauthenticated', async () => {
    authMock.mockResolvedValue(null);

    const response = await POST(
      makePostRequest({
        name: 'Grok',
        scopes: ['read'],
        allowed_contexts: [{ ownerType: 'user', ownerId: 7 }],
      }),
    );

    expect(response.status).toBe(401);
    expect(createApiKey).not.toHaveBeenCalled();
  });

  it('rejects invalid input (empty name)', async () => {
    const response = await POST(makePostRequest({ name: '', scopes: ['read'] }));

    expect(response.status).toBe(400);
    expect(createApiKey).not.toHaveBeenCalled();
  });

  it('rejects scopes without read', async () => {
    const response = await POST(
      makePostRequest({ name: 'Solo escritura', scopes: ['write'] }),
    );

    expect(response.status).toBe(400);
    expect(createApiKey).not.toHaveBeenCalled();
  });

  it('returns 429 when rate limited', async () => {
    const limited = new Response(null, { status: 429 });
    enforceRateLimitMock.mockResolvedValue(limited);

    const response = await POST(
      makePostRequest({
        name: 'Grok',
        scopes: ['read'],
        allowed_contexts: [{ ownerType: 'user', ownerId: 7 }],
      }),
    );

    expect(response.status).toBe(429);
    expect(createApiKey).not.toHaveBeenCalled();
  });

  it('creates the key and returns the plaintext token only in this response', async () => {
    createApiKey.mockResolvedValue({
      id: 5,
      name: 'Grok Bot',
      key_prefix: 'micasa_test-tok',
      scopes: ['read', 'write'],
      last_used_at: null,
      expires_at: null,
      revoked_at: null,
      created_at: NOW,
    });

    const response = await POST(
      makePostRequest({
        name: 'Grok Bot',
        scopes: ['read', 'write'],
        allowed_contexts: [{ ownerType: 'user', ownerId: 7 }],
      }),
    );

    expect(response.status).toBe(201);
    expect(createApiKey).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          user_id: 7,
          name: 'Grok Bot',
          key_hash: 'sha256:hashed-token',
          key_prefix: 'micasa_test-tok',
          scopes: ['read', 'write'],
          expires_at: null,
        }),
      }),
    );
    const body = await response.json();
    expect(body.token).toBe('micasa_test-token-plaintext');
    expect(body).not.toHaveProperty('key_hash');
  });

  it('stores expires_at when expires_in_days is provided', async () => {
    const expiresAt = new Date(NOW.getTime() + 30 * 24 * 60 * 60 * 1000);
    createApiKey.mockResolvedValue({
      id: 6,
      name: 'Temporal',
      key_prefix: 'micasa_test-tok',
      scopes: ['read'],
      last_used_at: null,
      expires_at: expiresAt,
      revoked_at: null,
      created_at: NOW,
    });
    findUniqueOrThrowApiKey.mockResolvedValueOnce({
      id: 6,
      name: 'Temporal',
      key_prefix: 'micasa_test-tok',
      scopes: ['read'],
      last_used_at: null,
      expires_at: expiresAt,
      revoked_at: null,
      created_at: NOW,
      allowedContexts: [{ owner_type: 'USER', owner_id: 7 }],
    });

    const response = await POST(
      makePostRequest({
        name: 'Temporal',
        scopes: ['read'],
        expires_in_days: 30,
        allowed_contexts: [{ ownerType: 'user', ownerId: 7 }],
      }),
    );

    expect(response.status).toBe(201);
    const data = createApiKey.mock.calls[0][0].data;
    expect(data.expires_at).toBeInstanceOf(Date);
    const expectedMs = Date.now() + 30 * 24 * 60 * 60 * 1000;
    expect(Math.abs(data.expires_at.getTime() - expectedMs)).toBeLessThan(60_000);
    const body = await response.json();
    expect(body.expires_at).toBeTruthy();
  });

  it('rejects missing allowed_contexts', async () => {
    const response = await POST(
      makePostRequest({ name: 'Sin contextos', scopes: ['read'] }),
    );

    expect(response.status).toBe(400);
    expect(createApiKey).not.toHaveBeenCalled();
  });

  it('rejects expires_in_days above 365', async () => {
    const response = await POST(
      makePostRequest({ name: 'Eterna', scopes: ['read'], expires_in_days: 400 }),
    );

    expect(response.status).toBe(400);
    expect(createApiKey).not.toHaveBeenCalled();
  });
});
