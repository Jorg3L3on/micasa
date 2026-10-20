import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  assertRedirectUriAllowed,
  resolveOAuthClient,
  verifyClientSecret,
} from '@/lib/server/mcp-oauth/clients';
import {
  oauthErrorResponse,
  oauthJsonResponse,
  oauthOptionsResponse,
  oauthRateLimitResponse,
} from '@/lib/server/mcp-oauth/cors';
import {
  exchangeAuthorizationCode,
  peekAuthorizationCode,
  refreshOAuthGrant,
} from '@/lib/server/mcp-oauth/grants';
import {
  isOAuthInvalidGrantError,
  type InvalidGrantReason,
} from '@/lib/server/mcp-oauth/invalid-grant';
import {
  clientIdHostOnly,
  logOAuthTokenFailure,
} from '@/lib/server/mcp-oauth/oauth-token-log';
import {
  getTokenAttemptPath,
  recordTokenAttempt,
  sanitizeTokenAttemptBodyFromRecord,
} from '@/lib/server/mcp-oauth/token-attempt-log';
import {
  isValidPkceVerifier,
  resolveAuthorizationCodeAuth,
} from '@/lib/server/mcp-oauth/token-auth';
import { checkRateLimit } from '@/lib/server/rate-limit';

const parseFormBody = async (request: NextRequest) => {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return request.json() as Promise<Record<string, string>>;
  }
  const form = await request.formData();
  return Object.fromEntries(form.entries()) as Record<string, string>;
};

const authorizationCodeGrantSchema = z
  .object({
    grant_type: z.literal('authorization_code'),
    code: z.string().min(1),
    redirect_uri: z.string().url(),
    client_id: z.string().min(1),
    client_secret: z.string().optional(),
    code_verifier: z.string().optional(),
    resource: z.string().url().optional(),
    client_assertion: z.string().optional(),
    client_assertion_type: z.string().optional(),
  })
  .passthrough();

const refreshTokenGrantSchema = z
  .object({
    grant_type: z.literal('refresh_token'),
    refresh_token: z.string().min(1),
    client_id: z.string().min(1),
    client_secret: z.string().optional(),
    resource: z.string().url().optional(),
  })
  .passthrough();

const tokenRequestSchema = z.discriminatedUnion('grant_type', [
  authorizationCodeGrantSchema,
  refreshTokenGrantSchema,
]);

export function OPTIONS() {
  return oauthOptionsResponse();
}

export function GET() {
  return oauthErrorResponse('invalid_request', 'Use POST', 405);
}

export async function POST(request: NextRequest) {
  const rateLimit = await checkRateLimit(request, 'oauth:token');
  if (rateLimit.limited) {
    return oauthRateLimitResponse(rateLimit.retryAfterSeconds);
  }

  const path = getTokenAttemptPath(request);
  const contentType = request.headers.get('content-type');
  let sanitizedBody: ReturnType<typeof sanitizeTokenAttemptBodyFromRecord> | undefined;

  const returnWithAttempt = async (
    error: string,
    status: number,
    response: Response,
    invalidGrantReason?: InvalidGrantReason | null,
  ): Promise<Response> => {
    await recordTokenAttempt({
      path,
      method: 'POST',
      content_type: contentType,
      body: sanitizedBody,
      error,
      http_status: status,
      invalid_grant_reason: invalidGrantReason ?? null,
    });
    return response;
  };

  let grantType = 'unknown';
  let clientId = '';
  let hasCode = false;
  let hasVerifier = false;
  let hasAssertion = false;

  try {
    let raw: Record<string, string>;
    try {
      raw = await parseFormBody(request);
      sanitizedBody = sanitizeTokenAttemptBodyFromRecord(raw);
    } catch {
      return returnWithAttempt(
        'parse',
        400,
        oauthErrorResponse('invalid_request', 'Invalid request body'),
      );
    }

    const input = tokenRequestSchema.parse(raw);
    grantType = input.grant_type;
    clientId = input.client_id;
    hasCode = Boolean(input.grant_type === 'authorization_code' && input.code);
    hasVerifier = isValidPkceVerifier(
      input.grant_type === 'authorization_code' ? input.code_verifier : undefined,
    );
    hasAssertion = Boolean(
      input.grant_type === 'authorization_code' && input.client_assertion?.trim(),
    );
    const client = await resolveOAuthClient(input.client_id, request);
    if (!client) {
      logOAuthTokenFailure({
        grant_type: grantType,
        has_code: hasCode,
        has_verifier: hasVerifier,
        has_assertion: hasAssertion,
        client_id_host: clientIdHostOnly(clientId),
        error: 'invalid_client',
      });
      return returnWithAttempt(
        'invalid_client',
        401,
        oauthErrorResponse('invalid_client', undefined, 401),
      );
    }
    if (!verifyClientSecret(client, input.client_secret)) {
      logOAuthTokenFailure({
        grant_type: grantType,
        has_code: hasCode,
        has_verifier: hasVerifier,
        has_assertion: hasAssertion,
        client_id_host: clientIdHostOnly(clientId),
        error: 'invalid_client',
      });
      return returnWithAttempt(
        'invalid_client',
        401,
        oauthErrorResponse('invalid_client', undefined, 401),
      );
    }

    const resourceParam = input.resource?.trim() || null;

    if (input.grant_type === 'authorization_code') {
      const codePeek = await peekAuthorizationCode(input.code);
      const authResult = await resolveAuthorizationCodeAuth({
        client,
        codeVerifier: input.code_verifier,
        clientAssertion: input.client_assertion,
        clientAssertionType: input.client_assertion_type,
        codeClientId: codePeek?.client_id,
        request,
      });

      if (!authResult.ok) {
        logOAuthTokenFailure({
          grant_type: grantType,
          has_code: hasCode,
          has_verifier: hasVerifier,
          has_assertion: hasAssertion,
          client_id_host: clientIdHostOnly(clientId),
          error: authResult.error,
        });
        return returnWithAttempt(
          authResult.error,
          400,
          oauthErrorResponse(authResult.error, authResult.description),
        );
      }

      try {
        assertRedirectUriAllowed(client, input.redirect_uri);
      } catch {
        logOAuthTokenFailure({
          grant_type: grantType,
          has_code: hasCode,
          has_verifier: hasVerifier,
          has_assertion: hasAssertion,
          client_id_host: clientIdHostOnly(clientId),
          error: 'invalid_grant',
        });
        return returnWithAttempt(
          'invalid_grant',
          400,
          oauthErrorResponse('invalid_grant', 'redirect_uri no autorizado'),
          'redirect',
        );
      }

      const tokenResponse = await exchangeAuthorizationCode({
        code: input.code,
        clientId: input.client_id,
        redirectUri: input.redirect_uri,
        codeVerifier: authResult.codeVerifier,
        resource: resourceParam,
      });
      return returnWithAttempt(
        'ok',
        200,
        oauthJsonResponse(tokenResponse),
      );
    }

    const tokenResponse = await refreshOAuthGrant({
      refreshToken: input.refresh_token,
      clientId: input.client_id,
      resource: resourceParam,
    });
    return returnWithAttempt(
      'ok',
      200,
      oauthJsonResponse(tokenResponse),
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      logOAuthTokenFailure({
        grant_type: grantType,
        has_code: hasCode,
        has_verifier: hasVerifier,
        has_assertion: hasAssertion,
        client_id_host: clientIdHostOnly(clientId),
        error: 'invalid_request',
      });
      return returnWithAttempt(
        'invalid_request',
        400,
        oauthErrorResponse('invalid_request', error.message),
      );
    }
    if (isOAuthInvalidGrantError(error)) {
      logOAuthTokenFailure({
        grant_type: grantType,
        has_code: hasCode,
        has_verifier: hasVerifier,
        has_assertion: hasAssertion,
        client_id_host: clientIdHostOnly(clientId),
        error: 'invalid_grant',
      });
      return returnWithAttempt(
        'invalid_grant',
        400,
        oauthErrorResponse('invalid_grant'),
        error.reason,
      );
    }
    console.error('OAuth token error:', error);
    return returnWithAttempt(
      'server_error',
      500,
      oauthErrorResponse('server_error', undefined, 500),
    );
  }
}
