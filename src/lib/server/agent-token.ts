import crypto from 'node:crypto';
import { compare } from 'bcryptjs';

export const AGENT_TOKEN_PREFIX = 'micasa_';

/** Chars of the token stored in plaintext for O(1) lookup (includes "micasa_"). */
export const AGENT_TOKEN_LOOKUP_LENGTH = 15;

const SHA256_HASH_PREFIX = 'sha256:';

export type GeneratedAgentToken = {
  /** Plaintext token — show it once, never store it. */
  token: string;
  /** First chars stored in plaintext for O(1) lookup and display. */
  keyPrefix: string;
};

export function generateAgentToken(): GeneratedAgentToken {
  const token = `${AGENT_TOKEN_PREFIX}${crypto.randomBytes(32).toString('base64url')}`;
  return { token, keyPrefix: token.slice(0, AGENT_TOKEN_LOOKUP_LENGTH) };
}

/**
 * SHA-256, not bcrypt: agent tokens carry 256 bits of entropy, so a fast hash
 * is as safe as a slow KDF and verification stays sub-millisecond on every
 * MCP tool call (bcrypt cost ~100ms per call on Vercel).
 */
export function hashAgentToken(token: string): string {
  return `${SHA256_HASH_PREFIX}${crypto.createHash('sha256').update(token).digest('hex')}`;
}

/** Keys minted before the SHA-256 switch stored bcrypt hashes (`$2…`). */
export function isLegacyAgentTokenHash(storedHash: string): boolean {
  return !storedHash.startsWith(SHA256_HASH_PREFIX);
}

/**
 * Verifies a plaintext token against a stored hash. Supports the current
 * `sha256:<hex>` format (timing-safe) and legacy bcrypt hashes so tokens
 * minted before the switch keep working.
 */
export async function verifyAgentToken(
  token: string,
  storedHash: string,
): Promise<boolean> {
  if (isLegacyAgentTokenHash(storedHash)) {
    return compare(token, storedHash);
  }
  const expected = Buffer.from(storedHash.slice(SHA256_HASH_PREFIX.length), 'hex');
  const actual = crypto.createHash('sha256').update(token).digest();
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}
