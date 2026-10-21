import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { FortnightPeriod } from '@/generated/prisma/client';
import { findFortnightByCalendarPeriod } from '@/features/monthly/server/monthly.queries';
import { getReportSummary } from '@/lib/finance/report-summary.service';
import { listPlanningTransactions } from '@/lib/finance/planning-transactions.service';
import { getAlerts } from '@/features/alerts/server/alerts.service';
import { defineOwnerTool } from '@/lib/mcp/define-tool';
import { McpToolError } from '@/lib/mcp/errors';
import { month, period, year } from '@/lib/mcp/schemas';

export function registerReportTools(server: McpServer) {
  defineOwnerTool(server, {
    name: 'get_period_summary',
    title: 'Resumen de quincena o mes',
    description:
      'Totales de una quincena (con period) o del mes completo (sin period): ingresos, gastos, pagado/pendiente, saldos de billeteras de fondo y resto de presupuesto, como el panel de planeación. include_movements (requiere period) agrega la quincena y sus gastos.',
    scope: 'read',
    input: {
      year,
      month,
      period: period.optional().describe('Quincena FIRST|SECOND. Omítelo para el mes completo.'),
      exclude_credit_installment: z
        .boolean()
        .optional()
        .default(true)
        .describe(
          'true (default): vista de planeación sin cuotas MSI de tarjeta; incluye KPIs de tarjetas/préstamos del planner.',
        ),
      include_movements: z
        .boolean()
        .default(false)
        .describe('true = agrega la quincena (id, label) y sus gastos. Requiere period.'),
    },
    run: async (agent, args) => {
      if (!args.include_movements) {
        return getReportSummary({
          ownerFilter: agent.ownerFilter,
          year: String(args.year),
          month: String(args.month),
          period: args.period ?? null,
          excludeCreditInstallment: args.exclude_credit_installment,
        });
      }

      if (args.period == null) {
        throw new McpToolError('VALIDATION', 'include_movements requiere period');
      }

      const fortnight = await findFortnightByCalendarPeriod(
        agent.ownerFilter,
        args.year,
        args.month,
        args.period === 'SECOND' ? FortnightPeriod.SECOND : FortnightPeriod.FIRST,
      );
      const resolvedFortnightIds = fortnight ? [fortnight.id] : [];

      const [summary, expenses] = await Promise.all([
        getReportSummary({
          ownerFilter: agent.ownerFilter,
          year: String(args.year),
          month: String(args.month),
          period: args.period,
          excludeCreditInstallment: args.exclude_credit_installment,
          resolvedFortnightIds,
        }),
        fortnight
          ? listPlanningTransactions({
              ownerFilter: agent.ownerFilter,
              year: String(args.year),
              month: String(args.month),
              period: args.period,
              type: 'expense',
              excludeCreditInstallment: args.exclude_credit_installment,
              resolvedFortnightIds,
            })
          : [],
      ]);

      return {
        ...summary,
        fortnight: fortnight
          ? {
              id: fortnight.id,
              label: fortnight.label,
              year: args.year,
              month: args.month,
              period: args.period,
            }
          : null,
        expenses: expenses.map((row) => ({
          id: row.id,
          date: row.date,
          description: row.description,
          amount: row.amount,
          is_paid: row.is_paid,
          wallet_name: row.paymentMethod ?? null,
          category_name: row.category ?? null,
        })),
      };
    },
  });

  defineOwnerTool(server, {
    name: 'get_alerts',
    title: 'Alertas del periodo',
    description:
      'Alertas financieras del periodo actual o indicado (ingreso faltante, compromiso alto, vencidos), como la campana del encabezado de la app.',
    scope: 'read',
    input: {
      view: z
        .enum(['biweekly', 'month'])
        .optional()
        .default('biweekly')
        .describe('Vista quincenal o mensual.'),
      year: year.optional(),
      month: month.optional(),
      period: period.optional(),
    },
    run: (agent, args) =>
      getAlerts({
        ownerFilter: agent.ownerFilter,
        view: args.view,
        year: args.year != null ? String(args.year) : null,
        month: args.month != null ? String(args.month) : null,
        period: args.period ?? null,
      }),
  });
}
