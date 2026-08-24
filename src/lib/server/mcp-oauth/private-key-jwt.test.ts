import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { describe, expect, it, vi } from 'vitest';
import {
  CLIENT_ASSERTION_JWT_BEARER,
  verifyPrivateKeyJwtAssertion,
} from '@/lib/server/mcp-oauth/private-key-jwt';

const INSTANCE_CIMD = 'https://chatgpt.com/oauth/fixture-client/client.json';
const STABLE_CIMD = 'https://chatgpt.com/oauth/client.json';
const ISSUER = 'https://micasa.example';
const JWKS_URI = 'https://chatgpt.com/oauth/jwks.json';

const buildFixtureAssertion = async (audience: string, issuer = INSTANCE_CIMD) => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  const jwks = {
    keys: [{ ...jwk, kid: 'fixture-kid', use: 'sig', alg: 'RS256' }],
  };

  const clientAssertion = await new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: 'fixture-kid' })
    .setIssuer(issuer)
    .setSubject(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime('5m')
    .setJti('fixture-jti-001')
    .sign(privateKey);

  return { clientAssertion, jwks };
};

describe('verifyPrivateKeyJwtAssertion', () => {
  it('accepts aud=/api/oauth/token', async () => {
    const { clientAssertion, jwks } = await buildFixtureAssertion(
      `${ISSUER}/api/oauth/token`,
    );

    const valid = await verifyPrivateKeyJwtAssertion({
      clientAssertion,
      clientAssertionType: CLIENT_ASSERTION_JWT_BEARER,
      requestClientId: INSTANCE_CIMD,
      request: new Request(`${ISSUER}/api/oauth/token`),
      jwksUri: JWKS_URI,
      jwksJson: jwks,
    });

    expect(valid).toBe(true);
  });

  it('accepts aud=issuer origin', async () => {
    const { clientAssertion, jwks } = await buildFixtureAssertion(ISSUER);

    const valid = await verifyPrivateKeyJwtAssertion({
      clientAssertion,
      clientAssertionType: CLIENT_ASSERTION_JWT_BEARER,
      requestClientId: INSTANCE_CIMD,
      request: new Request(`${ISSUER}/token`),
      jwksUri: JWKS_URI,
      jwksJson: jwks,
    });

    expect(valid).toBe(true);
  });

  it('accepts aud={issuer}/token (FastMCP default)', async () => {
    const { clientAssertion, jwks } = await buildFixtureAssertion(`${ISSUER}/token`);

    const valid = await verifyPrivateKeyJwtAssertion({
      clientAssertion,
      clientAssertionType: CLIENT_ASSERTION_JWT_BEARER,
      requestClientId: INSTANCE_CIMD,
      request: new Request(`${ISSUER}/token`),
      jwksUri: JWKS_URI,
      jwksJson: jwks,
    });

    expect(valid).toBe(true);
  });

  it('accepts stable CIMD iss/sub when token client is instance CIMD', async () => {
    const { clientAssertion, jwks } = await buildFixtureAssertion(
      `${ISSUER}/token`,
      STABLE_CIMD,
    );

    const valid = await verifyPrivateKeyJwtAssertion({
      clientAssertion,
      clientAssertionType: CLIENT_ASSERTION_JWT_BEARER,
      requestClientId: INSTANCE_CIMD,
      codeClientId: INSTANCE_CIMD,
      request: new Request(`${ISSUER}/token`),
      jwksUri: JWKS_URI,
      jwksJson: jwks,
    });

    expect(valid).toBe(true);
  });

  it('rejects assertion when aud is not in the accepted set', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { clientAssertion, jwks } = await buildFixtureAssertion('https://evil.example/nope');

    const valid = await verifyPrivateKeyJwtAssertion({
      clientAssertion,
      clientAssertionType: CLIENT_ASSERTION_JWT_BEARER,
      requestClientId: INSTANCE_CIMD,
      request: new Request(`${ISSUER}/token`),
      jwksUri: JWKS_URI,
      jwksJson: jwks,
    });

    expect(valid).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
