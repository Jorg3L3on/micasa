import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { currentCalendarMonth } from '@/lib/mcp/resolvers';
import {
  ownerIdSchema,
  ownerTypeSchema,
  runAgentTool,
  type McpToolContext,
} from '@/lib/mcp/tool-helpers';
import { listUpcomingCommitmentsForMonth } from '@/lib/mcp/upcoming-commitments.service';

export function registerPlanningTools(server: McpServer) {
  server.registerTool(
    'list_upcoming',
    {
      title: 'Próximos pagos del mes',
      description:
        'Pagos unificados del mes: tarjetas (revolving), MSI y préstamos.',
      inputSchema: z.object({
        ownerType: ownerTypeSchema,
        ownerId: ownerIdSchema,
        year: z.number().int().min(2000).max(2100).optional(),
        month: z.number().int().min(1).max(12).optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    async (args, ctx) =>
      runAgentTool('list_upcoming', ctx as McpToolContext, args, 'read', async (agent) => {
        const { year, month } =
          args.year != null && args.month != null
            ? { year: args.year, month: args.month }
            : currentCalendarMonth();

        return listUpcomingCommitmentsForMonth(agent.ownerFilter, year, month);
      }),
  );
}
