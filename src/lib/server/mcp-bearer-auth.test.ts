import { beforeEach, describe, expect, it, vi } from 'vitest';

const { resolveAgentUserMock } = vi.hoisted(() => ({
  resolveAgentUserMock: vi.fn(),
}));

vi.mock('@/lib/server/resolve-agent-context', () => ({
  resolveAgentUser: resolveAgentUserMock,
}));

import { verifyMcpBearerToken } from '@/lib/server/mcp-bearer-auth';

const API_KEY_TOKEN = 'micasa_fixture-api-key-token-long-enough';
const OAUTH_TOKEN = 'micasa_oauth_fixture-oauth-token-long-enough';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('verifyMcpBearerToken', () => {
  it('returns undefined when bearer token is missing', async () => {
    const result = await verifyMcpBearerToken(new Request('http://localhost/api/mcp'));
    expect(result).toBeUndefined();
    expect(resolveAgentUserMock).not.toHaveBeenCalled();
  });

  it('maps ApiKey credentials to AuthInfo', async () => {
    resolveAgentUserMock.mockResolvedValue({
      userId: 1,
      scopes: ['read', 'write'],
      authSource: 'api_key',
      apiKeyId: 42,
      rateLimitIdentity: 42,
    });

    const result = await verifyMcpBearerToken(
      new Request('http://localhost/api/mcp'),
      API_KEY_TOKEN,
    );

    expect(resolveAgentUserMock).toHaveBeenCalledWith(API_KEY_TOKEN);
    expect(result).toEqual({
      token: API_KEY_TOKEN,
      clientId: 'api-key:42',
      scopes: ['read', 'write'],
    });
  });

  it('maps OAuth access tokens to AuthInfo', async () => {
    resolveAgentUserMock.mockResolvedValue({
      userId: 2,
      scopes: ['read'],
      authSource: 'oauth_grant',
      oauthGrantId: 9,
      rateLimitIdentity: -9,
    });

    const result = await verifyMcpBearerToken(
      new Request('http://localhost/api/mcp'),
      OAUTH_TOKEN,
    );

    expect(result).toEqual({
      token: OAUTH_TOKEN,
      clientId: 'oauth-grant:9',
      scopes: ['read'],
    });
  });

  it('returns undefined when resolveAgentUser rejects the token', async () => {
    resolveAgentUserMock.mockRejectedValue(new Error('invalid'));
    const result = await verifyMcpBearerToken(
      new Request('http://localhost/api/mcp'),
      API_KEY_TOKEN,
    );
    expect(result).toBeUndefined();
  });
});
