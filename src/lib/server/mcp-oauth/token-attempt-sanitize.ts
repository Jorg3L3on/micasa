import {
  CHATGPT_STABLE_CIMD_CLIENT_ID,
  isChatGptCimdClientId,
} from '@/lib/server/mcp-oauth/cimd';
import {
  MCP_RESOURCE_ALIAS_PATH,
  MCP_RESOURCE_PATH,
} from '@/lib/server/mcp-oauth/config';
import { isValidPkceVerifier } from '@/lib/server/mcp-oauth/token-auth';

export type ClientIdKind = 'cimd_instance' | 'cimd_stable' | 'dcr_uuid' | 'other';
export type RedirectKind = 'connector_instance' | 'platform_redirect' | 'other';
export type ResourceKind = 'api_mcp' | 'mcp_alias' | 'other';

const DCR_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PLATFORM_REDIRECT_PATTERN =
  /^https:\/\/(?:chatgpt\.com|chat\.openai\.com)\/connector_platform_oauth_redirect\/?$/;

const CONNECTOR_INSTANCE_REDIRECT_PATTERN =
  /^https:\/\/(?:chatgpt\.com|chat\.openai\.com)\/connector\/oauth\/[^/?#]+$/;

const normalizeResourcePath = (pathname: string): string => {
  const trimmed = pathname.replace(/\/$/, '');
  return trimmed.length > 0 ? trimmed : '/';
};

export const classifyClientIdKind = (
  clientId: string | undefined,
): ClientIdKind => {
  if (!clientId?.trim()) return 'other';
  const value = clientId.trim();
  if (value === CHATGPT_STABLE_CIMD_CLIENT_ID) return 'cimd_stable';
  if (isChatGptCimdClientId(value)) {
    try {
      const { pathname } = new URL(value);
      if (pathname === '/oauth/client.json') return 'cimd_stable';
      return 'cimd_instance';
    } catch {
      return 'other';
    }
  }
  if (DCR_UUID_PATTERN.test(value)) return 'dcr_uuid';
  return 'other';
};

export const classifyRedirectKind = (
  redirectUri: string | undefined,
): RedirectKind => {
  if (!redirectUri?.trim()) return 'other';
  const value = redirectUri.trim();
  if (PLATFORM_REDIRECT_PATTERN.test(value)) return 'platform_redirect';
  if (CONNECTOR_INSTANCE_REDIRECT_PATTERN.test(value)) return 'connector_instance';
  return 'other';
};

export const classifyResourceKind = (
  resource: string | undefined,
): ResourceKind => {
  if (!resource?.trim()) return 'other';
  try {
    const path = normalizeResourcePath(new URL(resource.trim()).pathname);
    if (path === MCP_RESOURCE_PATH || path.endsWith(MCP_RESOURCE_PATH)) {
      return 'api_mcp';
    }
    if (path === MCP_RESOURCE_ALIAS_PATH || path.endsWith(MCP_RESOURCE_ALIAS_PATH)) {
      return 'mcp_alias';
    }
  } catch {
    return 'other';
  }
  return 'other';
};

export type SanitizedTokenAttemptBody = {
  grant_type: string | null;
  has_code: boolean;
  has_verifier: boolean;
  has_assertion: boolean;
  client_id_kind: ClientIdKind;
  redirect_kind: RedirectKind;
  resource_kind: ResourceKind;
};

export const sanitizeTokenAttemptBody = (
  raw: Record<string, unknown>,
): SanitizedTokenAttemptBody => {
  const grantType =
    typeof raw.grant_type === 'string' && raw.grant_type.trim().length > 0
      ? raw.grant_type.trim()
      : null;
  const clientId =
    typeof raw.client_id === 'string' ? raw.client_id : undefined;
  const redirectUri =
    typeof raw.redirect_uri === 'string' ? raw.redirect_uri : undefined;
  const resource = typeof raw.resource === 'string' ? raw.resource : undefined;
  const code = typeof raw.code === 'string' ? raw.code : undefined;
  const codeVerifier =
    typeof raw.code_verifier === 'string' ? raw.code_verifier : undefined;
  const clientAssertion =
    typeof raw.client_assertion === 'string' ? raw.client_assertion : undefined;

  return {
    grant_type: grantType,
    has_code: Boolean(code?.trim()),
    has_verifier: isValidPkceVerifier(codeVerifier),
    has_assertion: Boolean(clientAssertion?.trim()),
    client_id_kind: classifyClientIdKind(clientId),
    redirect_kind: classifyRedirectKind(redirectUri),
    resource_kind: classifyResourceKind(resource),
  };
};
