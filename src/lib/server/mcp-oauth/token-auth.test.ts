import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolveClientJwksUriMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/server/mcp-oauth/clients', () => ({
  resolveClientJwksUri: resolveClientJwksUriMock,
}));

import { resolveAuthorizationCodeAuth } from '@/lib/server/mcp-oauth/token-auth';

const INSTANCE_CIMD = 'https://chatgpt.com/oauth/fixture-client/client.json';
const TOKEN_ENDPOINT = 'https://micasa.example/token';
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const BAD_VERIFIER =
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

const privateKeyJwtClient = {
  client_id: INSTANCE_CIMD,
  client_name: 'ChatGPT',
  redirect_uris: ['https://chatgpt.com/connector/oauth/fixture-client'],
  grant_types: ['authorization_code'],
  response_types: ['code'],
  token_endpoint_auth_method: 'private_key_jwt',
  client_uri: null,
  logo_uri: null,
  client_secret_hash: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXTAUTH_URL', 'https://micasa.example');
  resolveClientJwksUriMock.mockResolvedValue('https://chatgpt.com/oauth/jwks.json');
});

describe('resolveAuthorizationCodeAuth', () => {
  it('accepts PKCE code_verifier for public clients', async () => {
    const result = await resolveAuthorizationCodeAuth({
      client: { ...privateKeyJwtClient, token_endpoint_auth_method: 'none' },
      codeVerifier: VERIFIER,
      request: new Request(TOKEN_ENDPOINT),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.codeVerifier).toBe(VERIFIER);
      expect(result.clientAuthenticatedViaPrivateKeyJwt).toBe(false);
    }
  });

  it('accepts private_key_jwt client_assertion without code_verifier', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    const jwks = {
      keys: [{ ...jwk, kid: 'fixture-kid', use: 'sig', alg: 'RS256' }],
    };
    const clientAssertion = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'fixture-kid' })
      .setIssuer(INSTANCE_CIMD)
      .setSubject(INSTANCE_CIMD)
      .setAudience('https://micasa.example/token')
      .setIssuedAt()
      .setExpirationTime('5m')
      .setJti('fixture-jti-002')
      .sign(privateKey);

    const result = await resolveAuthorizationCodeAuth({
      client: privateKeyJwtClient,
      clientAssertion,
      clientAssertionType: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      codeClientId: INSTANCE_CIMD,
      request: new Request(TOKEN_ENDPOINT),
      jwksJson: jwks,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.clientAuthenticatedViaPrivateKeyJwt).toBe(true);
      expect(result.codeVerifier).toBeUndefined();
    }
  });

  it('accepts JWT when both verifier and assertion are present but verifier is wrong', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    const jwks = {
      keys: [{ ...jwk, kid: 'fixture-kid', use: 'sig', alg: 'RS256' }],
    };
    const clientAssertion = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'fixture-kid' })
      .setIssuer(INSTANCE_CIMD)
      .setSubject(INSTANCE_CIMD)
      .setAudience('https://micasa.example/token')
      .setIssuedAt()
      .setExpirationTime('5m')
      .setJti('fixture-jti-003')
      .sign(privateKey);

    const result = await resolveAuthorizationCodeAuth({
      client: privateKeyJwtClient,
      codeVerifier: BAD_VERIFIER,
      clientAssertion,
      clientAssertionType: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      request: new Request(TOKEN_ENDPOINT),
      jwksJson: jwks,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.clientAuthenticatedViaPrivateKeyJwt).toBe(true);
      expect(result.codeVerifier).toBe(BAD_VERIFIER);
    }
  });

  it('rejects when neither verifier nor assertion is present', async () => {
    const result = await resolveAuthorizationCodeAuth({
      client: privateKeyJwtClient,
      request: new Request(TOKEN_ENDPOINT),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('invalid_request');
    }
  });
});
