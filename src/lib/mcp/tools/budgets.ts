import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import prisma from '@/lib/prisma';
import {
  createBudget,
  deleteBudget,
  updateBudgetTemplate,
  updateBudgetAllocations,
} from '@/lib/finance/budget.service';
import { listActivePeriods } from '@/lib/finance/budget-period.service';
import { resolveCategoryRef, resolveWalletRef } from '@/lib/mcp/resolvers';
import {
  confirmSchema,
  ownerIdSchema,
  ownerTypeSchema,
  runAgentTool,
  type McpToolContext,
} from '@/lib/mcp/tool-helpers';

const ownerArgs = {
  ownerType: ownerTypeSchema,
  ownerId: ownerIdSchema,
};

const allocationInputSchema = z.object({
  wallet_id: z.number().int().positive().optional(),
  wallet_name: z.string().trim().min(1).optional(),
  category_id: z.number().int().positive().optional(),
  category_name: z.string().trim().min(1).optional(),
  amount: z.number().positive(),
});

const resolveAllocationRows = async (
  agent: { ownerFilter: Parameters<typeof resolveWalletRef>[0] },
  allocations: z.infer<typeof allocationInputSchema>[],
) => {
  const rows = [];
  for (const allocation of allocations) {
    const wallet = await resolveWalletRef(
      agent.ownerFilter,
      allocation.wallet_id,
      allocation.wallet_name,
    );
    const categoryId = await resolveCategoryRef(
      agent.ownerFilter,
      allocation.category_id,
      allocation.category_name,
      { required: true },
    );
    rows.push({
      wallet_id: wallet.id,
      category_id: categoryId!,
      amount: allocation.amount,
    });
  }
  return rows;
};

export function registerBudgetTools(server: McpServer) {
  server.registerTool(
    'list_budgets',
    {
      title: 'Listar presupuestos',
      description:
        'Presupuestos activos del periodo actual: tope, gastado, restante y %.',
      inputSchema: z.object({
        ownerType: ownerTypeSchema,
        ownerId: ownerIdSchema,
      }),
      annotations: { readOnlyHint: true },
    },
    async (args, ctx) =>
      runAgentTool('list_budgets', ctx as McpToolContext, args, 'read', async (agent) => {
        const periods = await listActivePeriods(agent.ownerFilter, new Date());
        return periods.map((period) => ({
          period_id: period.period_id,
          budget_id: period.budget_id,
          name: period.name,
          start_date: period.start_date,
          end_date: period.end_date,
          allocated_amount: period.allocated_amount,
          spent_amount: period.spent_amount,
          remaining_amount: period.remaining_amount,
          percent_used:
            period.allocated_amount > 0
              ? Math.round(
                  (period.spent_amount / period.allocated_amount) * 100,
                )
              : 0,
          allocations: period.allocations,
        }));
      }),
  );

  server.registerTool(
    'upsert_budget',
    {
      title: 'Crear o actualizar presupuesto',
      description:
        'Crea o actualiza un presupuesto con una o varias asignaciones (billetera + categoría). La suma de allocations debe igualar amount.',
      inputSchema: z.object({
        ...ownerArgs,
        budget_id: z.number().int().positive().optional(),
        name: z.string().trim().min(1).max(25),
        amount: z.number().positive(),
        wallet_id: z.number().int().positive().optional(),
        wallet_name: z.string().trim().min(1).optional(),
        category_id: z.number().int().positive().optional(),
        category_name: z.string().trim().min(1).optional(),
        allocations: z
          .array(allocationInputSchema)
          .min(1)
          .optional()
          .describe(
            'Varias asignaciones billetera+categoría. La suma debe igualar amount. Si se omite, usa una sola asignación con wallet/category.',
          ),
      }),
      annotations: { destructiveHint: false, idempotentHint: true },
    },
    async (args, ctx) =>
      runAgentTool('upsert_budget', ctx as McpToolContext, args, 'write', async (agent) => {
        const allocationRows =
          args.allocations != null && args.allocations.length > 0
            ? await resolveAllocationRows(agent, args.allocations)
            : null;

        const wallet = allocationRows
          ? null
          : await resolveWalletRef(
              agent.ownerFilter,
              args.wallet_id,
              args.wallet_name,
            );
        const categoryId = allocationRows
          ? null
          : await resolveCategoryRef(
              agent.ownerFilter,
              args.category_id,
              args.category_name,
              { required: true },
            );

        const resolvedAllocations =
          allocationRows ??
          [
            {
              wallet_id: wallet!.id,
              category_id: categoryId!,
              amount: args.amount,
            },
          ];

        const allocTotal = resolvedAllocations.reduce((sum, row) => sum + row.amount, 0);
        if (Math.abs(allocTotal - args.amount) > 0.01) {
          throw new Error('La suma de allocations debe ser igual a amount');
        }

        if (args.budget_id != null) {
          const budget = await prisma.budget.findFirst({
            where: { id: args.budget_id, ...agent.ownerFilter },
            include: { allocations: true },
          });
          if (!budget) {
            throw new Error('Presupuesto no encontrado');
          }

          await updateBudgetTemplate(budget.id, agent.ownerFilter, {
            name: args.name,
            allocated_amount: args.amount,
            frequency: budget.frequency,
            recurrent: budget.recurrent,
            start_date: budget.start_date
              ? budget.start_date.toISOString().slice(0, 10)
              : null,
            end_date: budget.end_date
              ? budget.end_date.toISOString().slice(0, 10)
              : null,
          });

          await updateBudgetAllocations(budget.id, agent.ownerFilter, resolvedAllocations);

          return { budget_id: budget.id, updated: true, allocations: resolvedAllocations.length };
        }

        const existing = await prisma.budget.findFirst({
          where: {
            ...agent.ownerFilter,
            name: { equals: args.name, mode: 'insensitive' },
            active: true,
          },
        });

        if (existing) {
          await updateBudgetTemplate(existing.id, agent.ownerFilter, {
            name: args.name,
            allocated_amount: args.amount,
            frequency: existing.frequency,
            recurrent: existing.recurrent,
            start_date: existing.start_date
              ? existing.start_date.toISOString().slice(0, 10)
              : null,
            end_date: existing.end_date
              ? existing.end_date.toISOString().slice(0, 10)
              : null,
          });
          await updateBudgetAllocations(existing.id, agent.ownerFilter, resolvedAllocations);
          return {
            budget_id: existing.id,
            updated: true,
            allocations: resolvedAllocations.length,
          };
        }

        const created = await createBudget(agent.ownerType, agent.ownerId, {
          name: args.name,
          allocated_amount: args.amount,
          frequency: 'BIWEEKLY',
          recurrent: true,
          start_date: null,
          end_date: null,
          allocations: resolvedAllocations,
        });

        return {
          budget_id: created.id,
          created: true,
          allocations: resolvedAllocations.length,
        };
      }),
  );

  server.registerTool(
    'update_budget_allocations',
    {
      title: 'Actualizar asignaciones de presupuesto',
      description:
        'Reemplaza las asignaciones (billetera + categoría + monto) de un presupuesto existente. Mismo PUT /api/budgets/[id]/allocations de la UI.',
      inputSchema: z.object({
        ...ownerArgs,
        budget_id: z.number().int().positive(),
        allocations: z.array(allocationInputSchema).min(1),
      }),
      annotations: { destructiveHint: false, idempotentHint: true },
    },
    async (args, ctx) =>
      runAgentTool(
        'update_budget_allocations',
        ctx as McpToolContext,
        args,
        'write',
        async (agent) => {
          const budget = await prisma.budget.findFirst({
            where: { id: args.budget_id, ...agent.ownerFilter },
            select: { id: true, total_amount: true },
          });
          if (!budget) {
            throw new Error('Presupuesto no encontrado');
          }

          const resolvedAllocations = await resolveAllocationRows(agent, args.allocations);
          const allocTotal = resolvedAllocations.reduce((sum, row) => sum + row.amount, 0);
          if (Math.abs(allocTotal - Number(budget.total_amount)) > 0.01) {
            throw new Error(
              'La suma de allocations debe ser igual al monto total del presupuesto',
            );
          }

          await updateBudgetAllocations(
            args.budget_id,
            agent.ownerFilter,
            resolvedAllocations,
          );

          return {
            budget_id: args.budget_id,
            updated: true,
            allocations: resolvedAllocations,
          };
        },
      ),
  );

  server.registerTool(
    'delete_budget',
    {
      title: 'Eliminar presupuesto',
      description: 'Desactiva/elimina un presupuesto. Requiere confirm: true.',
      inputSchema: z.object({
        ...ownerArgs,
        budget_id: z.number().int().positive(),
        confirm: confirmSchema,
      }),
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async (args, ctx) =>
      runAgentTool('delete_budget', ctx as McpToolContext, args, 'write', async (agent) => {
        await deleteBudget(args.budget_id, agent.ownerFilter);
        return { deleted: true, budget_id: args.budget_id };
      }),
  );
}
