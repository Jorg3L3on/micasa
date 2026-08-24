import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { listActiveInstallmentPlansForOwner } from '@/lib/finance/credit-card-installment-plan.service';
import { listScheduledPaymentsForPlannerMonth } from '@/lib/finance/credit-card-scheduled-payment.service';
import { listCreditCardsByOwner } from '@/lib/finance/credit-card.service';
import { getCreditCardStatementByOwner } from '@/lib/finance/credit-card-statement.service';
import { listLoanPaymentsForPlannerMonth } from '@/lib/finance/loan.service';
import { currentCalendarMonth } from '@/lib/mcp/resolvers';
import {
  ownerIdSchema,
  ownerTypeSchema,
  runAgentTool,
  type McpToolContext,
} from '@/lib/mcp/tool-helpers';

type UpcomingItem = {
  date: string;
  type: 'revolving' | 'msi' | 'loan';
  name: string;
  amount: number;
  is_paid: boolean;
  source_id: number;
  wallet_or_loan: string;
};

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

        const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
        const items: UpcomingItem[] = [];

        const cards = await listCreditCardsByOwner(agent.ownerFilter);
        for (const card of cards) {
          try {
            const statement = await getCreditCardStatementByOwner(
              card.id,
              agent.ownerFilter,
            );
            const dueDate = statement.statement_due_date?.slice(0, 10) ?? null;
            if (dueDate?.startsWith(monthPrefix) && statement.next_due_payment > 0) {
              items.push({
                date: dueDate,
                type: 'revolving',
                name: `Pago tarjeta ${card.name}`,
                amount: statement.next_due_payment,
                is_paid: false,
                source_id: card.id,
                wallet_or_loan: card.name,
              });
            }
          } catch {
            // Tarjeta sin corte/pago configurado
          }
        }

        const scheduled = await listScheduledPaymentsForPlannerMonth(
          agent.ownerFilter,
          year,
          month,
        );
        for (const payment of [...scheduled.first, ...scheduled.second]) {
          items.push({
            date: payment.dueDate,
            type: 'msi',
            name: payment.label ?? 'Cuota programada',
            amount: payment.amount,
            is_paid: payment.status === 'PAID',
            source_id: payment.id,
            wallet_or_loan: payment.walletName,
          });
        }

        const installmentPlans = await listActiveInstallmentPlansForOwner(
          agent.ownerFilter,
        );
        for (const row of installmentPlans) {
          const nextDue = row.plan.nextDueDate;
          if (nextDue?.startsWith(monthPrefix)) {
            items.push({
              date: nextDue,
              type: 'msi',
              name: row.plan.name,
              amount: row.plan.installmentAmount,
              is_paid: false,
              source_id: row.plan.id,
              wallet_or_loan: row.walletName,
            });
          }
        }

        const loanPayments = await listLoanPaymentsForPlannerMonth(
          agent.ownerFilter,
          year,
          month,
        );
        for (const payment of [...loanPayments.first, ...loanPayments.second]) {
          if (payment.status !== 'SCHEDULED') continue;
          items.push({
            date: payment.dueDate,
            type: 'loan',
            name: payment.loanName,
            amount: payment.amount,
            is_paid: false,
            source_id: payment.id,
            wallet_or_loan: payment.lender,
          });
        }

        items.sort((a, b) => a.date.localeCompare(b.date));

        const periodTotal = items
          .filter((item) => !item.is_paid)
          .reduce((sum, item) => sum + item.amount, 0);

        return {
          year,
          month,
          items,
          period_total: periodTotal,
        };
      }),
  );
}
