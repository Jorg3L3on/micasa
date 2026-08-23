import crypto from 'node:crypto';
import { hash } from 'bcryptjs';
import {
  AGENT_TOKEN_LOOKUP_LENGTH,
  AGENT_TOKEN_PREFIX,
} from '@/lib/server/resolve-agent-context';

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

export function hashAgentToken(token: string): Promise<string> {
  return hash(token, 10);
}
