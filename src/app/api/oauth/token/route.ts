import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  assertRedirectUriAllowed,
  resolveOAuthClient,
  verifyClientSecret,
} from '@/lib/server/mcp-oauth/clients';
import { getMcpResourceUrl } from '@/lib/server/mcp-oauth/config';
import {
  exchangeAuthorizationCode,
  refreshOAuthGrant,
} from '@/lib/server/mcp-oauth/grants';
import {
  oauthErrorResponse,
  oauthJsonResponse,
  oauthOptionsResponse,
} from '@/lib/server/mcp-oauth/cors';

const parseFormBody = async (request: NextRequest) => {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return request.json() as Promise<Record<string, string>>;
  }
  const form = await request.formData();
  return Object.fromEntries(form.entries()) as Record<string, string>;
};

const tokenRequestSchema = z.discriminatedUnion('grant_type', [
  z.object({
    grant_type: z.literal('authorization_code'),
    code: z.string().min(1),
    redirect_uri: z.string().url(),
    client_id: z.string().min(1),
    client_secret: z.string().optional(),
    code_verifier: z.string().min(43).max(128),
    resource: z.string().url().optional(),
  }),
  z.object({
    grant_type: z.literal('refresh_token'),
    refresh_token: z.string().min(1),
    client_id: z.string().min(1),
    client_secret: z.string().optional(),
    resource: z.string().url().optional(),
  }),
]);

export function OPTIONS() {
  return oauthOptionsResponse();
}

export async function POST(request: NextRequest) {
  try {
    const raw = await parseFormBody(request);
    const input = tokenRequestSchema.parse(raw);
    const client = await resolveOAuthClient(input.client_id);
    if (!client) {
      return oauthErrorResponse('invalid_client', undefined, 401);
    }
    if (!verifyClientSecret(client, input.client_secret)) {
      return oauthErrorResponse('invalid_client', undefined, 401);
    }

    const resource = input.resource ?? getMcpResourceUrl(request);

    if (input.grant_type === 'authorization_code') {
      try {
        assertRedirectUriAllowed(client, input.redirect_uri);
      } catch {
        return oauthErrorResponse('invalid_grant', 'redirect_uri no autorizado');
      }

      const tokenResponse = await exchangeAuthorizationCode({
        code: input.code,
        clientId: input.client_id,
        redirectUri: input.redirect_uri,
        codeVerifier: input.code_verifier,
        resource,
      });
      return oauthJsonResponse(tokenResponse);
    }

    const tokenResponse = await refreshOAuthGrant({
      refreshToken: input.refresh_token,
      clientId: input.client_id,
      resource,
    });
    return oauthJsonResponse(tokenResponse);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return oauthErrorResponse('invalid_request', error.message);
    }
    if (error instanceof Error && error.message === 'invalid_grant') {
      return oauthErrorResponse('invalid_grant');
    }
    console.error('OAuth token error:', error);
    return oauthErrorResponse('server_error', undefined, 500);
  }
}
