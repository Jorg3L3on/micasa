import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { CategoryKind } from '@/generated/prisma/client';
import {
  createCategoryForOwner,
  listCategoriesForOwner,
  updateCategoryForOwner,
} from '@/lib/finance/category.service';
import { defineOwnerTool } from '@/lib/mcp/define-tool';

const categoryKindFilterSchema = z
  .enum(['expense', 'income', 'all'])
  .optional()
  .default('all');

const categoryKindInputSchema = z
  .enum(['EXPENSE', 'INCOME'])
  .optional()
  .default('EXPENSE');

const serializeCategory = (category: {
  id: number;
  name: string;
  description: string | null;
  icon: string | null;
  active: boolean;
  sort_order: number;
  parent_id: number | null;
  kind: CategoryKind;
}) => ({
  id: category.id,
  name: category.name,
  description: category.description,
  icon: category.icon,
  active: category.active,
  sort_order: category.sort_order,
  parent_id: category.parent_id,
  kind: category.kind,
});

export function registerCategoryTools(server: McpServer) {
  defineOwnerTool(server, {
    name: 'list_categories',
    title: 'Listar categorías',
    description:
      'Catálogo de categorías del contexto (crea las predeterminadas si faltan). Filtra por kind expense|income|all. Usa los nombres o ids en add_expense / add_income.',
    scope: 'read',
    input: { kind: categoryKindFilterSchema },
    run: async (agent, args) => {
      const categories = await listCategoriesForOwner(agent.ownerType, agent.ownerId, args.kind);
      return categories.map(serializeCategory);
    },
  });

  defineOwnerTool(server, {
    name: 'create_category',
    title: 'Crear categoría',
    description:
      'Alta de categoría de gasto (EXPENSE) o ingreso (INCOME). Opcional parent_id para subcategoría (un nivel).',
    scope: 'write',
    annotations: { destructiveHint: false, idempotentHint: false },
    input: {
      name: z.string().trim().min(1).max(80),
      description: z.string().trim().max(200).optional(),
      icon: z.string().optional(),
      parent_id: z.number().int().positive().nullable().optional(),
      kind: categoryKindInputSchema,
    },
    run: async (agent, args) => {
      const category = await createCategoryForOwner(agent.ownerType, agent.ownerId, {
        name: args.name,
        description: args.description,
        icon: args.icon,
        parentId: args.parent_id,
        kind: args.kind,
      });
      return serializeCategory(category);
    },
  });

  defineOwnerTool(server, {
    name: 'update_category',
    title: 'Actualizar categoría',
    description:
      'Edita nombre, descripción, icono o active. Desactivar una raíz desactiva sus subcategorías. Para borrarla usa delete con kind category.',
    scope: 'write',
    annotations: { destructiveHint: false, idempotentHint: true },
    input: {
      category_id: z.number().int().positive(),
      name: z.string().trim().min(1).max(80).optional(),
      description: z.string().trim().max(200).nullable().optional(),
      icon: z.string().optional(),
      active: z.boolean().optional(),
    },
    run: async (agent, args) => {
      const category = await updateCategoryForOwner(
        agent.ownerType,
        agent.ownerId,
        args.category_id,
        {
          name: args.name,
          description: args.description,
          icon: args.icon,
          active: args.active,
        },
      );
      return serializeCategory(category);
    },
  });
}
