import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { registerMcpTools } from '@/lib/mcp/register-tools';
import { verifyMcpBearerToken } from '@/lib/server/mcp-bearer-auth';

/**
 * MCP connector endpoint (stateless Streamable HTTP). Clients: Grok Bot,
 * Cursor, Claude, ChatGPT (OAuth or developer mode) or any MCP client that
 * supports HTTP + Bearer auth.
 *
 * Transport-level auth (RFC 9728): unauthenticated requests receive HTTP 401
 * with `WWW-Authenticate` pointing at protected-resource metadata. Tool-level
 * auth still validates scopes per call.
 */
const mcpHandler = createMcpHandler(
  (server) => {
    registerMcpTools(server);
  },
  {
    serverInfo: { name: 'micasa', version: '1.3.7' },
    capabilities: {
      tools: { listChanged: true },
    },
    instructions:
      'Conector de MiCasa (finanzas del hogar). Llama list_houses primero para descubrir ownerType/ownerId; todas las demás herramientas los requieren. Los montos están en MXN.',
  },
);

const authenticatedHandler = withMcpAuth(mcpHandler, verifyMcpBearerToken, {
  required: true,
  resourceMetadataPath: '/.well-known/oauth-protected-resource',
});

/**
 * CORS for browser-based MCP clients (Claude web, MCP Inspector). Tokens are
 * per-user Bearer credentials, so a wildcard origin does not expose data:
 * without a valid token every request is rejected at the transport layer.
 */
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Authorization, Content-Type, Accept, mcp-protocol-version, mcp-session-id, last-event-id',
  'Access-Control-Expose-Headers':
    'mcp-session-id, mcp-protocol-version, WWW-Authenticate',
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

export const GET = withCors(authenticatedHandler);
export const POST = withCors(authenticatedHandler);

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
