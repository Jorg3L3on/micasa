import {
  getMcpResourceUrl,
  getOAuthIssuer,
  MCP_OAUTH_SCOPES,
  oauthPath,
} from '@/lib/server/mcp-oauth/config';

export const buildProtectedResourceMetadata = (request?: Request) => {
  const issuer = getOAuthIssuer(request);
  return {
    resource: getMcpResourceUrl(request),
    authorization_servers: [issuer],
    scopes_supported: MCP_OAUTH_SCOPES,
    bearer_methods_supported: ['header'],
    resource_documentation: `${issuer}/settings/connections`,
  };
};

/**
 * Exactly what the token endpoint accepts: `none` (PKCE) and
 * `client_secret_post` (confidential DCR clients, also with PKCE).
 * private_key_jwt is not offered: ChatGPT then uses none + PKCE (JOR-90) and
 * a client_assertion, if sent, is ignored (MIC-I5).
 */
export const OAUTH_TOKEN_ENDPOINT_AUTH_METHODS_SUPPORTED = [
  'none',
  'client_secret_post',
] as const;

/** Public connector docs (the app has no /docs route). */
export const MCP_SERVICE_DOCUMENTATION_URL =
  'https://github.com/Jorg3L3on/micasa/blob/main/docs/mcp-connector.md';

export const buildAuthorizationServerMetadata = (request?: Request) => {
  const issuer = getOAuthIssuer(request);
  return {
    issuer,
    authorization_endpoint: oauthPath(request, '/api/oauth/authorize'),
    token_endpoint: oauthPath(request, '/api/oauth/token'),
    registration_endpoint: oauthPath(request, '/api/oauth/register'),
    revocation_endpoint: oauthPath(request, '/api/oauth/revoke'),
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: [
      ...OAUTH_TOKEN_ENDPOINT_AUTH_METHODS_SUPPORTED,
    ],
    scopes_supported: MCP_OAUTH_SCOPES,
    client_id_metadata_document_supported: true,
    service_documentation: MCP_SERVICE_DOCUMENTATION_URL,
  };
};
