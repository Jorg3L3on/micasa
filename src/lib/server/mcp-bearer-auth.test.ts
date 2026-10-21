import { beforeEach, describe, expect, it, vi } from 'vitest';

const { resolveAgentIdentityMock } = vi.hoisted(() => ({
  resolveAgentIdentityMock: vi.fn(),
}));

vi.mock('@/lib/server/resolve-agent-context', () => ({
  resolveAgentIdentity: resolveAgentIdentityMock,
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
    expect(resolveAgentIdentityMock).not.toHaveBeenCalled();
  });

  it('maps ApiKey credentials to AuthInfo', async () => {
    resolveAgentIdentityMock.mockResolvedValue({
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

    expect(resolveAgentIdentityMock).toHaveBeenCalledWith(API_KEY_TOKEN);
    expect(result).toEqual({
      token: API_KEY_TOKEN,
      clientId: 'api-key:42',
      scopes: ['read', 'write'],
      extra: {
        micasa_agent: {
          userId: 1,
          scopes: ['read', 'write'],
          authSource: 'api_key',
          apiKeyId: 42,
          rateLimitIdentity: 42,
        },
      },
    });
  });

  it('maps OAuth access tokens to AuthInfo', async () => {
    resolveAgentIdentityMock.mockResolvedValue({
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
      extra: {
        micasa_agent: {
          userId: 2,
          scopes: ['read'],
          authSource: 'oauth_grant',
          oauthGrantId: 9,
          rateLimitIdentity: -9,
        },
      },
    });
  });

  it('returns undefined when resolveAgentIdentity rejects the token', async () => {
    resolveAgentIdentityMock.mockRejectedValue(new Error('invalid'));
    const result = await verifyMcpBearerToken(
      new Request('http://localhost/api/mcp'),
      API_KEY_TOKEN,
    );
    expect(result).toBeUndefined();
  });
});
