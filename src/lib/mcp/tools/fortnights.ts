import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { FortnightPeriod } from '@/generated/prisma/client';
import { findFortnightByCalendarPeriod } from '@/features/monthly/server/monthly.queries';
import {
  createMonthFortnightsForOwner,
  regenerateFortnightFromTemplatesForOwner,
} from '@/lib/finance/fortnight.service';
import { getReportSummary } from '@/lib/finance/report-summary.service';
import { listPlanningTransactions } from '@/lib/finance/planning-transactions.service';
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

const periodSchema = z
  .enum(['FIRST', 'SECOND'])
  .describe('Quincena del mes: FIRST (último día del mes anterior al 14) o SECOND (15 al penúltimo día).');

export function registerFortnightTools(server: McpServer) {
  server.registerTool(
    'get_fortnight',
    {
      title: 'Detalle de quincena',
      description:
        'Resumen de planificación de una quincena (ingresos, gastos, saldo) y transacciones de gasto, igual que la vista de quincena en la app.',
      inputSchema: z.object({
        ...ownerArgs,
        year: z.number().int().min(2000).max(2100),
        month: z.number().int().min(1).max(12),
        period: periodSchema,
      }),
      annotations: { readOnlyHint: true },
    },
    async (args, ctx) =>
      runAgentTool('get_fortnight', ctx as McpToolContext, args, 'read', async (agent) => {
        const parsedPeriod =
          args.period === 'SECOND'
            ? FortnightPeriod.SECOND
            : FortnightPeriod.FIRST;

        const fortnight = await findFortnightByCalendarPeriod(
          agent.ownerFilter,
          args.year,
          args.month,
          parsedPeriod,
        );

        const summary = await getReportSummary({
          ownerFilter: agent.ownerFilter,
          year: String(args.year),
          month: String(args.month),
          period: args.period,
          excludeCreditInstallment: true,
          resolvedFortnightIds: fortnight ? [fortnight.id] : [],
        });

        const expenses = fortnight
          ? await listPlanningTransactions({
              ownerFilter: agent.ownerFilter,
              year: String(args.year),
              month: String(args.month),
              period: args.period,
              type: 'expense',
              excludeCreditInstallment: true,
              resolvedFortnightIds: [fortnight.id],
            })
          : [];

        return {
          fortnight: fortnight
            ? {
                id: fortnight.id,
                label: fortnight.label,
                year: args.year,
                month: args.month,
                period: args.period,
              }
            : null,
          summary: {
            total_income: summary.totalIncome,
            total_expense: summary.totalExpense,
            total_paid: summary.totalPaid,
            total_unpaid: summary.totalUnpaid,
            balance: summary.balance,
            planning_expense_count: summary.planningExpenseCount ?? 0,
            planning_unpaid_expense_count: summary.planningUnpaidExpenseCount ?? 0,
          },
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
      }),
  );

  server.registerTool(
    'create_month',
    {
      title: 'Crear mes de planificación',
      description:
        'Crea las quincenas del mes (si faltan) y expande plantillas de gastos e ingresos. Misma lógica que el botón Crear mes en Panel financiero.',
      inputSchema: z.object({
        ...ownerArgs,
        year: z.number().int().min(2010).max(2030),
        month: z.number().int().min(1).max(12),
      }),
      annotations: { destructiveHint: false, idempotentHint: true },
    },
    async (args, ctx) =>
      runAgentTool('create_month', ctx as McpToolContext, args, 'write', async (agent) =>
        createMonthFortnightsForOwner({
          ownerType: agent.ownerType,
          ownerId: agent.ownerId,
          ownerFilter: agent.ownerFilter,
          year: args.year,
          month: args.month,
        }),
      ),
  );

  server.registerTool(
    'regenerate_from_templates',
    {
      title: 'Regenerar quincena desde plantillas',
      description:
        'Elimina gastos e ingresos generados por plantillas en la quincena y los vuelve a expandir. Misma acción que Regenerar en Panel financiero.',
      inputSchema: z
        .object({
          ...ownerArgs,
          fortnight_id: z
            .number()
            .int()
            .positive()
            .optional()
            .describe('Id de la quincena. Alternativa: year + month + period.'),
          year: z.number().int().min(2000).max(2100).optional(),
          month: z.number().int().min(1).max(12).optional(),
          period: periodSchema.optional(),
        })
        .superRefine((data, ctxRef) => {
          if (data.fortnight_id != null) return;
          if (data.year == null || data.month == null || data.period == null) {
            ctxRef.addIssue({
              code: 'custom',
              message: 'Indica fortnight_id o year + month + period',
              path: ['fortnight_id'],
            });
          }
        }),
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async (args, ctx) =>
      runAgentTool(
        'regenerate_from_templates',
        ctx as McpToolContext,
        args,
        'write',
        async (agent) => {
          let fortnightId = args.fortnight_id;
          if (fortnightId == null) {
            const parsedPeriod =
              args.period === 'SECOND'
                ? FortnightPeriod.SECOND
                : FortnightPeriod.FIRST;
            const fortnight = await findFortnightByCalendarPeriod(
              agent.ownerFilter,
              args.year!,
              args.month!,
              parsedPeriod,
            );
            if (!fortnight) {
              throw new Error('Quincena no encontrada');
            }
            fortnightId = fortnight.id;
          }

          return regenerateFortnightFromTemplatesForOwner(
            fortnightId,
            agent.ownerFilter,
          );
        },
      ),
  );
}
