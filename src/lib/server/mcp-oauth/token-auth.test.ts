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

const makeSigner = async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  const jwks = {
    keys: [{ ...jwk, kid: 'fixture-kid', use: 'sig', alg: 'RS256' }],
  };
  const sign = (jti: string) =>
    new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'fixture-kid' })
      .setIssuer(INSTANCE_CIMD)
      .setSubject(INSTANCE_CIMD)
      .setAudience(TOKEN_ENDPOINT)
      .setIssuedAt()
      .setExpirationTime('5m')
      .setJti(jti)
      .sign(privateKey);
  return { jwks, sign };
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

  it('rejects a valid private_key_jwt client_assertion without code_verifier', async () => {
    const { jwks, sign } = await makeSigner();
    const clientAssertion = await sign('fixture-jti-002');

    const result = await resolveAuthorizationCodeAuth({
      client: privateKeyJwtClient,
      clientAssertion,
      clientAssertionType: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      codeClientId: INSTANCE_CIMD,
      request: new Request(TOKEN_ENDPOINT),
      jwksJson: jwks,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('invalid_request');
      expect(result.description).toContain('code_verifier');
    }
  });

  it('accepts a valid client_assertion together with code_verifier and flags JWT auth', async () => {
    const { jwks, sign } = await makeSigner();
    const clientAssertion = await sign('fixture-jti-003');

    const result = await resolveAuthorizationCodeAuth({
      client: privateKeyJwtClient,
      codeVerifier: VERIFIER,
      clientAssertion,
      clientAssertionType: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      codeClientId: INSTANCE_CIMD,
      request: new Request(TOKEN_ENDPOINT),
      jwksJson: jwks,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.clientAuthenticatedViaPrivateKeyJwt).toBe(true);
      expect(result.codeVerifier).toBe(VERIFIER);
    }
  });

  it('passes the verifier through to the PKCE check even when the assertion is valid', async () => {
    // token-auth does not decide PKCE: a wrong verifier is rejected by
    // exchangeAuthorizationCode (invalid_grant pkce), never waived by the JWT.
    const { jwks, sign } = await makeSigner();
    const clientAssertion = await sign('fixture-jti-004');

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
      expect(result.codeVerifier).toBe(BAD_VERIFIER);
    }
  });

  it('rejects an invalid client_assertion with invalid_client even when a verifier is present', async () => {
    const { jwks } = await makeSigner();
    const other = await makeSigner();
    const clientAssertion = await other.sign('fixture-jti-005');

    const result = await resolveAuthorizationCodeAuth({
      client: privateKeyJwtClient,
      codeVerifier: VERIFIER,
      clientAssertion,
      clientAssertionType: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      request: new Request(TOKEN_ENDPOINT),
      jwksJson: jwks,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('invalid_client');
    }
  });

  it('accepts private_key_jwt clients that send only PKCE (no assertion)', async () => {
    const result = await resolveAuthorizationCodeAuth({
      client: privateKeyJwtClient,
      codeVerifier: VERIFIER,
      request: new Request(TOKEN_ENDPOINT),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.clientAuthenticatedViaPrivateKeyJwt).toBe(false);
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
