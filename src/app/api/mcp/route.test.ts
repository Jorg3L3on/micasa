import { beforeEach, describe, expect, it, vi } from 'vitest';

const { resolveAgentUserMock } = vi.hoisted(() => ({
  resolveAgentUserMock: vi.fn(),
}));

vi.mock('@/lib/server/resolve-agent-context', () => ({
  resolveAgentUser: resolveAgentUserMock,
}));

import { POST } from '@/app/api/mcp/route';

const API_KEY_TOKEN = 'micasa_fixture-api-key-token-long-enough';
const OAUTH_TOKEN = 'micasa_oauth_fixture-oauth-token-long-enough';

const makeMcpRequest = (
  method: string,
  authorization?: string,
) =>
  new Request('http://localhost:3000/api/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params:
        method === 'initialize'
          ? {
              protocolVersion: '2025-03-26',
              capabilities: {},
              clientInfo: { name: 'test-client', version: '0.0.0' },
            }
          : {},
    }),
  }) as Parameters<typeof POST>[0];

const apiKeyAgent = {
  userId: 1,
  scopes: ['read', 'write'],
  authSource: 'api_key' as const,
  apiKeyId: 42,
  rateLimitIdentity: 42,
};

const oauthAgent = {
  userId: 2,
  scopes: ['read'],
  authSource: 'oauth_grant' as const,
  oauthGrantId: 9,
  rateLimitIdentity: -9,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/mcp transport auth', () => {
  it('returns 401 + WWW-Authenticate with resource_metadata for initialize without token', async () => {
    const response = await POST(makeMcpRequest('initialize'));

    expect(response.status).toBe(401);
    const wwwAuth = response.headers.get('WWW-Authenticate');
    expect(wwwAuth).toBeTruthy();
    expect(wwwAuth).toContain('resource_metadata=');
    expect(wwwAuth).toContain('/.well-known/oauth-protected-resource');
    expect(resolveAgentUserMock).not.toHaveBeenCalled();
  });

  it('returns 401 + WWW-Authenticate for tools/list without token', async () => {
    const response = await POST(makeMcpRequest('tools/list'));

    expect(response.status).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toContain('resource_metadata=');
  });

  it('allows initialize with a valid ApiKey Bearer token', async () => {
    resolveAgentUserMock.mockResolvedValue(apiKeyAgent);

    const response = await POST(
      makeMcpRequest('initialize', `Bearer ${API_KEY_TOKEN}`),
    );

    expect(response.status).toBe(200);
    expect(resolveAgentUserMock).toHaveBeenCalledWith(API_KEY_TOKEN);
    expect(response.headers.get('WWW-Authenticate')).toBeNull();
  });

  it('allows tools/list with a valid OAuth access token', async () => {
    resolveAgentUserMock.mockResolvedValue(oauthAgent);

    const response = await POST(
      makeMcpRequest('tools/list', `Bearer ${OAUTH_TOKEN}`),
    );

    expect(response.status).toBe(200);
    expect(resolveAgentUserMock).toHaveBeenCalledWith(OAUTH_TOKEN);
    expect(response.headers.get('WWW-Authenticate')).toBeNull();
  });

  it('returns 401 for an invalid Bearer token', async () => {
    resolveAgentUserMock.mockRejectedValue(new Error('invalid'));

    const response = await POST(
      makeMcpRequest('initialize', `Bearer ${API_KEY_TOKEN}`),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toContain('resource_metadata=');
  });
});
