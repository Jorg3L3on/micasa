import type { AuthInfo } from '@modelcontextprotocol/server';
import {
  resolveAgentIdentity,
  type AgentIdentity,
} from '@/lib/server/resolve-agent-context';
import { AgentAuthError } from '@/lib/server/agent-auth-error';
import { recordAuthEvent } from '@/lib/server/audit/auth-events';

/** Key under `AuthInfo.extra` where the resolved credential travels to tools. */
export const MCP_AGENT_IDENTITY_KEY = 'micasa_agent';

/**
 * Bearer verifier for MCP transport auth (`withMcpAuth`). Accepts ApiKey tokens
 * (`micasa_…`) and OAuth access tokens (`micasa_oauth_…`). The resolved
 * identity rides on `extra` so tools reach it via `ctx.http.authInfo` instead
 * of resolving the token a second time.
 */
export async function verifyMcpBearerToken(
  request: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  if (!bearerToken?.trim()) return undefined;

  try {
    const agent = await resolveAgentIdentity(bearerToken, request);
    return {
      token: bearerToken,
      clientId:
        agent.authSource === 'oauth_grant'
          ? `oauth-grant:${agent.oauthGrantId}`
          : `api-key:${agent.apiKeyId}`,
      scopes: agent.scopes,
      extra: { [MCP_AGENT_IDENTITY_KEY]: agent satisfies AgentIdentity },
    };
  } catch (error) {
    if (error instanceof AgentAuthError) {
      await recordAuthEvent('AGENT_AUTH_FAILED', {
        userId: error.userId ?? null,
        apiKeyId: error.apiKeyId ?? null,
        source: 'AGENT',
        request,
        metadata: { reason: error.message, status: error.status },
      });
    }
    return undefined;
  }
}
