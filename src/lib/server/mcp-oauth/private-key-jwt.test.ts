import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import {
  CLIENT_ASSERTION_JWT_BEARER,
  verifyPrivateKeyJwtAssertion,
} from '@/lib/server/mcp-oauth/private-key-jwt';

const CLIENT_ID = 'https://chatgpt.com/oauth/fixture-client/client.json';
const TOKEN_ENDPOINT = 'https://micasa.example/api/oauth/token';
const JWKS_URI = 'https://chatgpt.com/oauth/jwks.json';

const buildFixtureAssertion = async () => {
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
    .setJti('fixture-jti-001')
    .sign(privateKey);

  return { clientAssertion, jwks };
};

describe('verifyPrivateKeyJwtAssertion', () => {
  it('accepts a valid RS256 client_assertion against fixture JWKS', async () => {
    const { clientAssertion, jwks } = await buildFixtureAssertion();

    const valid = await verifyPrivateKeyJwtAssertion({
      clientAssertion,
      clientAssertionType: CLIENT_ASSERTION_JWT_BEARER,
      clientId: CLIENT_ID,
      tokenEndpoint: TOKEN_ENDPOINT,
      jwksUri: JWKS_URI,
      jwksJson: jwks,
    });

    expect(valid).toBe(true);
  });

  it('rejects assertion when audience does not match token endpoint', async () => {
    const { clientAssertion, jwks } = await buildFixtureAssertion();

    const valid = await verifyPrivateKeyJwtAssertion({
      clientAssertion,
      clientAssertionType: CLIENT_ASSERTION_JWT_BEARER,
      clientId: CLIENT_ID,
      tokenEndpoint: 'https://micasa.example/other',
      jwksUri: JWKS_URI,
      jwksJson: jwks,
    });

    expect(valid).toBe(false);
  });
});
