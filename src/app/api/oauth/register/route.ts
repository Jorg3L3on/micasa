import { NextRequest } from 'next/server';
import { z } from 'zod';
import { registerDynamicOAuthClient } from '@/lib/server/mcp-oauth/clients';
import {
  oauthErrorResponse,
  oauthJsonResponse,
  oauthOptionsResponse,
} from '@/lib/server/mcp-oauth/cors';

const registrationSchema = z
  .object({
    client_name: z.string().min(1).max(120).optional(),
    redirect_uris: z.array(z.string().url()).min(1).max(20),
    grant_types: z.array(z.string()).optional(),
    response_types: z.array(z.string()).optional(),
    token_endpoint_auth_method: z.string().optional(),
    client_uri: z.string().url().optional(),
    logo_uri: z.string().url().optional(),
  })
  .passthrough();

export function OPTIONS() {
  return oauthOptionsResponse();
}

export async function POST(request: NextRequest) {
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
      return oauthErrorResponse('invalid_client_metadata', error.message);
    }
    console.error('OAuth DCR error:', error);
    return oauthErrorResponse('server_error', 'No se pudo registrar el cliente', 500);
  }
}
