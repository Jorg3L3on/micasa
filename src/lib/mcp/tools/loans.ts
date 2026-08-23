import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { listLoansByOwner } from '@/lib/finance/loan.service';
import {
  ownerIdSchema,
  ownerTypeSchema,
  runAgentTool,
  type McpToolContext,
} from '@/lib/mcp/tool-helpers';

export function registerLoanTools(server: McpServer) {
  server.registerTool(
    'list_loans',
    {
      title: 'Listar préstamos',
      description:
        'Préstamos del contexto con progreso y calendario de pagos. Pasa year y month (1-12) para ver solo las cuotas de ese mes (p. ej. "¿cuánto pago en diciembre?").',
      inputSchema: z.object({
        ownerType: ownerTypeSchema,
        ownerId: ownerIdSchema,
        year: z.number().int().min(2000).max(2100).optional(),
        month: z.number().int().min(1).max(12).optional(),
        includeInactive: z
          .boolean()
          .default(false)
          .describe('Incluir préstamos pagados, pausados o cancelados.'),
      }),
      annotations: { readOnlyHint: true },
    },
    async (args, ctx) =>
      runAgentTool('list_loans', ctx as McpToolContext, args, 'read', async (agent) => {
        const loans = await listLoansByOwner(agent.ownerFilter);
        const visible = args.includeInactive
          ? loans
          : loans.filter((loan) => loan.status === 'ACTIVE');

        const monthPrefix =
          args.year != null && args.month != null
            ? `${args.year}-${String(args.month).padStart(2, '0')}`
            : null;

        let monthTotalDue = 0;

        const items = visible.map((loan) => {
          const payments = loan.payments ?? [];
          const monthPayments = monthPrefix
            ? payments.filter((p) => p.dueDate.startsWith(monthPrefix))
            : null;

          if (monthPayments) {
            monthTotalDue += monthPayments
              .filter((p) => p.status === 'SCHEDULED')
              .reduce((sum, p) => sum + p.amount, 0);
          }

          return {
            id: loan.id,
            name: loan.name,
            lender: loan.lender,
            type: loan.type,
            status: loan.status,
            frequency: loan.frequency,
            paymentSource: loan.paymentSource,
            paymentAmount: loan.paymentAmount,
            totalPayable: loan.totalPayable,
            paidAmount: loan.paidAmount,
            remainingAmount: loan.remainingAmount,
            paidPayments: loan.paidPayments,
            remainingPayments: loan.remainingPayments,
            nextPayment: loan.nextPayment,
            ...(monthPayments ? { monthPayments } : {}),
          };
        });

        return {
          loans: items,
          ...(monthPrefix
            ? { month: monthPrefix, monthScheduledTotal: monthTotalDue }
            : {}),
        };
      }),
  );
}
