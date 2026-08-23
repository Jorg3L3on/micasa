import type { McpServer } from '@modelcontextprotocol/server';
import { listUserHouses } from '@/lib/house/house.service';
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
        const houses = await listUserHouses(user.userId);
        return {
          userId: user.userId,
          scopes: user.scopes,
          personalContext: { ownerType: 'user', ownerId: user.userId },
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
