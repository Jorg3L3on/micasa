import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  mcpOAuthAuthorizationCode: {
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  mcpOAuthAuthorizationCodeContext: {
    findMany: vi.fn(),
  },
  mcpOAuthGrant: {
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    findUnique: vi.fn(),
  },
  agentConnectionAllowedContext: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

const logFinanceEventMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({
  default: prismaMock,
}));

vi.mock('@/lib/observability/finance-log', () => ({
  logFinanceEvent: logFinanceEventMock,
}));

vi.mock('@/lib/server/mcp-oauth/tokens', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/server/mcp-oauth/tokens')>();
  return {
    ...actual,
    generateAuthorizationCode: vi.fn(),
    generateOAuthAccessToken: vi.fn(() => ({
      token: 'micasa_oauth_fixture-access-token-long',
      tokenPrefix: 'micasa_oauth_fixture',
      tokenHash: 'sha256:abc',
    })),
    generateOAuthRefreshToken: vi.fn(() => ({
      token: 'micasa_refresh_fixture-refresh-token-long',
      tokenPrefix: 'micasa_refresh_fixture',
      tokenHash: 'sha256:def',
    })),
  };
});

import {
  exchangeAuthorizationCode,
  issueGrant,
  refreshOAuthGrant,
  resolveOAuthGrantUser,
} from '@/lib/server/mcp-oauth/grants';
import { OAuthInvalidGrantError } from '@/lib/server/mcp-oauth/invalid-grant';
import {
  hashOAuthSecret,
  verifyPkceS256,
} from '@/lib/server/mcp-oauth/tokens';

const CODE = 'micasa_code_fixture-authorization-code';
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
const INSTANCE_CIMD = 'https://chatgpt.com/oauth/fixture-client/client.json';
const STABLE_CIMD = 'https://chatgpt.com/oauth/client.json';
const REDIRECT = 'https://chatgpt.com/connector/oauth/fixture-client';
const ATTACKER_CIMD = 'https://evil.example/oauth/client.json';

const baseCodeRow = {
  id: 1,
  code_hash: hashOAuthSecret(CODE),
  client_id: INSTANCE_CIMD,
  user_id: 42,
  redirect_uri: REDIRECT,
  scopes: ['read', 'write'],
  code_challenge: CHALLENGE,
  code_challenge_method: 'S256',
  resource: 'https://micasa.example/api/mcp',
  expires_at: new Date(Date.now() + 60_000),
  used_at: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXTAUTH_URL', 'https://micasa.example');
  prismaMock.mcpOAuthAuthorizationCode.findUnique.mockResolvedValue(baseCodeRow);
  prismaMock.mcpOAuthAuthorizationCode.update.mockResolvedValue({});
  prismaMock.mcpOAuthAuthorizationCode.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.mcpOAuthGrant.updateMany.mockResolvedValue({ count: 0 });
  prismaMock.mcpOAuthAuthorizationCodeContext.findMany.mockResolvedValue([]);
  prismaMock.mcpOAuthGrant.create.mockResolvedValue({ id: 1 });
  prismaMock.agentConnectionAllowedContext.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.agentConnectionAllowedContext.createMany.mockResolvedValue({ count: 0 });
  prismaMock.$transaction.mockImplementation(async (ops: unknown) => {
    if (Array.isArray(ops)) {
      for (const op of ops) await op;
    }
    return ops;
  });
});

describe('issueGrant', () => {
  it('returns lowercase token_type bearer', async () => {
    const response = await issueGrant({
      userId: 1,
      clientId: INSTANCE_CIMD,
      scopes: ['read'],
      resource: 'https://micasa.example/api/mcp',
    });

    expect(response.token_type).toBe('bearer');
    expect(response.access_token).toContain('micasa_oauth_');
  });
});

describe('exchangeAuthorizationCode', () => {
  it('accepts RFC 8707 /mcp resource alias against stored /api/mcp', async () => {
    const response = await exchangeAuthorizationCode({
      code: CODE,
      clientId: INSTANCE_CIMD,
      redirectUri: REDIRECT,
      codeVerifier: VERIFIER,
      resource: 'https://micasa.example/mcp',
    });

    expect(response.token_type).toBe('bearer');
    expect(prismaMock.mcpOAuthGrant.create).toHaveBeenCalled();
  });

  it('accepts stable CIMD token client_id for an instance CIMD code row (both trusted hosts)', async () => {
    const response = await exchangeAuthorizationCode({
      code: CODE,
      clientId: STABLE_CIMD,
      redirectUri: REDIRECT,
      codeVerifier: VERIFIER,
    });

    expect(response.token_type).toBe('bearer');
  });

  it('rejects when redirect_uri does not match the code row', async () => {
    await expect(
      exchangeAuthorizationCode({
        code: CODE,
        clientId: INSTANCE_CIMD,
        redirectUri: 'https://chatgpt.com/connector_platform_oauth_redirect',
        codeVerifier: VERIFIER,
      }),
    ).rejects.toMatchObject({ reason: 'redirect' } satisfies Partial<OAuthInvalidGrantError>);
  });

  it('rejects a foreign CIMD client_id even if its redirect_uris include the code redirect', async () => {
    // Attack: evil.example/oauth/client.json declares the victim's redirect.
    // Only an exact client_id match (or two trusted CIMD hosts) is accepted.
    await expect(
      exchangeAuthorizationCode({
        code: CODE,
        clientId: ATTACKER_CIMD,
        redirectUri: REDIRECT,
        codeVerifier: VERIFIER,
      }),
    ).rejects.toMatchObject({ reason: 'client' } satisfies Partial<OAuthInvalidGrantError>);
    expect(prismaMock.mcpOAuthGrant.create).not.toHaveBeenCalled();
  });

  it('rejects a DCR client_id different from the code client_id', async () => {
    prismaMock.mcpOAuthAuthorizationCode.findUnique.mockResolvedValue({
      ...baseCodeRow,
      client_id: '11111111-2222-3333-4444-555555555555',
    });

    await expect(
      exchangeAuthorizationCode({
        code: CODE,
        clientId: '99999999-2222-3333-4444-555555555555',
        redirectUri: REDIRECT,
        codeVerifier: VERIFIER,
      }),
    ).rejects.toMatchObject({ reason: 'client' } satisfies Partial<OAuthInvalidGrantError>);
  });

  it('rejects an exchange without code_verifier (PKCE is mandatory)', async () => {
    await expect(
      exchangeAuthorizationCode({
        code: CODE,
        clientId: INSTANCE_CIMD,
        redirectUri: REDIRECT,
      }),
    ).rejects.toMatchObject({ reason: 'pkce' } satisfies Partial<OAuthInvalidGrantError>);
    expect(prismaMock.mcpOAuthGrant.create).not.toHaveBeenCalled();
  });

  it('rejects an exchange with a wrong code_verifier', async () => {
    await expect(
      exchangeAuthorizationCode({
        code: CODE,
        clientId: INSTANCE_CIMD,
        redirectUri: REDIRECT,
        codeVerifier:
          'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      }),
    ).rejects.toMatchObject({ reason: 'pkce' } satisfies Partial<OAuthInvalidGrantError>);
  });

  it('revokes every grant issued from a replayed code and logs oauth.code_reuse', async () => {
    prismaMock.mcpOAuthAuthorizationCode.findUnique.mockResolvedValue({
      ...baseCodeRow,
      used_at: new Date(),
    });
    prismaMock.mcpOAuthGrant.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      exchangeAuthorizationCode({
        code: CODE,
        clientId: INSTANCE_CIMD,
        redirectUri: REDIRECT,
        codeVerifier: VERIFIER,
      }),
    ).rejects.toMatchObject({
      reason: 'code_reuse',
    } satisfies Partial<OAuthInvalidGrantError>);

    expect(prismaMock.mcpOAuthGrant.updateMany).toHaveBeenCalledWith({
      where: { authorization_code_id: baseCodeRow.id, revoked_at: null },
      data: { revoked_at: expect.any(Date) },
    });
    expect(logFinanceEventMock).toHaveBeenCalledWith('warn', 'oauth.code_reuse', {
      client_id: INSTANCE_CIMD,
      user_id: 42,
      revoked_grants: 1,
    });
    expect(prismaMock.mcpOAuthGrant.create).not.toHaveBeenCalled();
  });

  it('issues exactly one grant when the same code is exchanged twice concurrently', async () => {
    // Both requests read used_at: null; only the first conditional update wins.
    prismaMock.mcpOAuthAuthorizationCode.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const exchange = () =>
      exchangeAuthorizationCode({
        code: CODE,
        clientId: INSTANCE_CIMD,
        redirectUri: REDIRECT,
        codeVerifier: VERIFIER,
      });
    const results = await Promise.allSettled([exchange(), exchange()]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(OAuthInvalidGrantError);
    expect(prismaMock.mcpOAuthGrant.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.mcpOAuthAuthorizationCode.updateMany).toHaveBeenCalledWith({
      where: { id: baseCodeRow.id, used_at: null },
      data: { used_at: expect.any(Date) },
    });
  });

  it('does not burn the code when PKCE fails', async () => {
    await expect(
      exchangeAuthorizationCode({
        code: CODE,
        clientId: INSTANCE_CIMD,
        redirectUri: REDIRECT,
      }),
    ).rejects.toMatchObject({ reason: 'pkce' } satisfies Partial<OAuthInvalidGrantError>);
    expect(prismaMock.mcpOAuthAuthorizationCode.updateMany).not.toHaveBeenCalled();
  });

  it('links the issued grant to its authorization code', async () => {
    await exchangeAuthorizationCode({
      code: CODE,
      clientId: INSTANCE_CIMD,
      redirectUri: REDIRECT,
      codeVerifier: VERIFIER,
    });

    expect(prismaMock.mcpOAuthGrant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ authorization_code_id: baseCodeRow.id }),
    });
  });

  it('rejects expired authorization codes with reason expired', async () => {
    prismaMock.mcpOAuthAuthorizationCode.findUnique.mockResolvedValue({
      ...baseCodeRow,
      expires_at: new Date(Date.now() - 1_000),
    });

    await expect(
      exchangeAuthorizationCode({
        code: CODE,
        clientId: INSTANCE_CIMD,
        redirectUri: REDIRECT,
        codeVerifier: VERIFIER,
      }),
    ).rejects.toMatchObject({ reason: 'expired' } satisfies Partial<OAuthInvalidGrantError>);
  });

  it('exchanges ChatGPT CIMD instance + connector_instance redirect + PKCE + /api/mcp resource', async () => {
    const response = await exchangeAuthorizationCode({
      code: CODE,
      clientId: INSTANCE_CIMD,
      redirectUri: REDIRECT,
      codeVerifier: VERIFIER,
      resource: 'https://micasa.example/api/mcp',
    });

    expect(response.token_type).toBe('bearer');
    expect(response.access_token).toContain('micasa_oauth_');
    expect(verifyPkceS256(VERIFIER, CHALLENGE)).toBe(true);
    expect(prismaMock.mcpOAuthAuthorizationCode.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { used_at: expect.any(Date) },
      }),
    );
  });
});

const REFRESH = 'micasa_refresh_fixture-presented-refresh-token';

const grantRow = {
  id: 5,
  user_id: 42,
  client_id: INSTANCE_CIMD,
  token_hash: 'sha256:old',
  token_prefix: 'micasa_oauth_oldpref',
  refresh_token_hash: hashOAuthSecret(REFRESH),
  refresh_token_prefix: 'micasa_refresh_oldpr',
  previous_refresh_token_hash: null,
  scopes: ['read'],
  resource: 'https://micasa.example/api/mcp',
  expires_at: new Date(Date.now() + 60_000),
  refresh_expires_at: new Date(Date.now() + 86_400_000),
  revoked_at: null,
};

describe('refreshOAuthGrant', () => {
  beforeEach(() => {
    prismaMock.mcpOAuthGrant.findUnique.mockImplementation(
      async ({ where }: { where: Record<string, string> }) =>
        where.refresh_token_hash === grantRow.refresh_token_hash ? grantRow : null,
    );
    prismaMock.mcpOAuthGrant.updateMany.mockResolvedValue({ count: 1 });
  });

  it('rotates, remembers the previous refresh hash and renews both lifetimes', async () => {
    const response = await refreshOAuthGrant({
      refreshToken: REFRESH,
      clientId: INSTANCE_CIMD,
    });

    expect(response.expires_in).toBe(86_400);
    const call = prismaMock.mcpOAuthGrant.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({
      id: grantRow.id,
      refresh_token_hash: grantRow.refresh_token_hash,
      revoked_at: null,
    });
    expect(call.data.previous_refresh_token_hash).toBe(grantRow.refresh_token_hash);
    expect(call.data).not.toHaveProperty('revoked_at');
    expect(call.data.refresh_expires_at.getTime()).toBeGreaterThan(
      Date.now() + 364 * 86_400_000,
    );
    expect(call.data.expires_at.getTime()).toBeLessThanOrEqual(Date.now() + 86_400_000);
  });

  it('rejects an expired refresh token with invalid_grant (expired)', async () => {
    prismaMock.mcpOAuthGrant.findUnique.mockResolvedValue({
      ...grantRow,
      refresh_expires_at: new Date(Date.now() - 1_000),
    });

    await expect(
      refreshOAuthGrant({ refreshToken: REFRESH, clientId: INSTANCE_CIMD }),
    ).rejects.toMatchObject({ reason: 'expired' } satisfies Partial<OAuthInvalidGrantError>);
    expect(prismaMock.mcpOAuthGrant.updateMany).not.toHaveBeenCalled();
  });

  it('revokes the grant and logs oauth.refresh_reuse when a rotated refresh token is replayed', async () => {
    prismaMock.mcpOAuthGrant.findUnique.mockImplementation(
      async ({ where }: { where: Record<string, string> }) =>
        where.previous_refresh_token_hash === hashOAuthSecret(REFRESH)
          ? { id: 5, client_id: INSTANCE_CIMD, user_id: 42, revoked_at: null }
          : null,
    );

    await expect(
      refreshOAuthGrant({ refreshToken: REFRESH, clientId: INSTANCE_CIMD }),
    ).rejects.toMatchObject({
      reason: 'refresh_reuse',
    } satisfies Partial<OAuthInvalidGrantError>);

    expect(prismaMock.mcpOAuthGrant.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { revoked_at: expect.any(Date) },
    });
    expect(logFinanceEventMock).toHaveBeenCalledWith('warn', 'oauth.refresh_reuse', {
      client_id: INSTANCE_CIMD,
      user_id: 42,
      grant_id: 5,
    });
  });

  it('does not un-revoke a revoked grant', async () => {
    prismaMock.mcpOAuthGrant.findUnique.mockResolvedValue({
      ...grantRow,
      revoked_at: new Date(),
    });

    await expect(
      refreshOAuthGrant({ refreshToken: REFRESH, clientId: INSTANCE_CIMD }),
    ).rejects.toBeInstanceOf(OAuthInvalidGrantError);
    expect(prismaMock.mcpOAuthGrant.updateMany).not.toHaveBeenCalled();
  });

  it('only one of two concurrent refreshes rotates', async () => {
    prismaMock.mcpOAuthGrant.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      refreshOAuthGrant({ refreshToken: REFRESH, clientId: INSTANCE_CIMD }),
    ).rejects.toMatchObject({ reason: 'other' } satisfies Partial<OAuthInvalidGrantError>);
  });
});

describe('resolveOAuthGrantUser audience (RFC 8707)', () => {
  const ACCESS = 'micasa_oauth_fixture-access-token-for-audience';

  const grantFor = (resource: string) => ({
    ...grantRow,
    token_hash: hashOAuthSecret(ACCESS),
    resource,
    user: { id: 42, active: true },
    client: { client_name: 'ChatGPT' },
  });

  beforeEach(() => {
    prismaMock.mcpOAuthGrant.update.mockResolvedValue({});
  });

  it('accepts a grant issued for this MCP server', async () => {
    prismaMock.mcpOAuthGrant.findUnique.mockResolvedValue(
      grantFor('https://micasa.example/api/mcp'),
    );
    expect(await resolveOAuthGrantUser(ACCESS)).toMatchObject({ userId: 42 });
  });

  it('rejects a grant whose resource is another server', async () => {
    prismaMock.mcpOAuthGrant.findUnique.mockResolvedValue(
      grantFor('https://evil.example/api/mcp'),
    );
    expect(await resolveOAuthGrantUser(ACCESS)).toBeNull();
  });
});
