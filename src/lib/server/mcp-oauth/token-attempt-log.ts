import prisma from '@/lib/prisma';
import type { InvalidGrantReason } from '@/lib/server/mcp-oauth/invalid-grant';
import {
  sanitizeTokenAttemptBody,
  type SanitizedTokenAttemptBody,
} from '@/lib/server/mcp-oauth/token-attempt-sanitize';

export const TOKEN_ENDPOINT_PATHS = new Set([
  '/api/oauth/token',
  '/token',
  '/oauth/token',
]);

export const getTokenAttemptPath = (request: Request): string => {
  try {
    const path = new URL(request.url).pathname;
    return TOKEN_ENDPOINT_PATHS.has(path) ? path : path;
  } catch {
    return '/api/oauth/token';
  }
};

type TokenAttemptInput = {
  path: string;
  method: string;
  content_type?: string | null;
  body?: SanitizedTokenAttemptBody;
  error: string;
  http_status: number;
  invalid_grant_reason?: InvalidGrantReason | null;
};

const logFailure = (phase: string, error: unknown): void => {
  console.error(
    JSON.stringify({
      severity: 'error',
      event: 'oauth.token_attempt.log_failed',
      phase,
      message: error instanceof Error ? error.message : String(error),
      at: new Date().toISOString(),
    }),
  );
};

/**
 * One row per token POST, written once the outcome is known. OPTIONS / GET
 * and rate-limited requests are not recorded, so the table cannot be filled
 * from outside faster than the oauth:token policy allows.
 */
export const recordTokenAttempt = async (
  input: TokenAttemptInput,
): Promise<void> => {
  try {
    await prisma.mcpOAuthTokenAttempt.create({
      data: {
        path: input.path,
        method: input.method,
        content_type: input.content_type ?? null,
        grant_type: input.body?.grant_type ?? null,
        has_code: input.body?.has_code ?? false,
        has_verifier: input.body?.has_verifier ?? false,
        has_assertion: input.body?.has_assertion ?? false,
        client_id_kind: input.body?.client_id_kind ?? null,
        redirect_kind: input.body?.redirect_kind ?? null,
        resource_kind: input.body?.resource_kind ?? null,
        error: input.error,
        http_status: input.http_status,
        invalid_grant_reason: input.invalid_grant_reason ?? null,
      },
    });
  } catch (error) {
    logFailure('record', error);
  }
};

export const sanitizeTokenAttemptBodyFromRecord = (
  raw: Record<string, unknown>,
): SanitizedTokenAttemptBody => sanitizeTokenAttemptBody(raw);
