import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { registerMcpTools } from '@/lib/mcp/register-tools';
import { verifyMcpBearerToken } from '@/lib/server/mcp-bearer-auth';
import { getOAuthIssuer } from '@/lib/server/mcp-oauth/config';

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
    serverInfo: { name: 'micasa', version: '3.0.0' },
    capabilities: {
      tools: {},
    },
    instructions:
      'Conector de MiCasa (finanzas del hogar). Llama list_houses primero: cada contexto que devuelve (ownerType "user" = finanzas personales, "house" = casa compartida, con su ownerId) se pasa como owner_type/owner_id a las demás herramientas. Billeteras y categorías se indican por id o por nombre exacto (sin distinguir mayúsculas). La planeación va por quincenas: FIRST = del último día del mes anterior al 14; SECOND = del 15 al penúltimo día. Montos en MXN; fechas YYYY-MM-DD en hora de Ciudad de México. Los errores traen code (NOT_FOUND, AMBIGUOUS_REF, VALIDATION, FORBIDDEN, CONFIRM_REQUIRED, RATE_LIMITED, INTERNAL) y a veces hint o candidates.',
  },
);

/**
 * `resourceUrl` pins the 401 challenge's resource_metadata to the configured
 * issuer (NEXTAUTH_URL) instead of the Host / X-Forwarded-Host headers.
 */
const authenticatedHandler = (request: Request): Promise<Response> =>
  withMcpAuth(mcpHandler, verifyMcpBearerToken, {
    required: true,
    resourceMetadataPath: '/.well-known/oauth-protected-resource',
    resourceUrl: getOAuthIssuer(request),
  })(request);

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
