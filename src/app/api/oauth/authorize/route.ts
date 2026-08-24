import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import {
  assertRedirectUriAllowed,
  resolveOAuthClient,
} from '@/lib/server/mcp-oauth/clients';
import {
  getMcpResourceUrl,
} from '@/lib/server/mcp-oauth/config';
import { oauthErrorResponse } from '@/lib/server/mcp-oauth/cors';

const requiredParams = [
  'response_type',
  'client_id',
  'redirect_uri',
  'code_challenge',
  'code_challenge_method',
] as const;

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const missing = requiredParams.filter((param) => !url.searchParams.get(param));
  if (missing.length > 0) {
    return oauthErrorResponse(
      'invalid_request',
      `Faltan parámetros: ${missing.join(', ')}`,
    );
  }

  const responseType = url.searchParams.get('response_type');
  if (responseType !== 'code') {
    return oauthErrorResponse(
      'unsupported_response_type',
      'Solo se admite response_type=code',
    );
  }

  const codeChallengeMethod = url.searchParams.get('code_challenge_method');
  if (codeChallengeMethod !== 'S256') {
    return oauthErrorResponse(
      'invalid_request',
      'Solo se admite code_challenge_method=S256',
    );
  }

  const clientId = url.searchParams.get('client_id')!;
  const redirectUri = url.searchParams.get('redirect_uri')!;
  const client = await resolveOAuthClient(clientId);
  if (!client) {
    return oauthErrorResponse('invalid_client', 'Cliente OAuth desconocido');
  }

  try {
    assertRedirectUriAllowed(client, redirectUri);
  } catch {
    return oauthErrorResponse('invalid_request', 'redirect_uri no autorizado');
  }

  const session = await auth();
  if (!session?.user?.id) {
    const callback = `${url.pathname}${url.search}`;
    const loginUrl = new URL('/login', url.origin);
    loginUrl.searchParams.set('callbackUrl', callback);
    return Response.redirect(loginUrl);
  }

  const consentUrl = new URL('/oauth/consent', url.origin);
  for (const [key, value] of url.searchParams.entries()) {
    consentUrl.searchParams.set(key, value);
  }
  const resource = url.searchParams.get('resource') ?? getMcpResourceUrl(request);
  consentUrl.searchParams.set('resource', resource);

  return Response.redirect(consentUrl);
}
