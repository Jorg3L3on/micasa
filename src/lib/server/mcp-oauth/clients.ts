import crypto from 'node:crypto';
import prisma from '@/lib/prisma';
import {
  fetchClientIdMetadataDocument,
  isClientIdMetadataUrl,
} from '@/lib/server/mcp-oauth/client-id-metadata';
import {
  isPublicTokenAuthMethod,
  validateRedirectUri,
} from '@/lib/server/mcp-oauth/cimd';
import { hashOAuthSecret, verifyOAuthSecret } from '@/lib/server/mcp-oauth/tokens';

export type ResolvedOAuthClient = {
  client_id: string;
  client_name: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: string;
  client_uri: string | null;
  logo_uri: string | null;
  client_secret_hash: string | null;
};

const toResolvedClient = (row: {
  client_id: string;
  client_name: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: string;
  client_uri: string | null;
  logo_uri: string | null;
  client_secret_hash: string | null;
}): ResolvedOAuthClient => ({
  client_id: row.client_id,
  client_name: row.client_name,
  redirect_uris: row.redirect_uris,
  grant_types: row.grant_types,
  response_types: row.response_types,
  token_endpoint_auth_method: row.token_endpoint_auth_method,
  client_uri: row.client_uri,
  logo_uri: row.logo_uri,
  client_secret_hash: row.client_secret_hash,
});

export const resolveOAuthClient = async (
  clientId: string,
): Promise<ResolvedOAuthClient | null> => {
  const existing = await prisma.mcpOAuthClient.findUnique({
    where: { client_id: clientId },
  });
  if (existing) return toResolvedClient(existing);

  if (!isClientIdMetadataUrl(clientId)) return null;

  const metadata = await fetchClientIdMetadataDocument(clientId);
  if (!metadata) return null;

  const authMethod = metadata.token_endpoint_auth_method ?? 'none';

  const created = await prisma.mcpOAuthClient.create({
    data: {
      client_id: clientId,
      client_name: metadata.client_name,
      redirect_uris: metadata.redirect_uris,
      grant_types: metadata.grant_types ?? ['authorization_code', 'refresh_token'],
      response_types: metadata.response_types ?? ['code'],
      token_endpoint_auth_method: authMethod,
      client_uri: metadata.client_uri ?? null,
      logo_uri: metadata.logo_uri ?? null,
    },
  });

  return toResolvedClient(created);
};

export type DynamicClientRegistrationInput = {
  client_name?: string;
  redirect_uris: string[];
  grant_types?: string[];
  response_types?: string[];
  token_endpoint_auth_method?: string;
  client_uri?: string;
  logo_uri?: string;
};

export const registerDynamicOAuthClient = async (
  input: DynamicClientRegistrationInput,
) => {
  const clientId = crypto.randomUUID();
  const authMethod = input.token_endpoint_auth_method ?? 'none';
  const clientSecret =
    authMethod === 'client_secret_post'
      ? crypto.randomBytes(32).toString('base64url')
      : null;

  const created = await prisma.mcpOAuthClient.create({
    data: {
      client_id: clientId,
      client_name: input.client_name?.trim() || 'MCP OAuth client',
      redirect_uris: input.redirect_uris,
      grant_types: input.grant_types ?? ['authorization_code', 'refresh_token'],
      response_types: input.response_types ?? ['code'],
      token_endpoint_auth_method: authMethod,
      client_uri: input.client_uri ?? null,
      logo_uri: input.logo_uri ?? null,
      client_secret_hash: clientSecret ? hashOAuthSecret(clientSecret) : null,
    },
  });

  return {
    client: toResolvedClient(created),
    clientSecret,
  };
};

export const assertRedirectUriAllowed = (
  client: ResolvedOAuthClient,
  redirectUri: string,
): void => {
  if (!validateRedirectUri(redirectUri, client.redirect_uris, client.client_id)) {
    throw new Error('redirect_uri no autorizado para este cliente');
  }
};

/**
 * Public / PKCE clients (none, private_key_jwt) do not use a shared secret at
 * the token endpoint. ChatGPT CIMD advertises private_key_jwt but exchanges
 * codes with PKCE only.
 */
export const verifyClientSecret = (
  client: ResolvedOAuthClient,
  clientSecret: string | null | undefined,
): boolean => {
  if (isPublicTokenAuthMethod(client.token_endpoint_auth_method)) {
    return true;
  }
  if (client.token_endpoint_auth_method === 'client_secret_post') {
    if (!client.client_secret_hash || !clientSecret) return false;
    return verifyOAuthSecret(clientSecret, client.client_secret_hash);
  }
  return true;
};
