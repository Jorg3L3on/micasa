import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { getReportSummary } from '@/lib/finance/report-summary.service';
import { getAlerts } from '@/features/alerts/server/alerts.service';
import {
  ownerIdSchema,
  ownerTypeSchema,
  runAgentTool,
  type McpToolContext,
} from '@/lib/mcp/tool-helpers';

const ownerArgs = {
  ownerType: ownerTypeSchema,
  ownerId: ownerIdSchema,
};

const periodSchema = z.enum(['FIRST', 'SECOND']);

export function registerReportTools(server: McpServer) {
  server.registerTool(
    'get_period_summary',
    {
      title: 'Resumen del periodo',
      description:
        'Totales de ingresos, gastos, pagado/pendiente, saldos de billeteras de fondo y resto de presupuesto. Misma lógica que GET /api/reports?type=summary y el panel de planificación.',
      inputSchema: z.object({
        ...ownerArgs,
        year: z.number().int().min(2000).max(2100),
        month: z.number().int().min(1).max(12),
        period: periodSchema.optional().describe(
          'Quincena FIRST|SECOND. Omítelo para resumen mensual completo.',
        ),
        exclude_credit_installment: z
          .boolean()
          .optional()
          .default(true)
          .describe(
            'true (default): vista de planificación sin cuotas MSI de tarjeta; incluye KPIs de tarjetas/préstamos del planner.',
          ),
      }),
      annotations: { readOnlyHint: true },
    },
    async (args, ctx) =>
      runAgentTool('get_period_summary', ctx as McpToolContext, args, 'read', async (agent) =>
        getReportSummary({
          ownerFilter: agent.ownerFilter,
          year: String(args.year),
          month: String(args.month),
          period: args.period ?? null,
          excludeCreditInstallment: args.exclude_credit_installment,
        }),
      ),
  );

  server.registerTool(
    'get_alerts',
    {
      title: 'Alertas del periodo',
      description:
        'Alertas financieras del periodo actual o indicado (ingreso faltante, compromiso alto, vencidos). Misma lógica que GET /api/alerts y la campana del header.',
      inputSchema: z.object({
        ...ownerArgs,
        view: z
          .enum(['biweekly', 'month'])
          .optional()
          .default('biweekly')
          .describe('Vista quincenal o mensual.'),
        year: z.number().int().min(2000).max(2100).optional(),
        month: z.number().int().min(1).max(12).optional(),
        period: periodSchema.optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    async (args, ctx) =>
      runAgentTool('get_alerts', ctx as McpToolContext, args, 'read', async (agent) =>
        getAlerts({
          ownerFilter: agent.ownerFilter,
          view: args.view,
          year: args.year != null ? String(args.year) : null,
          month: args.month != null ? String(args.month) : null,
          period: args.period ?? null,
        }),
      ),
  );
}
