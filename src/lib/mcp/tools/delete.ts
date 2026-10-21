import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import prisma from '@/lib/prisma';
import { deleteExpense } from '@/lib/finance/expense.service';
import { deleteIncomeForOwner } from '@/lib/finance/income.service';
import { deleteBudget } from '@/lib/finance/budget.service';
import { deleteLoanForOwner } from '@/lib/finance/loan.service';
import { deleteScheduledPayment } from '@/lib/finance/credit-card-scheduled-payment.service';
import {
  assertCategoryDeletable,
  categoryOwnerWhere,
} from '@/lib/finance/category.service';
import type { AgentContext } from '@/lib/server/resolve-agent-context';
import { defineOwnerTool } from '@/lib/mcp/define-tool';
import { McpToolError } from '@/lib/mcp/errors';
import { confirm } from '@/lib/mcp/schemas';

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

const notFound = (message: string) => new McpToolError('NOT_FOUND', message);

const deleteCategory = async (agent: AgentContext, id: number) => {
  const existing = await prisma.category.findFirst({
    where: { id, ...categoryOwnerWhere(agent.ownerType, agent.ownerId) },
  });
  if (!existing) throw notFound('Categoría no encontrada');

  await assertCategoryDeletable(prisma, id, agent.ownerType, agent.ownerId);
  await prisma.category.delete({ where: { id: existing.id } });
  return {};
};

const deleteExpenseTemplate = async (agent: AgentContext, id: number) => {
  const existing = await prisma.expenseTemplate.findFirst({
    where: { id, ...agent.ownerFilter },
  });
  if (!existing) throw notFound('Plantilla de gasto no encontrada');

  const detachedCount = await prisma.$transaction(async (tx) => {
    const detached = await tx.expense.updateMany({
      where: { expense_template_id: id },
      data: { expense_template_id: null },
    });
    await tx.expenseTemplate.delete({ where: { id } });
    return detached.count;
  });
  return { detached_expense_count: detachedCount };
};

const deleteIncomeTemplate = async (agent: AgentContext, id: number) => {
  const existing = await prisma.incomeTemplate.findFirst({
    where: { id, ...agent.ownerFilter },
  });
  if (!existing) throw notFound('Plantilla de ingresos no encontrada');

  const relatedIncome = await prisma.income.findFirst({
    where: { income_template_id: id },
  });
  if (relatedIncome) {
    throw new McpToolError(
      'VALIDATION',
      'La plantilla de ingresos está en uso y no puede eliminarse',
      { hint: 'Desactívala con update_template (active: false).' },
    );
  }

  await prisma.incomeTemplate.delete({ where: { id } });
  return {};
};

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
  category: deleteCategory,
  budget: async (agent, id) => {
    await deleteBudget(id, agent.ownerFilter);
    return {};
  },
  expense_template: deleteExpenseTemplate,
  income_template: deleteIncomeTemplate,
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
    input: {
      kind: z.enum(DELETE_KINDS).describe('Tipo de registro a eliminar.'),
      id: z.number().int().positive().describe('Id del registro.'),
      confirm,
    },
    run: async (agent, args) => {
      const extra = await DELETERS[args.kind](agent, args.id);
      return { deleted: true, kind: args.kind, id: args.id, ...extra };
    },
  });
}
