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

export const OAUTH_TOKEN_ENDPOINT_AUTH_METHODS_SUPPORTED = [
  'none',
  'client_secret_post',
] as const;

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
    service_documentation: `${issuer}/docs/mcp-connector`,
  };
};

export const buildWwwAuthenticateChallenge = (request?: Request): string => {
  const issuer = getOAuthIssuer(request);
  const resourceMetadataUrl = `${issuer}/.well-known/oauth-protected-resource`;
  return `Bearer realm="mcp", resource_metadata="${resourceMetadataUrl}", scope="read"`;
};
