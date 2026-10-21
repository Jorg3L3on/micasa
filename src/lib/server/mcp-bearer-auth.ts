import type { AuthInfo } from '@modelcontextprotocol/server';
import {
  resolveAgentIdentity,
  type AgentIdentity,
} from '@/lib/server/resolve-agent-context';

/** Key under `AuthInfo.extra` where the resolved credential travels to tools. */
export const MCP_AGENT_IDENTITY_KEY = 'micasa_agent';

/**
 * Bearer verifier for MCP transport auth (`withMcpAuth`). Accepts ApiKey tokens
 * (`micasa_…`) and OAuth access tokens (`micasa_oauth_…`). The resolved
 * identity rides on `extra` so tools reach it via `ctx.http.authInfo` instead
 * of resolving the token a second time.
 */
export async function verifyMcpBearerToken(
  _request: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  if (!bearerToken?.trim()) return undefined;

  try {
    const agent = await resolveAgentIdentity(bearerToken);
    return {
      token: bearerToken,
      clientId:
        agent.authSource === 'oauth_grant'
          ? `oauth-grant:${agent.oauthGrantId}`
          : `api-key:${agent.apiKeyId}`,
      scopes: agent.scopes,
      extra: { [MCP_AGENT_IDENTITY_KEY]: agent satisfies AgentIdentity },
    };
  } catch {
    return undefined;
  }
}
