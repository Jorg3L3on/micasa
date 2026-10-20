/**
 * End-to-end regression for the PKCE bypass found in the October 2026 MCP
 * audit: a valid private_key_jwt assertion must never replace the
 * code_verifier, and a foreign CIMD client must never redeem someone else's
 * code. Only Prisma, fetch and the attempt log are mocked; token-auth, grants
 * and clients run for real.
 */
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  mcpOAuthClient: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  mcpOAuthAuthorizationCode: {
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  mcpOAuthGrant: {
    create: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({ default: prismaMock }));

vi.mock('@/lib/server/agent-allowed-contexts', () => ({
  loadAuthorizationCodeContexts: vi.fn(async () => []),
  replaceOAuthGrantAllowedContexts: vi.fn(),
}));

vi.mock('@/lib/server/mcp-oauth/token-attempt-log', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/server/mcp-oauth/token-attempt-log')>();
  return {
    ...actual,
    recordTokenAttempt: vi.fn(),
  };
});

import { POST } from '@/app/api/oauth/token/route';
import { hashOAuthSecret } from '@/lib/server/mcp-oauth/tokens';
import { resetRateLimitStoreForTests } from '@/lib/server/rate-limit';

const ISSUER = 'https://micasa.example';
const TOKEN_ENDPOINT = `${ISSUER}/api/oauth/token`;
const CODE = 'micasa_code_fixture-intercepted-code';
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
const WRONG_VERIFIER =
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const VICTIM_CIMD = 'https://chatgpt.com/oauth/fixture-client/client.json';
const VICTIM_REDIRECT = 'https://chatgpt.com/connector/oauth/fixture-client';
const ATTACKER_CIMD = 'https://evil.example/oauth/client.json';
const ATTACKER_JWKS = 'https://evil.example/oauth/jwks.json';
const CHATGPT_JWKS = 'https://chatgpt.com/oauth/jwks.json';

const codeRow = {
  id: 7,
  code_hash: hashOAuthSecret(CODE),
  client_id: VICTIM_CIMD,
  user_id: 42,
  redirect_uri: VICTIM_REDIRECT,
  scopes: ['read', 'write'],
  code_challenge: CHALLENGE,
  code_challenge_method: 'S256',
  resource: `${ISSUER}/api/mcp`,
  expires_at: new Date(Date.now() + 60_000),
  used_at: null,
};

const clientRow = (clientId: string) => ({
  client_id: clientId,
  client_name: 'ChatGPT',
  redirect_uris: [VICTIM_REDIRECT],
  grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
  token_endpoint_auth_method: 'private_key_jwt',
  client_uri: null,
  logo_uri: null,
  client_secret_hash: null,
});

const cimdDocument = (clientId: string, jwksUri: string) => ({
  client_id: clientId,
  client_name: 'ChatGPT',
  redirect_uris: [VICTIM_REDIRECT],
  token_endpoint_auth_method: 'private_key_jwt',
  jwks_uri: jwksUri,
});

let jwks: { keys: JsonWebKey[] };
let privateKey: CryptoKey;

const signAssertion = (clientId: string, jti: string) =>
  new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: 'fixture-kid' })
    .setIssuer(clientId)
    .setSubject(clientId)
    .setAudience(TOKEN_ENDPOINT)
    .setIssuedAt()
    .setExpirationTime('5m')
    .setJti(jti)
    .sign(privateKey);

const tokenRequest = (fields: Record<string, string>) =>
  POST(
    new Request(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: CODE,
        redirect_uri: VICTIM_REDIRECT,
        client_assertion_type:
          'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        ...fields,
      }),
    }) as Parameters<typeof POST>[0],
  );

beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  privateKey = pair.privateKey as CryptoKey;
  const jwk = await exportJWK(pair.publicKey);
  jwks = { keys: [{ ...jwk, kid: 'fixture-kid', use: 'sig', alg: 'RS256' } as JsonWebKey] };
});

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimitStoreForTests();
  vi.stubEnv('NEXTAUTH_URL', ISSUER);

  // Both the victim and the attacker resolve to an existing client row.
  prismaMock.mcpOAuthClient.findUnique.mockImplementation(
    async ({ where }: { where: { client_id: string } }) => clientRow(where.client_id),
  );
  prismaMock.mcpOAuthAuthorizationCode.findUnique.mockResolvedValue(codeRow);
  prismaMock.mcpOAuthAuthorizationCode.update.mockResolvedValue({});
  prismaMock.mcpOAuthAuthorizationCode.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.mcpOAuthGrant.create.mockResolvedValue({ id: 1 });
  prismaMock.mcpOAuthGrant.updateMany.mockResolvedValue({ count: 0 });

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url === ATTACKER_CIMD) {
        return Response.json(cimdDocument(ATTACKER_CIMD, ATTACKER_JWKS));
      }
      if (url === VICTIM_CIMD) {
        return Response.json(cimdDocument(VICTIM_CIMD, CHATGPT_JWKS));
      }
      if (url === ATTACKER_JWKS || url === CHATGPT_JWKS) {
        return Response.json(jwks);
      }
      return new Response('not found', { status: 404 });
    }),
  );
});

describe('POST /api/oauth/token — PKCE cannot be bypassed', () => {
  it('rejects a valid client_assertion without code_verifier', async () => {
    const response = await tokenRequest({
      client_id: VICTIM_CIMD,
      client_assertion: await signAssertion(VICTIM_CIMD, 'jti-1'),
    });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('invalid_request');
    expect(prismaMock.mcpOAuthGrant.create).not.toHaveBeenCalled();
  });

  it('rejects a valid client_assertion with a wrong code_verifier → invalid_grant (pkce)', async () => {
    const response = await tokenRequest({
      client_id: VICTIM_CIMD,
      client_assertion: await signAssertion(VICTIM_CIMD, 'jti-2'),
      code_verifier: WRONG_VERIFIER,
    });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('invalid_grant');
    expect(prismaMock.mcpOAuthGrant.create).not.toHaveBeenCalled();
  });

  it('issues a grant for the same client_assertion with the correct code_verifier', async () => {
    const response = await tokenRequest({
      client_id: VICTIM_CIMD,
      client_assertion: await signAssertion(VICTIM_CIMD, 'jti-3'),
      code_verifier: VERIFIER,
    });

    expect(response.status).toBe(200);
    expect((await response.json()).token_type).toBe('bearer');
    expect(prismaMock.mcpOAuthGrant.create).toHaveBeenCalledTimes(1);
  });

  it('rejects an attacker CIMD that declares the victim redirect, signs a valid assertion and omits the verifier', async () => {
    const response = await tokenRequest({
      client_id: ATTACKER_CIMD,
      client_assertion: await signAssertion(ATTACKER_CIMD, 'jti-4'),
    });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('invalid_request');
    expect(prismaMock.mcpOAuthGrant.create).not.toHaveBeenCalled();
  });

  it('rejects the attacker CIMD with invalid_grant even when it guesses a verifier', async () => {
    const response = await tokenRequest({
      client_id: ATTACKER_CIMD,
      client_assertion: await signAssertion(ATTACKER_CIMD, 'jti-5'),
      code_verifier: VERIFIER,
    });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('invalid_grant');
    expect(prismaMock.mcpOAuthGrant.create).not.toHaveBeenCalled();
  });
});
