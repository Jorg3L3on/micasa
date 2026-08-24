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

vi.mock('@/lib/prisma', () => ({
  default: prismaMock,
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
import { hashOAuthSecret } from '@/lib/server/mcp-oauth/tokens';

const CODE = 'micasa_code_fixture-authorization-code';
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
const CLIENT_ID = 'https://chatgpt.com/oauth/client.json';
const REDIRECT = 'https://chatgpt.com/connector/oauth/chatgpt';

const baseCodeRow = {
  id: 1,
  code_hash: hashOAuthSecret(CODE),
  client_id: CLIENT_ID,
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
});

describe('issueGrant', () => {
  it('returns lowercase token_type bearer', async () => {
    const response = await issueGrant({
      userId: 1,
      clientId: CLIENT_ID,
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
      clientId: CLIENT_ID,
      redirectUri: REDIRECT,
      codeVerifier: VERIFIER,
      resource: 'https://micasa.example/mcp',
    });

    expect(response.token_type).toBe('bearer');
    expect(prismaMock.mcpOAuthAuthorizationCode.update).toHaveBeenCalled();
    expect(prismaMock.mcpOAuthGrant.create).toHaveBeenCalled();
  });

  it('rejects already-used authorization codes with invalid_grant', async () => {
    prismaMock.mcpOAuthAuthorizationCode.findUnique.mockResolvedValue({
      ...baseCodeRow,
      used_at: new Date(),
    });

    await expect(
      exchangeAuthorizationCode({
        code: CODE,
        clientId: CLIENT_ID,
        redirectUri: REDIRECT,
        codeVerifier: VERIFIER,
        resource: 'https://micasa.example/api/mcp',
      }),
    ).rejects.toThrow('invalid_grant');
  });

  it('rejects unrelated resource URLs with invalid_grant', async () => {
    await expect(
      exchangeAuthorizationCode({
        code: CODE,
        clientId: CLIENT_ID,
        redirectUri: REDIRECT,
        codeVerifier: VERIFIER,
        resource: 'https://other.example/api/mcp',
      }),
    ).rejects.toThrow('invalid_grant');
  });
});
