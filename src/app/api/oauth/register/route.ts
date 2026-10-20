import { NextRequest } from 'next/server';
import { z } from 'zod';
import { registerDynamicOAuthClient } from '@/lib/server/mcp-oauth/clients';
import {
  oauthErrorResponse,
  oauthJsonResponse,
  oauthOptionsResponse,
  oauthRateLimitResponse,
} from '@/lib/server/mcp-oauth/cors';
import {
  isAllowedRegistrationRedirectUri,
  isHttpsUri,
} from '@/lib/server/mcp-oauth/registration-uris';
import { checkRateLimit } from '@/lib/server/rate-limit';

const redirectUriSchema = z
  .string()
  .max(2048)
  .refine(isAllowedRegistrationRedirectUri, {
    message: 'redirect_uri debe ser https, http en loopback o un esquema privado reverse-DNS',
  });

const httpsUriSchema = z
  .string()
  .max(2048)
  .refine(isHttpsUri, { message: 'Se requiere una URI https' });

const registrationSchema = z
  .object({
    client_name: z.string().min(1).max(120).optional(),
    redirect_uris: z.array(redirectUriSchema).min(1).max(20),
    grant_types: z.array(z.string()).optional(),
    response_types: z.array(z.string()).optional(),
    token_endpoint_auth_method: z.string().optional(),
    client_uri: httpsUriSchema.optional(),
    logo_uri: httpsUriSchema.optional(),
  })
  .passthrough();

export function OPTIONS() {
  return oauthOptionsResponse();
}

export async function POST(request: NextRequest) {
  const rateLimit = await checkRateLimit(request, 'oauth:register');
  if (rateLimit.limited) {
    return oauthRateLimitResponse(rateLimit.retryAfterSeconds);
  }

  try {
    const body = await request.json();
    const input = registrationSchema.parse(body);
    const { client, clientSecret } = await registerDynamicOAuthClient(input);

    return oauthJsonResponse(
      {
        client_id: client.client_id,
        client_name: client.client_name,
        redirect_uris: client.redirect_uris,
        grant_types: client.grant_types,
        response_types: client.response_types,
        token_endpoint_auth_method: client.token_endpoint_auth_method,
        ...(client.client_uri ? { client_uri: client.client_uri } : {}),
        ...(client.logo_uri ? { logo_uri: client.logo_uri } : {}),
        ...(clientSecret ? { client_secret: clientSecret } : {}),
        client_id_issued_at: Math.floor(Date.now() / 1000),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      // RFC 7591 §3.2.2: bad redirect URIs get their own error code.
      const badRedirect = error.issues.some(
        (issue) => issue.path[0] === 'redirect_uris' && issue.path.length > 1,
      );
      return oauthErrorResponse(
        badRedirect ? 'invalid_redirect_uri' : 'invalid_client_metadata',
        error.message,
      );
    }
    if (error instanceof SyntaxError) {
      return oauthErrorResponse('invalid_client_metadata', 'JSON inválido');
    }
    console.error('OAuth DCR error:', error);
    return oauthErrorResponse('server_error', 'No se pudo registrar el cliente', 500);
  }
}
