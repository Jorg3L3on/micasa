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

type StartTokenAttemptInput = {
  path: string;
  method: string;
  content_type?: string | null;
  body?: SanitizedTokenAttemptBody;
};

type FinishTokenAttemptInput = {
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

export const startTokenAttempt = async (
  input: StartTokenAttemptInput,
): Promise<number | null> => {
  try {
    const row = await prisma.mcpOAuthTokenAttempt.create({
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
      },
      select: { id: true },
    });
    return row.id;
  } catch (error) {
    logFailure('start', error);
    return null;
  }
};

export const updateTokenAttemptBody = async (
  attemptId: number | null,
  body: SanitizedTokenAttemptBody,
): Promise<void> => {
  if (attemptId == null) return;
  try {
    await prisma.mcpOAuthTokenAttempt.update({
      where: { id: attemptId },
      data: {
        grant_type: body.grant_type,
        has_code: body.has_code,
        has_verifier: body.has_verifier,
        has_assertion: body.has_assertion,
        client_id_kind: body.client_id_kind,
        redirect_kind: body.redirect_kind,
        resource_kind: body.resource_kind,
      },
    });
  } catch (error) {
    logFailure('update_body', error);
  }
};

export const finishTokenAttempt = async (
  attemptId: number | null,
  input: FinishTokenAttemptInput,
): Promise<void> => {
  if (attemptId == null) return;
  try {
    await prisma.mcpOAuthTokenAttempt.update({
      where: { id: attemptId },
      data: {
        error: input.error,
        http_status: input.http_status,
        invalid_grant_reason: input.invalid_grant_reason ?? null,
      },
    });
  } catch (error) {
    logFailure('finish', error);
  }
};

export const logTokenPreflightAttempt = async (request: Request): Promise<void> => {
  try {
    await prisma.mcpOAuthTokenAttempt.create({
      data: {
        path: getTokenAttemptPath(request),
        method: 'OPTIONS',
        error: 'preflight',
        http_status: 204,
      },
    });
  } catch (error) {
    logFailure('preflight', error);
  }
};

export const logTokenGetAttempt = async (request: Request): Promise<void> => {
  try {
    await prisma.mcpOAuthTokenAttempt.create({
      data: {
        path: getTokenAttemptPath(request),
        method: 'GET',
        error: 'method_not_allowed',
        http_status: 405,
      },
    });
  } catch (error) {
    logFailure('get', error);
  }
};

export const sanitizeTokenAttemptBodyFromRecord = (
  raw: Record<string, unknown>,
): SanitizedTokenAttemptBody => sanitizeTokenAttemptBody(raw);
