import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { formatCalendarDate, parseCalendarDate, todayCalendarDate } from '@/lib/calendar-dates';
import {
  defaultLiquidityUntilFromAsOf,
  getLiquidityProjection,
} from '@/lib/finance/liquidity-projection.service';
import { buildMcpLiquidityPayload } from '@/lib/mcp/liquidity-response';
import { defineOwnerTool } from '@/lib/mcp/define-tool';
import { dateYmd } from '@/lib/mcp/schemas';
import { out } from '@/lib/mcp/shapes';

export function registerLiquidityTools(server: McpServer) {
  defineOwnerTool(server, {
    name: 'get_liquidity',
    title: 'Liquidez — me alcanza hasta…',
    description:
      'Proyección de liquidez (mismo criterio que la página Liquidez): efectivo disponible, pagos comprometidos y fecha hasta la que alcanza.',
    scope: 'read',
    input: {
      until: dateYmd
        .optional()
        .describe('Horizonte (YYYY-MM-DD). Default: ~60 días desde hoy.'),
      include_unpaid_expenses: z
        .boolean()
        .default(true)
        .describe('Cuenta los gastos pendientes de la quincena como compromisos.'),
    },
    output: {
      as_of: out.ymd,
      until: out.ymd,
      funding_total: out.money,
      committed_obligations_total: out.money,
      net_liquidity: out.money,
      lasts_until: out.ymd.nullable(),
    },
    run: async (agent, args) => {
      const asOf = new Date();
      const asOfYmd = todayCalendarDate();
      const until = args.until
        ? parseCalendarDate(args.until)
        : defaultLiquidityUntilFromAsOf(asOf);
      const untilYmd = args.until ?? formatCalendarDate(until);

      const projection = await getLiquidityProjection({
        ownerFilter: agent.ownerFilter,
        asOf,
        until,
        includeUnpaidExpenses: args.include_unpaid_expenses,
      });

      const liquidity = buildMcpLiquidityPayload(projection, asOfYmd, untilYmd);

      const payoffEvents = projection.projection_events.filter(
        (event) =>
          event.event_type === 'loan_payoff' ||
          event.event_type === 'msi_complete',
      );

      return {
        ...liquidity,
        funding_wallets: projection.funding_wallets.map((wallet) => ({
          id: wallet.id,
          name: wallet.name,
          balance: wallet.balance,
        })),
        payoff_events_in_horizon: payoffEvents.map((event) => ({
          type: event.event_type,
          month_key: event.month_key,
          title: event.title,
        })),
      };
    },
  });
}
