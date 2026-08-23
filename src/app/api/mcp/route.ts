import { createMcpHandler } from 'mcp-handler';
import { registerMcpTools } from '@/lib/mcp/register-tools';

/**
 * MCP connector endpoint (stateless Streamable HTTP). Clients: Grok Bot,
 * Cursor, or any MCP client that supports HTTP + Bearer auth.
 *
 * Auth happens inside each tool via the `micasa_...` agent token
 * (`Authorization: Bearer`), minted with `scripts/mint-agent-token.mjs`.
 */
const handler = createMcpHandler(
  (server) => {
    registerMcpTools(server);
  },
  {
    serverInfo: { name: 'micasa', version: '1.0.0' },
    instructions:
      'Conector de MiCasa (finanzas del hogar). Llama list_houses primero para descubrir ownerType/ownerId; todas las demás herramientas los requieren. Los montos están en MXN.',
  },
);

export { handler as GET, handler as POST };
