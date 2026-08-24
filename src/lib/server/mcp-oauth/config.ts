import type { AgentScope } from '@/lib/server/resolve-agent-context';

export const MCP_OAUTH_SCOPES: AgentScope[] = ['read', 'write'];

export const MCP_RESOURCE_PATH = '/api/mcp';

export const OAUTH_ACCESS_TOKEN_PREFIX = 'micasa_oauth_';

export const OAUTH_REFRESH_TOKEN_PREFIX = 'micasa_refresh_';

export const OAUTH_CODE_TTL_MS = 10 * 60 * 1000;

export const OAUTH_ACCESS_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export const OAUTH_REFRESH_TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export const OAUTH_TOKEN_LOOKUP_LENGTH = 20;

const trimTrailingSlash = (value: string): string =>
  value.endsWith('/') ? value.slice(0, -1) : value;

/** Canonical issuer / base URL for OAuth metadata (NEXTAUTH_URL in prod). */
export const getOAuthIssuer = (request?: Request): string => {
  const fromEnv = process.env.NEXTAUTH_URL?.trim();
  if (fromEnv) return trimTrailingSlash(fromEnv);

  if (request) {
    const host =
      request.headers.get('x-forwarded-host') ?? request.headers.get('host');
    const proto =
      request.headers.get('x-forwarded-proto') ??
      (host?.includes('localhost') ? 'http' : 'https');
    if (host) return `${proto}://${host}`;
  }

  return 'http://localhost:3000';
};

export const getMcpResourceUrl = (request?: Request): string =>
  `${getOAuthIssuer(request)}${MCP_RESOURCE_PATH}`;

export const oauthPath = (request: Request | undefined, path: string): string =>
  `${getOAuthIssuer(request)}${path}`;

export const parseScopeParam = (scope: string | null | undefined): AgentScope[] => {
  if (!scope?.trim()) return ['read'];
  const parsed = scope
    .split(/[\s+]+/)
    .filter((value): value is AgentScope => value === 'read' || value === 'write');
  if (!parsed.includes('read')) parsed.unshift('read');
  return [...new Set(parsed)];
};

export const scopesToParam = (scopes: AgentScope[]): string =>
  [...new Set(scopes)].join(' ');
