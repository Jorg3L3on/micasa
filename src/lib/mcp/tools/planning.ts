import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { DEFAULT_PROJECTION_HORIZON_DAYS } from '@/lib/finance/liquidity-projection';
import {
  ownerIdSchema,
  ownerTypeSchema,
  runAgentTool,
  type McpToolContext,
} from '@/lib/mcp/tool-helpers';
import { listUpcomingCommitments } from '@/lib/mcp/upcoming-commitments.service';

const dateYmdSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato requerido: YYYY-MM-DD');

export function registerPlanningTools(server: McpServer) {
  server.registerTool(
    'list_upcoming',
    {
      title: 'Próximos pagos',
      description:
        'Pagos unificados: tarjetas (revolving proyectado ~180 días vía liquidez), MSI y préstamos. Filtra por mes, quincena (FIRST|SECOND) o rango from/to.',
      inputSchema: z.object({
        ownerType: ownerTypeSchema,
        ownerId: ownerIdSchema,
        year: z.number().int().min(2000).max(2100).optional(),
        month: z.number().int().min(1).max(12).optional(),
        period: z
          .enum(['FIRST', 'SECOND'])
          .optional()
          .describe('Filtra a una quincena del mes (requiere year+month o from/to).'),
        from: dateYmdSchema
          .optional()
          .describe('Inicio del rango (YYYY-MM-DD). Con to, ignora year/month.'),
        to: dateYmdSchema
          .optional()
          .describe(
            `Fin del rango (YYYY-MM-DD). Revolving futuro usa horizonte ~${DEFAULT_PROJECTION_HORIZON_DAYS} días de liquidez.`,
          ),
      }),
      annotations: { readOnlyHint: true },
    },
    async (args, ctx) =>
      runAgentTool('list_upcoming', ctx as McpToolContext, args, 'read', async (agent) =>
        listUpcomingCommitments({
          ownerFilter: agent.ownerFilter,
          year: args.year,
          month: args.month,
          period: args.period,
          from: args.from,
          to: args.to,
        }),
      ),
  );
}
