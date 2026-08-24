import { createMcpHandler } from 'mcp-handler';
import { registerMcpTools } from '@/lib/mcp/register-tools';
import { buildWwwAuthenticateChallenge } from '@/lib/server/mcp-oauth/metadata';

/**
 * MCP connector endpoint (stateless Streamable HTTP). Clients: Grok Bot,
 * Cursor, Claude, ChatGPT (OAuth or developer mode) or any MCP client that
 * supports HTTP + Bearer auth.
 *
 * Auth: `micasa_…` agent tokens (Ajustes → Conexiones) or OAuth access tokens
 * (`micasa_oauth_…`) issued after user consent.
 */
const handler = createMcpHandler(
  (server) => {
    registerMcpTools(server);
  },
  {
    serverInfo: { name: 'micasa', version: '1.3.0' },
    capabilities: {
      tools: { listChanged: true },
    },
    instructions:
      'Conector de MiCasa (finanzas del hogar). Llama list_houses primero para descubrir ownerType/ownerId; todas las demás herramientas los requieren. Los montos están en MXN.',
  },
);

/**
 * CORS for browser-based MCP clients (Claude web, MCP Inspector). Tokens are
 * per-user Bearer credentials, so a wildcard origin does not expose data:
 * without a valid token every tool call fails.
 */
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Authorization, Content-Type, Accept, mcp-protocol-version, mcp-session-id, last-event-id',
  'Access-Control-Expose-Headers': 'mcp-session-id, mcp-protocol-version',
  'Access-Control-Max-Age': '86400',
};

const withCors = (base: (request: Request) => Promise<Response>) =>
  async (request: Request): Promise<Response> => {
    const response = await base(request);
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      response.headers.set(key, value);
    }
    return response;
  };

const withOAuthDiscovery = (
  base: (request: Request) => Promise<Response>,
) =>
  async (request: Request): Promise<Response> => {
    const response = await base(request);
    if (response.status === 401) {
      response.headers.set(
        'WWW-Authenticate',
        buildWwwAuthenticateChallenge(request),
      );
    }
    return response;
  };

export const GET = withCors(withOAuthDiscovery(handler));
export const POST = withCors(withOAuthDiscovery(handler));

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
