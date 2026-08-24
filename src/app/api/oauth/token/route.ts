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
} from '@/lib/server/mcp-oauth/cors';
import {
  exchangeAuthorizationCode,
  peekAuthorizationCode,
  refreshOAuthGrant,
} from '@/lib/server/mcp-oauth/grants';
import {
  clientIdHostOnly,
  logOAuthTokenFailure,
} from '@/lib/server/mcp-oauth/oauth-token-log';
import {
  isValidPkceVerifier,
  resolveAuthorizationCodeAuth,
} from '@/lib/server/mcp-oauth/token-auth';

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

export async function POST(request: NextRequest) {
  let grantType = 'unknown';
  let clientId = '';
  let hasCode = false;
  let hasVerifier = false;
  let hasAssertion = false;

  try {
    const raw = await parseFormBody(request);
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

    const client = await resolveOAuthClient(input.client_id);
    if (!client) {
      logOAuthTokenFailure({
        grant_type: grantType,
        has_code: hasCode,
        has_verifier: hasVerifier,
        has_assertion: hasAssertion,
        client_id_host: clientIdHostOnly(clientId),
        error: 'invalid_client',
      });
      return oauthErrorResponse('invalid_client', undefined, 401);
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
      return oauthErrorResponse('invalid_client', undefined, 401);
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
        return oauthErrorResponse(authResult.error, authResult.description);
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
        return oauthErrorResponse('invalid_grant', 'redirect_uri no autorizado');
      }

      const tokenResponse = await exchangeAuthorizationCode({
        code: input.code,
        clientId: input.client_id,
        redirectUri: input.redirect_uri,
        codeVerifier: authResult.codeVerifier,
        clientAuthenticatedViaPrivateKeyJwt:
          authResult.clientAuthenticatedViaPrivateKeyJwt,
        resource: resourceParam,
      });
      return oauthJsonResponse(tokenResponse);
    }

    const tokenResponse = await refreshOAuthGrant({
      refreshToken: input.refresh_token,
      clientId: input.client_id,
      resource: resourceParam,
    });
    return oauthJsonResponse(tokenResponse);
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
      return oauthErrorResponse('invalid_request', error.message);
    }
    if (error instanceof Error && error.message === 'invalid_grant') {
      logOAuthTokenFailure({
        grant_type: grantType,
        has_code: hasCode,
        has_verifier: hasVerifier,
        has_assertion: hasAssertion,
        client_id_host: clientIdHostOnly(clientId),
        error: 'invalid_grant',
      });
      return oauthErrorResponse('invalid_grant');
    }
    console.error('OAuth token error:', error);
    return oauthErrorResponse('server_error', undefined, 500);
  }
}
