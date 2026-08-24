import type { ResolvedOAuthClient } from '@/lib/server/mcp-oauth/clients';
import { fetchClientIdMetadataDocument } from '@/lib/server/mcp-oauth/client-id-metadata';
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
  tokenEndpoint: string;
  fetchImpl?: typeof fetch;
  jwksJson?: { keys: JsonWebKey[] };
}): Promise<AuthorizationCodeAuthResult> => {
  const hasVerifier = isValidPkceVerifier(input.codeVerifier);
  const hasAssertion = Boolean(input.clientAssertion?.trim());

  if (hasVerifier) {
    return {
      ok: true,
      codeVerifier: input.codeVerifier,
      clientAuthenticatedViaPrivateKeyJwt: false,
    };
  }

  if (!hasAssertion) {
    return {
      ok: false,
      error: 'invalid_request',
      description:
        'Se requiere code_verifier (PKCE) o client_assertion (private_key_jwt)',
    };
  }

  if (input.client.token_endpoint_auth_method !== 'private_key_jwt') {
    return {
      ok: false,
      error: 'invalid_request',
      description: 'client_assertion solo se admite para clientes private_key_jwt',
    };
  }

  const metadata = await fetchClientIdMetadataDocument(input.client.client_id);
  const jwksUri = metadata?.jwks_uri;
  if (!jwksUri) {
    return {
      ok: false,
      error: 'invalid_client',
      description: 'CIMD sin jwks_uri',
    };
  }

  const assertionValid = await verifyPrivateKeyJwtAssertion({
    clientAssertion: input.clientAssertion!,
    clientAssertionType: input.clientAssertionType ?? CLIENT_ASSERTION_JWT_BEARER,
    clientId: input.client.client_id,
    tokenEndpoint: input.tokenEndpoint,
    jwksUri,
    jwksJson: input.jwksJson,
    fetchImpl: input.fetchImpl,
  });

  if (!assertionValid) {
    return {
      ok: false,
      error: 'invalid_client',
      description: 'client_assertion inválida',
    };
  }

  return {
    ok: true,
    clientAuthenticatedViaPrivateKeyJwt: true,
  };
};
