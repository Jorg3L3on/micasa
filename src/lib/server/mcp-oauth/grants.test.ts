import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  mcpOAuthAuthorizationCode: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  mcpOAuthGrant: {
    create: vi.fn(),
  },
}));

const tokenClientIdMatchesCodeMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({
  default: prismaMock,
}));

vi.mock('@/lib/server/mcp-oauth/clients', () => ({
  tokenClientIdMatchesCode: tokenClientIdMatchesCodeMock,
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
  prismaMock.mcpOAuthGrant.create.mockResolvedValue({ id: 1 });
  tokenClientIdMatchesCodeMock.mockResolvedValue(true);
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

  it('accepts stable CIMD token client_id for instance CIMD code row with matching redirect', async () => {
    tokenClientIdMatchesCodeMock.mockResolvedValue(true);

    const response = await exchangeAuthorizationCode({
      code: CODE,
      clientId: STABLE_CIMD,
      redirectUri: REDIRECT,
      clientAuthenticatedViaPrivateKeyJwt: true,
    });

    expect(response.token_type).toBe('bearer');
    expect(tokenClientIdMatchesCodeMock).toHaveBeenCalledWith(
      STABLE_CIMD,
      INSTANCE_CIMD,
      REDIRECT,
    );
  });

  it('rejects when redirect_uri does not match the code row', async () => {
    await expect(
      exchangeAuthorizationCode({
        code: CODE,
        clientId: INSTANCE_CIMD,
        redirectUri: 'https://chatgpt.com/connector_platform_oauth_redirect',
        clientAuthenticatedViaPrivateKeyJwt: true,
      }),
    ).rejects.toMatchObject({ reason: 'redirect' } satisfies Partial<OAuthInvalidGrantError>);
  });

  it('rejects when token client_id is incompatible with the code row', async () => {
    tokenClientIdMatchesCodeMock.mockResolvedValue(false);

    await expect(
      exchangeAuthorizationCode({
        code: CODE,
        clientId: STABLE_CIMD,
        redirectUri: REDIRECT,
        clientAuthenticatedViaPrivateKeyJwt: true,
      }),
    ).rejects.toMatchObject({ reason: 'client' } satisfies Partial<OAuthInvalidGrantError>);
  });

  it('accepts private_key_jwt without code_verifier when JWT auth is flagged', async () => {
    const response = await exchangeAuthorizationCode({
      code: CODE,
      clientId: INSTANCE_CIMD,
      redirectUri: REDIRECT,
      clientAuthenticatedViaPrivateKeyJwt: true,
    });

    expect(response.token_type).toBe('bearer');
  });

  it('rejects already-used authorization codes with invalid_grant', async () => {
    prismaMock.mcpOAuthAuthorizationCode.findUnique.mockResolvedValue({
      ...baseCodeRow,
      used_at: new Date(),
    });

    await expect(
      exchangeAuthorizationCode({
        code: CODE,
        clientId: INSTANCE_CIMD,
        redirectUri: REDIRECT,
        codeVerifier: VERIFIER,
      }),
    ).rejects.toMatchObject({ reason: 'other' } satisfies Partial<OAuthInvalidGrantError>);
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
    expect(tokenClientIdMatchesCodeMock).toHaveBeenCalledWith(
      INSTANCE_CIMD,
      INSTANCE_CIMD,
      REDIRECT,
    );
    expect(verifyPkceS256(VERIFIER, CHALLENGE)).toBe(true);
    expect(prismaMock.mcpOAuthAuthorizationCode.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { used_at: expect.any(Date) },
      }),
    );
  });
});
