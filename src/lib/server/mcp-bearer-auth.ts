import type { AuthInfo } from '@modelcontextprotocol/server';
import { resolveAgentUser } from '@/lib/server/resolve-agent-context';

/**
 * Bearer verifier for MCP transport auth (`withMcpAuth`). Accepts ApiKey tokens
 * (`micasa_…`) and OAuth access tokens (`micasa_oauth_…`).
 */
export async function verifyMcpBearerToken(
  _request: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  if (!bearerToken?.trim()) return undefined;

  try {
    const agent = await resolveAgentUser(bearerToken);
    return {
      token: bearerToken,
      clientId:
        agent.authSource === 'oauth_grant'
          ? `oauth-grant:${agent.oauthGrantId}`
          : `api-key:${agent.apiKeyId}`,
      scopes: agent.scopes,
    };
  } catch {
    return undefined;
  }
}
