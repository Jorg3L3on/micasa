import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import {
  createBudget,
  findBudgetForOwner,
  updateBudgetTemplate,
  updateBudgetAllocations,
} from '@/lib/finance/budget.service';
import { listActivePeriods } from '@/lib/finance/budget-period.service';
import { formatStoredDateOnly } from '@/lib/calendar-dates';
import { resolveCategoryRef, resolveWalletRef } from '@/lib/mcp/resolvers';
import { defineOwnerTool } from '@/lib/mcp/define-tool';
import { McpToolError } from '@/lib/mcp/errors';
import { categoryRef, walletRef } from '@/lib/mcp/schemas';

const allocationInputSchema = z
  .object({
    ...walletRef,
    ...categoryRef,
    amount: z.number().positive(),
  })
  .strict();

const resolveOptionalWalletId = async (
  ownerFilter: Parameters<typeof resolveWalletRef>[0],
  walletId: number | undefined,
  walletName: string | undefined,
): Promise<number | null> => {
  if (walletId == null && !walletName?.trim()) return null;
  const wallet = await resolveWalletRef(ownerFilter, walletId, walletName);
  return wallet.id;
};

const resolveAllocationRows = async (
  agent: { ownerFilter: Parameters<typeof resolveWalletRef>[0] },
  allocations: z.infer<typeof allocationInputSchema>[],
) => {
  const rows = [];
  for (const allocation of allocations) {
    const walletId = await resolveOptionalWalletId(
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
      wallet_id: walletId,
      category_id: categoryId!,
      amount: allocation.amount,
    });
  }
  return rows;
};

export function registerBudgetTools(server: McpServer) {
  defineOwnerTool(server, {
    name: 'list_budgets',
    title: 'Listar presupuestos',
    description:
      'Presupuestos activos del periodo actual: tope, gastado, restante, % usado y asignaciones.',
    scope: 'read',
    input: {},
    run: async (agent) => {
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
            ? Math.round((period.spent_amount / period.allocated_amount) * 100)
            : 0,
        allocations: period.allocations,
      }));
    },
  });

  defineOwnerTool(server, {
    name: 'upsert_budget',
    title: 'Crear o actualizar presupuesto',
    description:
      'Crea o actualiza un presupuesto quincenal con asignaciones por categoría (y billetera opcional; sin billetera = cualquiera). Con budget_id actualiza: name y amount opcionales, allocations reemplaza las actuales. Sin budget_id requiere name y amount (un activo con el mismo nombre se actualiza). allocations debe sumar amount.',
    scope: 'write',
    annotations: { destructiveHint: false, idempotentHint: true },
    input: {
      budget_id: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Presupuesto a actualizar (de list_budgets). Omítelo para crear.'),
      name: z.string().trim().min(1).max(25).optional(),
      amount: z.number().positive().optional().describe('Tope total del presupuesto.'),
      ...walletRef,
      ...categoryRef,
      allocations: z
        .array(allocationInputSchema)
        .min(1)
        .optional()
        .describe('Si se omite: una asignación con wallet/category y amount.'),
    },
    run: async (agent, args) => {
      const budget =
        args.budget_id != null
          ? await findBudgetForOwner(agent.ownerFilter, { id: args.budget_id })
          : args.name != null
            ? await findBudgetForOwner(agent.ownerFilter, { activeName: args.name })
            : null;

      if (args.budget_id != null && !budget) {
        throw new McpToolError('NOT_FOUND', 'Presupuesto no encontrado', {
          hint: 'Usa list_budgets para ver los ids válidos.',
        });
      }
      if (!budget && (args.name == null || args.amount == null)) {
        throw new McpToolError('VALIDATION', 'Para crear un presupuesto indica name y amount');
      }

      const name = args.name ?? budget!.name;
      const amount = args.amount ?? Number(budget!.total_amount);

      const allocationRows =
        args.allocations != null && args.allocations.length > 0
          ? await resolveAllocationRows(agent, args.allocations)
          : null;

      const resolvedAllocations =
        allocationRows ??
        [
          {
            wallet_id: await resolveOptionalWalletId(
              agent.ownerFilter,
              args.wallet_id,
              args.wallet_name,
            ),
            category_id: (await resolveCategoryRef(
              agent.ownerFilter,
              args.category_id,
              args.category_name,
              { required: true },
            ))!,
            amount,
          },
        ];

      const allocTotal = resolvedAllocations.reduce((sum, row) => sum + row.amount, 0);
      if (Math.abs(allocTotal - amount) > 0.01) {
        throw new McpToolError('VALIDATION', 'La suma de allocations debe ser igual a amount', {
          hint: `amount = ${amount}; allocations suman ${allocTotal}.`,
        });
      }

      if (budget) {
        await updateBudgetTemplate(budget.id, agent.ownerFilter, {
          name,
          allocated_amount: amount,
          frequency: budget.frequency,
          recurrent: budget.recurrent,
          start_date: budget.start_date ? formatStoredDateOnly(budget.start_date) : null,
          end_date: budget.end_date ? formatStoredDateOnly(budget.end_date) : null,
        });
        await updateBudgetAllocations(budget.id, agent.ownerFilter, resolvedAllocations);
        return {
          budget_id: budget.id,
          updated: true,
          allocations: resolvedAllocations.length,
        };
      }

      const created = await createBudget(agent.ownerType, agent.ownerId, {
        name,
        allocated_amount: amount,
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
    },
  });
}
