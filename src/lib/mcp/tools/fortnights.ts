import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import {
  createMonthFortnightsForOwner,
  regenerateFortnightFromTemplatesForOwner,
} from '@/lib/finance/fortnight.service';
import { defineOwnerTool } from '@/lib/mcp/define-tool';
import { fortnightRef, month } from '@/lib/mcp/schemas';
import { resolveFortnightRef } from '@/lib/mcp/resolvers';

export function registerFortnightTools(server: McpServer) {
  defineOwnerTool(server, {
    name: 'create_month',
    title: 'Crear mes de planeación',
    description:
      'Crea las dos quincenas del mes (si faltan) y expande las plantillas de gastos e ingresos, como el botón Crear mes en Panel financiero. Seguro de repetir.',
    scope: 'write',
    annotations: { destructiveHint: false, idempotentHint: true },
    input: {
      year: z.number().int().min(2010).max(2030).describe('Año, p. ej. 2026.'),
      month,
    },
    run: (agent, args) =>
      createMonthFortnightsForOwner({
        ownerType: agent.ownerType,
        ownerId: agent.ownerId,
        ownerFilter: agent.ownerFilter,
        year: args.year,
        month: args.month,
      }),
  });

  defineOwnerTool(server, {
    name: 'regenerate_from_templates',
    title: 'Regenerar quincena desde plantillas',
    description:
      'Elimina los gastos e ingresos generados por plantillas en la quincena y los vuelve a expandir, como Regenerar en Panel financiero.',
    scope: 'write',
    annotations: { destructiveHint: true, idempotentHint: true },
    input: { ...fortnightRef },
    run: async (agent, args) => {
      const fortnightId = await resolveFortnightRef(agent, args);
      return regenerateFortnightFromTemplatesForOwner(fortnightId, agent.ownerFilter);
    },
  });
}
