import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchClientIdMetadataDocumentMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/server/mcp-oauth/client-id-metadata', () => ({
  fetchClientIdMetadataDocument: fetchClientIdMetadataDocumentMock,
}));

import { resolveAuthorizationCodeAuth } from '@/lib/server/mcp-oauth/token-auth';

const CLIENT_ID = 'https://chatgpt.com/oauth/fixture-client/client.json';
const TOKEN_ENDPOINT = 'https://micasa.example/api/oauth/token';
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';

const privateKeyJwtClient = {
  client_id: CLIENT_ID,
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
});

describe('resolveAuthorizationCodeAuth', () => {
  it('accepts PKCE code_verifier for public clients', async () => {
    const result = await resolveAuthorizationCodeAuth({
      client: { ...privateKeyJwtClient, token_endpoint_auth_method: 'none' },
      codeVerifier: VERIFIER,
      tokenEndpoint: TOKEN_ENDPOINT,
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
      .setIssuer(CLIENT_ID)
      .setSubject(CLIENT_ID)
      .setAudience(TOKEN_ENDPOINT)
      .setIssuedAt()
      .setExpirationTime('5m')
      .setJti('fixture-jti-002')
      .sign(privateKey);

    fetchClientIdMetadataDocumentMock.mockResolvedValue({
      client_id: CLIENT_ID,
      client_name: 'ChatGPT',
      redirect_uris: privateKeyJwtClient.redirect_uris,
      jwks_uri: 'https://chatgpt.com/oauth/jwks.json',
    });

    const result = await resolveAuthorizationCodeAuth({
      client: privateKeyJwtClient,
      clientAssertion,
      clientAssertionType: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      tokenEndpoint: TOKEN_ENDPOINT,
      jwksJson: jwks,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.clientAuthenticatedViaPrivateKeyJwt).toBe(true);
      expect(result.codeVerifier).toBeUndefined();
    }
  });

  it('rejects when neither verifier nor assertion is present', async () => {
    const result = await resolveAuthorizationCodeAuth({
      client: privateKeyJwtClient,
      tokenEndpoint: TOKEN_ENDPOINT,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('invalid_request');
    }
  });
});
