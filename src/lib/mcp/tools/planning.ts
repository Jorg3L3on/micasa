import type { McpServer } from '@modelcontextprotocol/server';
import { DEFAULT_PROJECTION_HORIZON_DAYS } from '@/lib/finance/liquidity-projection';
import { z } from 'zod';
import { defineOwnerTool } from '@/lib/mcp/define-tool';
import { dateYmd, month, pagination, period, year } from '@/lib/mcp/schemas';
import { out, paginate } from '@/lib/mcp/shapes';
import { listUpcomingCommitments } from '@/lib/mcp/upcoming-commitments.service';

export function registerPlanningTools(server: McpServer) {
  defineOwnerTool(server, {
    name: 'list_upcoming',
    title: 'Próximos pagos',
    description:
      'Pagos comprometidos unificados: tarjetas (revolving proyectado vía liquidez), cuotas MSI y préstamos. Filtra por mes, quincena (FIRST|SECOND) o rango from/to.',
    scope: 'read',
    input: {
      year: year.optional(),
      month: month.optional(),
      period: period
        .optional()
        .describe('Filtra a una quincena del mes (requiere year+month o from/to).'),
      from: dateYmd
        .optional()
        .describe('Inicio del rango (YYYY-MM-DD). Con to, ignora year/month.'),
      to: dateYmd
        .optional()
        .describe(
          `Fin del rango (YYYY-MM-DD). Revolving futuro usa horizonte ~${DEFAULT_PROJECTION_HORIZON_DAYS} días de liquidez.`,
        ),
      ...pagination,
    },
    output: {
      items: out.list({
        date: out.ymd,
        type: z.enum(['revolving', 'msi', 'loan']),
        name: z.string(),
        amount: out.nullableMoney,
        is_paid: z.boolean(),
      }),
      period_total: out.money,
      ...out.page,
    },
    run: async (agent, args) => {
      const { items, ...rest } = await listUpcomingCommitments({
        ownerFilter: agent.ownerFilter,
        year: args.year,
        month: args.month,
        period: args.period,
        from: args.from,
        to: args.to,
      });
      return { ...rest, ...paginate('items', items, args) };
    },
  });
}
