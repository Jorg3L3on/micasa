import type { ResolvedOAuthClient } from '@/lib/server/mcp-oauth/clients';
import { resolveClientJwksUri } from '@/lib/server/mcp-oauth/clients';
import {
  CLIENT_ASSERTION_JWT_BEARER,
  verifyPrivateKeyJwtAssertion,
} from '@/lib/server/mcp-oauth/private-key-jwt';

export const isValidPkceVerifier = (value: string | undefined): value is string =>
  typeof value === 'string' && value.length >= 43 && value.length <= 128;

export type AuthorizationCodeAuthResult =
  | {
      ok: true;
      codeVerifier?: string;
      clientAuthenticatedViaPrivateKeyJwt: boolean;
    }
  | {
      ok: false;
      error: 'invalid_request' | 'invalid_client';
      description: string;
    };

export const resolveAuthorizationCodeAuth = async (input: {
  client: ResolvedOAuthClient;
  codeVerifier?: string;
  clientAssertion?: string;
  clientAssertionType?: string;
  codeClientId?: string;
  request?: Request;
  fetchImpl?: typeof fetch;
  jwksJson?: { keys: JsonWebKey[] };
}): Promise<AuthorizationCodeAuthResult> => {
  const hasVerifier = isValidPkceVerifier(input.codeVerifier);
  const hasAssertion = Boolean(input.clientAssertion?.trim());
  const isPrivateKeyJwtClient =
    input.client.token_endpoint_auth_method === 'private_key_jwt';

  let jwtValid = false;
  if (hasAssertion && isPrivateKeyJwtClient) {
    const jwksUri = await resolveClientJwksUri(input.client.client_id);
    if (!jwksUri) {
      return {
        ok: false,
        error: 'invalid_client',
        description: 'CIMD sin jwks_uri',
      };
    }

    jwtValid = await verifyPrivateKeyJwtAssertion({
      clientAssertion: input.clientAssertion!,
      clientAssertionType: input.clientAssertionType ?? CLIENT_ASSERTION_JWT_BEARER,
      requestClientId: input.client.client_id,
      codeClientId: input.codeClientId,
      request: input.request,
      jwksUri,
      jwksJson: input.jwksJson,
      fetchImpl: input.fetchImpl,
    });
  }

  if (isPrivateKeyJwtClient) {
    if (!hasVerifier && !jwtValid) {
      return {
        ok: false,
        error: 'invalid_request',
        description:
          'Se requiere code_verifier (PKCE) o client_assertion válida (private_key_jwt)',
      };
    }

    return {
      ok: true,
      codeVerifier: hasVerifier ? input.codeVerifier : undefined,
      clientAuthenticatedViaPrivateKeyJwt: jwtValid,
    };
  }

  if (hasAssertion && !hasVerifier) {
    return {
      ok: false,
      error: 'invalid_request',
      description: 'client_assertion solo se admite para clientes private_key_jwt',
    };
  }

  if (!hasVerifier) {
    return {
      ok: false,
      error: 'invalid_request',
      description: 'code_verifier requerido para PKCE S256',
    };
  }

  return {
    ok: true,
    codeVerifier: input.codeVerifier,
    clientAuthenticatedViaPrivateKeyJwt: false,
  };
};
