import { describe, expect, it } from 'vitest';
import {
  generateAuthorizationCode,
  generateOAuthAccessToken,
  hashOAuthSecret,
  verifyOAuthSecret,
  verifyPkceS256,
} from '@/lib/server/mcp-oauth/tokens';

describe('MCP OAuth tokens', () => {
  it('genera access tokens con prefijo micasa_oauth_', () => {
    const { token, tokenPrefix } = generateOAuthAccessToken();
    expect(token.startsWith('micasa_oauth_')).toBe(true);
    expect(tokenPrefix).toBe(token.slice(0, 20));
  });

  it('verifica hashes sha256 de secretos', () => {
    const { token, tokenHash } = generateAuthorizationCode();
    expect(verifyOAuthSecret(token, tokenHash)).toBe(true);
    expect(verifyOAuthSecret('micasa_code_wrong', tokenHash)).toBe(false);
    expect(hashOAuthSecret(token)).toBe(tokenHash);
  });

  it('valida PKCE S256', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
    expect(verifyPkceS256(verifier, challenge)).toBe(true);
    expect(verifyPkceS256('otro-verifier-invalido', challenge)).toBe(false);
  });
});
