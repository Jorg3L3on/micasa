import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import prisma from '@/lib/prisma';
import { seedDefaultCategoriesForOwner } from '@/lib/finance/category-seed.service';
import { categoryOwnerWhere } from '@/lib/finance/category.service';
import {
  ownerIdSchema,
  ownerTypeSchema,
  runAgentTool,
  type McpToolContext,
} from '@/lib/mcp/tool-helpers';

export function registerCategoryTools(server: McpServer) {
  server.registerTool(
    'list_categories',
    {
      title: 'Listar categorías',
      description:
        'Catálogo de categorías del contexto (compartidas para gastos e ingresos). Usa los nombres en add_expense / add_income.',
      inputSchema: z.object({
        ownerType: ownerTypeSchema,
        ownerId: ownerIdSchema,
      }),
      annotations: { readOnlyHint: true },
    },
    async (args, ctx) =>
      runAgentTool('list_categories', ctx as McpToolContext, args, 'read', async (agent) => {
        await prisma.$transaction(async (tx) =>
          seedDefaultCategoriesForOwner(
            tx,
            agent.ownerType === 'user'
              ? { userId: agent.ownerId }
              : { houseId: agent.ownerId },
          ),
        );

        const categories = await prisma.category.findMany({
          where: categoryOwnerWhere(agent.ownerType, agent.ownerId),
          select: {
            id: true,
            name: true,
            parent_id: true,
            active: true,
          },
          orderBy: [{ parent_id: 'asc' }, { sort_order: 'asc' }, { name: 'asc' }],
        });

        return categories.map((category) => ({
          id: category.id,
          name: category.name,
          parent_id: category.parent_id,
          active: category.active,
          /** MiCasa usa un solo árbol por owner; aplica a gastos e ingresos. */
          usage: 'expense_and_income',
        }));
      }),
  );
}
