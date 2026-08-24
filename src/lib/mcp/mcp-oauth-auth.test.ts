import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findUniqueApiKey, updateApiKey, findFirstMembership, resolveOAuthGrantUserMock } =
  vi.hoisted(() => ({
    findUniqueApiKey: vi.fn(),
    updateApiKey: vi.fn(),
    findFirstMembership: vi.fn(),
    resolveOAuthGrantUserMock: vi.fn(),
  }));

vi.mock('@/lib/prisma', () => ({
  default: {
    apiKey: { findUnique: findUniqueApiKey, update: updateApiKey },
    houseMember: { findFirst: findFirstMembership },
  },
}));

vi.mock('@/lib/server/mcp-oauth/grants', () => ({
  resolveOAuthGrantUser: resolveOAuthGrantUserMock,
}));

vi.mock('@/lib/server/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({
    limited: false,
    retryAfterSeconds: 0,
    remaining: 120,
  }),
}));

import { runAgentUserTool } from '@/lib/mcp/tool-helpers';
import { hashAgentToken } from '@/lib/server/agent-token';

const API_KEY_TOKEN = 'micasa_secreto-de-prueba-suficientemente-largo';
const OAUTH_TOKEN = 'micasa_oauth_acceso-de-prueba-suficientemente-largo';

const ctxWithToken = (token: string) => ({
  http: {
    req: new Request('http://localhost/api/mcp', {
      headers: { authorization: `Bearer ${token}` },
    }),
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  updateApiKey.mockResolvedValue({});
});

describe('MCP tool auth: ApiKey vs OAuth', () => {
  it('list_houses funciona con token ApiKey micasa_', async () => {
    findUniqueApiKey.mockResolvedValue({
      id: 10,
      key_hash: hashAgentToken(API_KEY_TOKEN),
      revoked_at: null,
      expires_at: null,
      scopes: ['read'],
      user: { id: 2, active: true },
    });

    const result = await runAgentUserTool(
      'list_houses',
      ctxWithToken(API_KEY_TOKEN),
      async (user) => ({ userId: user.userId, source: 'api_key' }),
    );

    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual({
      userId: 2,
      source: 'api_key',
    });
  });

  it('list_houses funciona con OAuth access token', async () => {
    resolveOAuthGrantUserMock.mockResolvedValue({
      userId: 5,
      scopes: ['read', 'write'],
      oauthGrantId: 12,
      clientName: 'ChatGPT Test Client',
    });

    const result = await runAgentUserTool(
      'list_houses',
      ctxWithToken(OAUTH_TOKEN),
      async (user) => ({ userId: user.userId, source: 'oauth' }),
    );

    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual({
      userId: 5,
      source: 'oauth',
    });
    expect(findUniqueApiKey).not.toHaveBeenCalled();
  });
});
