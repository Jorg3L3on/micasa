import { describe, expect, it } from 'vitest';
import { hashSync } from 'bcryptjs';
import {
  AGENT_TOKEN_LOOKUP_LENGTH,
  AGENT_TOKEN_PREFIX,
  generateAgentToken,
  hashAgentToken,
  isLegacyAgentTokenHash,
  verifyAgentToken,
} from '@/lib/server/agent-token';

describe('generateAgentToken', () => {
  it('genera tokens con prefijo micasa_ y keyPrefix de lookup', () => {
    const { token, keyPrefix } = generateAgentToken();
    expect(token.startsWith(AGENT_TOKEN_PREFIX)).toBe(true);
    expect(keyPrefix).toBe(token.slice(0, AGENT_TOKEN_LOOKUP_LENGTH));
    expect(token.length).toBeGreaterThan(AGENT_TOKEN_LOOKUP_LENGTH);
  });

  it('genera tokens distintos en cada llamada', () => {
    expect(generateAgentToken().token).not.toBe(generateAgentToken().token);
  });
});

describe('hashAgentToken / verifyAgentToken', () => {
  it('hashea en formato sha256:<hex> y verifica el token correcto', async () => {
    const { token } = generateAgentToken();
    const hash = hashAgentToken(token);
    expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(isLegacyAgentTokenHash(hash)).toBe(false);
    await expect(verifyAgentToken(token, hash)).resolves.toBe(true);
  });

  it('rechaza un token incorrecto', async () => {
    const hash = hashAgentToken('micasa_token-correcto');
    await expect(verifyAgentToken('micasa_token-incorrecto', hash)).resolves.toBe(
      false,
    );
  });

  it('verifica hashes bcrypt legados', async () => {
    const token = 'micasa_token-legado-de-prueba';
    const legacyHash = hashSync(token, 4);
    expect(isLegacyAgentTokenHash(legacyHash)).toBe(true);
    await expect(verifyAgentToken(token, legacyHash)).resolves.toBe(true);
    await expect(verifyAgentToken('micasa_otro', legacyHash)).resolves.toBe(false);
  });
});
