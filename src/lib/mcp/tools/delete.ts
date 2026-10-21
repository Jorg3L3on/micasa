import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { deleteExpense } from '@/lib/finance/expense.service';
import { deleteIncomeForOwner } from '@/lib/finance/income.service';
import { deleteBudget } from '@/lib/finance/budget.service';
import { deleteLoanForOwner } from '@/lib/finance/loan.service';
import { deleteScheduledPayment } from '@/lib/finance/credit-card-scheduled-payment.service';
import { deleteCategoryForOwner } from '@/lib/finance/category.service';
import { deleteExpenseTemplateForOwner } from '@/lib/finance/expense-template.service';
import { deleteIncomeTemplateForOwner } from '@/lib/finance/income-template.service';
import type { AgentContext } from '@/lib/server/resolve-agent-context';
import { defineOwnerTool } from '@/lib/mcp/define-tool';

const DELETE_KINDS = [
  'expense',
  'income',
  'category',
  'budget',
  'expense_template',
  'income_template',
  'loan',
  'scheduled_payment',
] as const;

type DeleteKind = (typeof DELETE_KINDS)[number];

const DELETERS: Record<
  DeleteKind,
  (agent: AgentContext, id: number) => Promise<Record<string, unknown>>
> = {
  expense: async (agent, id) => {
    await deleteExpense({ id, ownerFilter: agent.ownerFilter });
    return {};
  },
  income: async (agent, id) => {
    await deleteIncomeForOwner(id, agent.ownerFilter);
    return {};
  },
  category: async (agent, id) => {
    await deleteCategoryForOwner(agent.ownerType, agent.ownerId, id);
    return {};
  },
  budget: async (agent, id) => {
    await deleteBudget(id, agent.ownerFilter);
    return {};
  },
  expense_template: async (agent, id) => {
    const { detachedExpenseCount } = await deleteExpenseTemplateForOwner(id, agent.ownerFilter);
    return { detached_expense_count: detachedExpenseCount };
  },
  income_template: async (agent, id) => {
    await deleteIncomeTemplateForOwner(id, agent.ownerFilter);
    return {};
  },
  loan: async (agent, id) => ({ ...(await deleteLoanForOwner(id, agent.ownerFilter)) }),
  scheduled_payment: async (agent, id) => {
    await deleteScheduledPayment(id, null, agent.ownerFilter);
    return {};
  },
};

export function registerDeleteTools(server: McpServer) {
  defineOwnerTool(server, {
    name: 'delete',
    title: 'Eliminar un registro',
    description:
      'Elimina un registro y revierte su efecto: expense / income revierten saldo o deuda; category solo sin uso; budget se desactiva; expense_template desvincula sus gastos; income_template solo sin uso; loan revierte sus movimientos; scheduled_payment solo si no está cubierta. Requiere confirm: true.',
    scope: 'write',
    annotations: { destructiveHint: true, idempotentHint: false },
    confirm: true,
    input: {
      kind: z.enum(DELETE_KINDS).describe('Tipo de registro a eliminar.'),
      id: z.number().int().positive().describe('Id del registro.'),
    },
    run: async (agent, args) => {
      const extra = await DELETERS[args.kind](agent, args.id);
      return { deleted: true, kind: args.kind, id: args.id, ...extra };
    },
  });
}
