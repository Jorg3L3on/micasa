import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { CategoryKind } from '@/generated/prisma/client';
import {
  createCategoryForOwner,
  listCategoriesForOwner,
  updateCategoryForOwner,
} from '@/lib/finance/category.service';
import { defineOwnerTool } from '@/lib/mcp/define-tool';
import { pagination } from '@/lib/mcp/schemas';
import { out, paginate } from '@/lib/mcp/shapes';

const categoryKindFilterSchema = z
  .enum(['expense', 'income', 'all'])
  .optional()
  .default('all')
  .describe('expense, income o all (default).');

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
    input: { kind: categoryKindFilterSchema, ...pagination },
    output: {
      categories: out.list({
        id: z.number(),
        name: z.string(),
        kind: z.string(),
        parent_id: z.number().nullable(),
      }),
      ...out.page,
    },
    run: async (agent, args) => {
      const categories = await listCategoriesForOwner(agent.ownerType, agent.ownerId, args.kind);
      return paginate('categories', categories.map(serializeCategory), args);
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
      name: z.string().trim().min(1).max(80).describe('Nombre.'),
      description: z.string().trim().max(200).optional().describe('Descripción opcional.'),
      icon: z.string().optional().describe('Clave de icono opcional.'),
      parent_id: z.number().int().positive().nullable().optional().describe('Categoría padre (un solo nivel).'),
      kind: categoryKindInputSchema.describe('EXPENSE (default) o INCOME.'),
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
      category_id: z.number().int().positive().describe('Categoría, de list_categories.'),
      name: z.string().trim().min(1).max(80).optional().describe('Nuevo nombre.'),
      description: z.string().trim().max(200).nullable().optional().describe('null la borra.'),
      icon: z.string().optional().describe('Clave de icono.'),
      active: z.boolean().optional().describe('false desactiva la categoría y sus subcategorías.'),
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
