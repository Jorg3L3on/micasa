import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { CategoryKind } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { validateCategoryIconInput } from '@/lib/category-icons';
import {
  seedDefaultExpenseCategoriesForOwner,
  seedDefaultIncomeCategoriesForOwner,
} from '@/lib/finance/category-seed.service';
import {
  activateCategory,
  assertValidParentForCreate,
  categoryOwnerWhere,
  deactivateCategoryTree,
  findDuplicateCategoryName,
} from '@/lib/finance/category.service';
import { defineOwnerTool } from '@/lib/mcp/define-tool';
import { McpToolError } from '@/lib/mcp/errors';

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
      const ownerRef =
        agent.ownerType === 'user'
          ? { userId: agent.ownerId }
          : { houseId: agent.ownerId };

      await prisma.$transaction(async (tx) => {
        if (args.kind === 'expense' || args.kind === 'all') {
          await seedDefaultExpenseCategoriesForOwner(tx, ownerRef);
        }
        if (args.kind === 'income' || args.kind === 'all') {
          await seedDefaultIncomeCategoriesForOwner(tx, ownerRef);
        }
      });

      const kindFilter =
        args.kind === 'all'
          ? {}
          : { kind: (args.kind === 'income' ? 'INCOME' : 'EXPENSE') as CategoryKind };

      const categories = await prisma.category.findMany({
        where: {
          ...categoryOwnerWhere(agent.ownerType, agent.ownerId),
          ...kindFilter,
        },
        select: {
          id: true,
          name: true,
          description: true,
          icon: true,
          active: true,
          sort_order: true,
          parent_id: true,
          kind: true,
        },
        orderBy: [{ parent_id: 'asc' }, { sort_order: 'asc' }, { name: 'asc' }],
      });

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
      const kind = args.kind;
      const iconResult = validateCategoryIconInput(args.icon, null);
      if (!iconResult.ok) {
        throw new Error(iconResult.message);
      }

      const parentId = args.parent_id ?? null;
      await assertValidParentForCreate(
        prisma,
        agent.ownerType,
        agent.ownerId,
        parentId,
        kind,
      );

      const duplicate = await findDuplicateCategoryName(
        prisma,
        agent.ownerType,
        agent.ownerId,
        args.name,
        kind,
      );
      if (duplicate) {
        throw new Error('Ya existe una categoría con este nombre');
      }

      const siblingCount = await prisma.category.count({
        where: {
          ...categoryOwnerWhere(agent.ownerType, agent.ownerId),
          parent_id: parentId,
          kind,
        },
      });

      const category = await prisma.category.create({
        data: {
          name: args.name,
          description: args.description ?? null,
          icon: iconResult.value,
          active: true,
          sort_order: siblingCount,
          parent_id: parentId,
          kind,
          ...(agent.ownerType === 'user'
            ? { user_id: agent.ownerId, house_id: null }
            : { user_id: null, house_id: agent.ownerId }),
        },
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
      const existing = await prisma.category.findFirst({
        where: {
          id: args.category_id,
          ...categoryOwnerWhere(agent.ownerType, agent.ownerId),
        },
      });
      if (!existing) {
        throw new McpToolError('NOT_FOUND', 'Categoría no encontrada', {
          hint: 'Usa list_categories para ver los ids válidos.',
        });
      }

      const iconResult = validateCategoryIconInput(args.icon, existing.icon);
      if (!iconResult.ok) {
        throw new Error(iconResult.message);
      }

      if (args.name && args.name !== existing.name) {
        const duplicate = await findDuplicateCategoryName(
          prisma,
          agent.ownerType,
          agent.ownerId,
          args.name,
          existing.kind,
          args.category_id,
        );
        if (duplicate) {
          throw new Error('Ya existe una categoría con este nombre');
        }
      }

      if (args.active === false && existing.active) {
        const category = await deactivateCategoryTree(
          prisma,
          args.category_id,
          agent.ownerType,
          agent.ownerId,
        );
        return serializeCategory(category);
      }

      if (args.active === true && !existing.active) {
        const category = await activateCategory(
          prisma,
          args.category_id,
          agent.ownerType,
          agent.ownerId,
        );
        return serializeCategory(category);
      }

      const updateData: {
        name?: string;
        description?: string | null;
        icon?: string | null;
      } = {};
      if (args.name) updateData.name = args.name;
      if (args.description !== undefined) {
        updateData.description = args.description;
      }
      if (args.icon !== undefined) updateData.icon = iconResult.value;

      const category = await prisma.category.update({
        where: { id: args.category_id },
        data: updateData,
      });

      return serializeCategory(category);
    },
  });
}
