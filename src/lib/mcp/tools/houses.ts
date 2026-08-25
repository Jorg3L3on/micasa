import type { McpServer } from '@modelcontextprotocol/server';
import { listUserHouses } from '@/lib/house/house.service';
import {
  filterAllowedHouses,
  isPersonalContextAllowed,
} from '@/lib/server/agent-allowed-contexts';
import { runAgentUserTool, type McpToolContext } from '@/lib/mcp/tool-helpers';

export function registerHouseTools(server: McpServer) {
  server.registerTool(
    'list_houses',
    {
      title: 'Listar casas del usuario',
      description:
        'Punto de entrada: devuelve el userId del token y las casas donde es miembro. Llama esto primero para conocer los ownerType/ownerId que aceptan las demás herramientas.',
      annotations: { readOnlyHint: true },
    },
    async (ctx) =>
      runAgentUserTool('list_houses', ctx as McpToolContext, async (user) => {
        const allHouses = await listUserHouses(user.userId);
        const houses = filterAllowedHouses(allHouses, user.allowedContexts);
        const personalAllowed = isPersonalContextAllowed(
          user.userId,
          user.allowedContexts,
        );
        return {
          userId: user.userId,
          scopes: user.scopes,
          personalContext: personalAllowed
            ? { ownerType: 'user', ownerId: user.userId }
            : null,
          houses: houses.map((house) => ({
            ownerType: 'house',
            ownerId: house.id,
            name: house.name,
            role: house.role,
          })),
        };
      }),
  );
}
