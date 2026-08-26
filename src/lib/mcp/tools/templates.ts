import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import type { McpServer } from '@modelcontextprotocol/server';
import prisma from '@/lib/prisma';
import { deriveLegacyDueDayForTemplate } from '@/lib/finance/expense-template-due';
import {
  assertOwnedCategoryOfKind,
  CategoryServiceError,
} from '@/lib/finance/category.service';
import {
  createExpenseTemplateSchema,
  updateExpenseTemplateSchema,
} from '@/schemas/expense-template.schema';
import {
  createIncomeTemplateSchema,
  updateIncomeTemplateSchema,
} from '@/schemas/income-template.schema';
import {
  confirmSchema,
  ownerIdSchema,
  ownerTypeSchema,
  runAgentTool,
  type McpToolContext,
} from '@/lib/mcp/tool-helpers';
import { resolveCategoryRef, resolveWalletRef } from '@/lib/mcp/resolvers';

const ownerArgs = {
  ownerType: ownerTypeSchema,
  ownerId: ownerIdSchema,
};

const prismaDueFieldsFromPayload = (validated: {
  dueDayFirst?: number | null | undefined;
  dueDaySecond?: number | null | undefined;
}) => {
  const first = validated.dueDayFirst ?? null;
  const second = validated.dueDaySecond ?? null;
  return {
    due_day_first_fortnight: first,
    due_day_second_fortnight: second,
    due_day: first ?? second ?? null,
  };
};

const formatExpenseTemplate = (template: {
  id: number;
  name: string;
  suggested_amount: unknown;
  active: boolean;
  due_day_first_fortnight: number | null;
  due_day_second_fortnight: number | null;
  cutoff_day: number | null;
  is_recurring: boolean;
  applies_first_fortnight: boolean;
  applies_second_fortnight: boolean;
  is_subscription: boolean;
  category: { name: string; icon: string | null } | null;
  wallet: { id: number; name: string } | null;
}) => ({
  id: template.id,
  name: template.name,
  category: template.category?.name ?? null,
  category_icon: template.category?.icon ?? null,
  suggested_amount: template.suggested_amount
    ? Number(template.suggested_amount)
    : null,
  wallet_id: template.wallet?.id ?? null,
  wallet_name: template.wallet?.name ?? null,
  active: template.active,
  due_day_first: template.due_day_first_fortnight,
  due_day_second: template.due_day_second_fortnight,
  due_day: deriveLegacyDueDayForTemplate(template),
  cutoff_day: template.cutoff_day,
  is_recurring: template.is_recurring,
  applies_first_fortnight: template.applies_first_fortnight,
  applies_second_fortnight: template.applies_second_fortnight,
  is_subscription: template.is_subscription,
});

const formatIncomeTemplate = (template: {
  id: number;
  name: string;
  suggested_amount: unknown;
  source: string | null;
  category_id: number | null;
  applies_first_fortnight: boolean;
  applies_second_fortnight: boolean;
  active: boolean;
  user_id: number | null;
  category: { id: number; name: string; icon: string | null } | null;
  user: { id: number; name: string } | null;
}) => ({
  id: template.id,
  name: template.name,
  suggested_amount: template.suggested_amount
    ? Number(template.suggested_amount)
    : null,
  source: template.source,
  category_id: template.category_id,
  category_name: template.category?.name ?? null,
  category_icon: template.category?.icon ?? null,
  applies_first_fortnight: template.applies_first_fortnight,
  applies_second_fortnight: template.applies_second_fortnight,
  active: template.active,
  user_id: template.user_id,
});

export function registerTemplateTools(server: McpServer) {
  server.registerTool(
    'list_expense_templates',
    {
      title: 'Listar plantillas de gasto',
      description:
        'Plantillas recurrentes de gasto con flags applies_first_fortnight / applies_second_fortnight.',
      inputSchema: z.object(ownerArgs),
      annotations: { readOnlyHint: true },
    },
    async (args, ctx) =>
      runAgentTool(
        'list_expense_templates',
        ctx as McpToolContext,
        args,
        'read',
        async (agent) => {
          const templates = await prisma.expenseTemplate.findMany({
            where: agent.ownerFilter,
            include: {
              category: { select: { name: true, icon: true } },
              wallet: { select: { id: true, name: true } },
            },
            orderBy: [{ active: 'desc' }, { name: 'asc' }],
          });
          return { templates: templates.map(formatExpenseTemplate) };
        },
      ),
  );

  server.registerTool(
    'create_expense_template',
    {
      title: 'Crear plantilla de gasto',
      description:
        'Alta de plantilla de gasto (mismo POST /api/expense-templates). Flags FIRST/SECOND controlan en qué quincena se expande.',
      inputSchema: z.object({
        ...ownerArgs,
        name: z.string().trim().min(1),
        category_id: z.number().int().positive().optional(),
        category_name: z.string().trim().min(1).optional(),
        wallet_id: z.number().int().positive().optional(),
        wallet_name: z.string().trim().min(1).optional(),
        suggested_amount: z.number().positive().optional(),
        active: z.boolean().default(true),
        applies_first_fortnight: z.boolean().default(false),
        applies_second_fortnight: z.boolean().default(false),
        due_day_first: z.number().int().min(1).max(15).optional().nullable(),
        due_day_second: z.number().int().min(16).max(31).optional().nullable(),
        cutoff_day: z.number().int().min(1).max(31).optional().nullable(),
        is_recurring: z.boolean().default(true),
        is_subscription: z.boolean().default(false),
      }),
      annotations: { destructiveHint: false, idempotentHint: false },
    },
    async (args, ctx) =>
      runAgentTool(
        'create_expense_template',
        ctx as McpToolContext,
        args,
        'write',
        async (agent) => {
          const categoryId = await resolveCategoryRef(
            agent.ownerFilter,
            args.category_id,
            args.category_name,
            { required: true },
          );

          let walletId: number | undefined;
          if (args.wallet_id != null || args.wallet_name) {
            walletId = (
              await resolveWalletRef(
                agent.ownerFilter,
                args.wallet_id,
                args.wallet_name,
              )
            ).id;
          }

          const validated = createExpenseTemplateSchema.parse({
            name: args.name,
            categoryId,
            suggestedAmount: args.suggested_amount,
            paymentMethodId: walletId,
            active: args.active,
            dueDayFirst: args.due_day_first ?? null,
            dueDaySecond: args.due_day_second ?? null,
            cutoffDay: args.cutoff_day ?? null,
            isRecurring: args.is_recurring,
            appliesFirstFortnight: args.applies_first_fortnight,
            appliesSecondFortnight: args.applies_second_fortnight,
            isSubscription: args.is_subscription,
          });

          const dueFields = prismaDueFieldsFromPayload(validated);
          const template = await prisma.expenseTemplate.create({
            data: {
              name: validated.name,
              category_id: validated.categoryId,
              suggested_amount: validated.suggestedAmount
                ? validated.suggestedAmount.toString()
                : null,
              wallet_id: validated.paymentMethodId ?? undefined,
              active: validated.active ?? true,
              ...dueFields,
              cutoff_day: validated.cutoffDay ?? null,
              is_recurring: validated.isRecurring,
              applies_first_fortnight: validated.appliesFirstFortnight,
              applies_second_fortnight: validated.appliesSecondFortnight,
              is_subscription: validated.isSubscription,
              user_id: agent.ownerType === 'user' ? agent.ownerId : null,
              house_id: agent.ownerType === 'house' ? agent.ownerId : null,
            },
            include: {
              category: { select: { name: true, icon: true } },
              wallet: { select: { id: true, name: true } },
            },
          });

          return formatExpenseTemplate(template);
        },
      ),
  );

  server.registerTool(
    'update_expense_template',
    {
      title: 'Actualizar plantilla de gasto',
      description: 'Edita plantilla de gasto (mismo PUT /api/expense-templates).',
      inputSchema: z.object({
        ...ownerArgs,
        template_id: z.number().int().positive(),
        name: z.string().trim().min(1).optional(),
        category_id: z.number().int().positive().optional(),
        category_name: z.string().trim().min(1).optional(),
        wallet_id: z.number().int().positive().optional().nullable(),
        wallet_name: z.string().trim().min(1).optional(),
        suggested_amount: z.number().positive().optional(),
        active: z.boolean().optional(),
        applies_first_fortnight: z.boolean().optional(),
        applies_second_fortnight: z.boolean().optional(),
        due_day_first: z.number().int().min(1).max(15).optional().nullable(),
        due_day_second: z.number().int().min(16).max(31).optional().nullable(),
        cutoff_day: z.number().int().min(1).max(31).optional().nullable(),
        is_recurring: z.boolean().optional(),
        is_subscription: z.boolean().optional(),
      }),
      annotations: { destructiveHint: false, idempotentHint: true },
    },
    async (args, ctx) =>
      runAgentTool(
        'update_expense_template',
        ctx as McpToolContext,
        args,
        'write',
        async (agent) => {
          const existing = await prisma.expenseTemplate.findFirst({
            where: { id: args.template_id, ...agent.ownerFilter },
          });
          if (!existing) {
            throw new Error('Plantilla de gasto no encontrada');
          }

          let categoryId = existing.category_id;
          if (args.category_id != null || args.category_name) {
            categoryId =
              (await resolveCategoryRef(
                agent.ownerFilter,
                args.category_id,
                args.category_name,
                { required: true },
              )) ?? categoryId;
          }

          let walletId: number | null | undefined;
          if (args.wallet_id !== undefined) {
            walletId = args.wallet_id;
          } else if (args.wallet_name) {
            walletId = (
              await resolveWalletRef(
                agent.ownerFilter,
                undefined,
                args.wallet_name,
              )
            ).id;
          }

          const validated = updateExpenseTemplateSchema.parse({
            name: args.name ?? existing.name,
            categoryId,
            suggestedAmount:
              args.suggested_amount ??
              (existing.suggested_amount
                ? Number(existing.suggested_amount)
                : undefined),
            paymentMethodId: walletId === undefined ? existing.wallet_id : walletId,
            active: args.active ?? existing.active,
            dueDayFirst:
              args.due_day_first !== undefined
                ? args.due_day_first
                : existing.due_day_first_fortnight,
            dueDaySecond:
              args.due_day_second !== undefined
                ? args.due_day_second
                : existing.due_day_second_fortnight,
            cutoffDay:
              args.cutoff_day !== undefined ? args.cutoff_day : existing.cutoff_day,
            isRecurring: args.is_recurring ?? existing.is_recurring,
            appliesFirstFortnight:
              args.applies_first_fortnight ?? existing.applies_first_fortnight,
            appliesSecondFortnight:
              args.applies_second_fortnight ?? existing.applies_second_fortnight,
            isSubscription: args.is_subscription ?? existing.is_subscription,
          });

          const updateData: Prisma.ExpenseTemplateUncheckedUpdateInput = {
            name: validated.name,
            category_id: validated.categoryId,
            suggested_amount: validated.suggestedAmount?.toString(),
            wallet_id: validated.paymentMethodId ?? null,
            active: validated.active,
            ...prismaDueFieldsFromPayload(validated),
            cutoff_day: validated.cutoffDay ?? null,
            is_recurring: validated.isRecurring,
            applies_first_fortnight: validated.appliesFirstFortnight,
            applies_second_fortnight: validated.appliesSecondFortnight,
            is_subscription: validated.isSubscription,
          };

          const template = await prisma.expenseTemplate.update({
            where: { id: args.template_id },
            data: updateData,
            include: {
              category: { select: { name: true, icon: true } },
              wallet: { select: { id: true, name: true } },
            },
          });

          return formatExpenseTemplate(template);
        },
      ),
  );

  server.registerTool(
    'delete_expense_template',
    {
      title: 'Eliminar plantilla de gasto',
      description:
        'Elimina plantilla y desvincula gastos generados. Requiere confirm: true.',
      inputSchema: z.object({
        ...ownerArgs,
        template_id: z.number().int().positive(),
        confirm: confirmSchema,
      }),
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async (args, ctx) =>
      runAgentTool(
        'delete_expense_template',
        ctx as McpToolContext,
        args,
        'write',
        async (agent) => {
          const existing = await prisma.expenseTemplate.findFirst({
            where: { id: args.template_id, ...agent.ownerFilter },
          });
          if (!existing) {
            throw new Error('Plantilla de gasto no encontrada');
          }

          const result = await prisma.$transaction(async (tx) => {
            const detached = await tx.expense.updateMany({
              where: { expense_template_id: args.template_id },
              data: { expense_template_id: null },
            });
            await tx.expenseTemplate.delete({ where: { id: args.template_id } });
            return detached.count;
          });

          return {
            deleted: true,
            template_id: args.template_id,
            detached_expense_count: result,
          };
        },
      ),
  );

  server.registerTool(
    'list_income_templates',
    {
      title: 'Listar plantillas de ingreso',
      description:
        'Plantillas de ingreso con flags applies_first_fortnight / applies_second_fortnight.',
      inputSchema: z.object(ownerArgs),
      annotations: { readOnlyHint: true },
    },
    async (args, ctx) =>
      runAgentTool(
        'list_income_templates',
        ctx as McpToolContext,
        args,
        'read',
        async (agent) => {
          const templates = await prisma.incomeTemplate.findMany({
            where: agent.ownerFilter,
            include: {
              category: { select: { id: true, name: true, icon: true } },
              user: { select: { id: true, name: true } },
            },
            orderBy: { name: 'asc' },
          });
          return { templates: templates.map(formatIncomeTemplate) };
        },
      ),
  );

  server.registerTool(
    'create_income_template',
    {
      title: 'Crear plantilla de ingreso',
      description:
        'Alta de plantilla de ingreso (mismo POST /api/income-templates).',
      inputSchema: z.object({
        ...ownerArgs,
        name: z.string().trim().min(1),
        category_id: z.number().int().positive().optional(),
        category_name: z.string().trim().min(1).optional(),
        suggested_amount: z.number().positive().optional().nullable(),
        source: z.string().trim().max(255).optional().nullable(),
        applies_first_fortnight: z.boolean().default(false),
        applies_second_fortnight: z.boolean().default(false),
        active: z.boolean().default(true),
      }),
      annotations: { destructiveHint: false, idempotentHint: false },
    },
    async (args, ctx) =>
      runAgentTool(
        'create_income_template',
        ctx as McpToolContext,
        args,
        'write',
        async (agent) => {
          const categoryId = await resolveCategoryRef(
            agent.ownerFilter,
            args.category_id,
            args.category_name,
            { required: true },
          );

          const validated = createIncomeTemplateSchema.parse({
            name: args.name,
            categoryId,
            suggestedAmount: args.suggested_amount ?? null,
            source: args.source ?? null,
            appliesFirstFortnight: args.applies_first_fortnight,
            appliesSecondFortnight: args.applies_second_fortnight,
            active: args.active,
          });

          try {
            await assertOwnedCategoryOfKind(
              prisma,
              agent.ownerType,
              agent.ownerId,
              validated.categoryId,
              'INCOME',
            );
          } catch (error) {
            if (error instanceof CategoryServiceError) {
              throw new Error(error.message);
            }
            throw error;
          }

          const template = await prisma.incomeTemplate.create({
            data: {
              name: validated.name,
              suggested_amount: validated.suggestedAmount
                ? validated.suggestedAmount.toString()
                : null,
              source: validated.source ?? null,
              category_id: validated.categoryId,
              applies_first_fortnight: validated.appliesFirstFortnight,
              applies_second_fortnight: validated.appliesSecondFortnight,
              active: validated.active ?? true,
              user_id: agent.ownerType === 'user' ? agent.ownerId : null,
              house_id: agent.ownerType === 'house' ? agent.ownerId : null,
            },
            include: {
              category: { select: { id: true, name: true, icon: true } },
              user: { select: { id: true, name: true } },
            },
          });

          return formatIncomeTemplate(template);
        },
      ),
  );

  server.registerTool(
    'update_income_template',
    {
      title: 'Actualizar plantilla de ingreso',
      description: 'Edita plantilla de ingreso (mismo PUT /api/income-templates).',
      inputSchema: z.object({
        ...ownerArgs,
        template_id: z.number().int().positive(),
        name: z.string().trim().min(1).optional(),
        category_id: z.number().int().positive().optional(),
        category_name: z.string().trim().min(1).optional(),
        suggested_amount: z.number().positive().optional().nullable(),
        source: z.string().trim().max(255).optional().nullable(),
        applies_first_fortnight: z.boolean().optional(),
        applies_second_fortnight: z.boolean().optional(),
        active: z.boolean().optional(),
      }),
      annotations: { destructiveHint: false, idempotentHint: true },
    },
    async (args, ctx) =>
      runAgentTool(
        'update_income_template',
        ctx as McpToolContext,
        args,
        'write',
        async (agent) => {
          const existing = await prisma.incomeTemplate.findFirst({
            where: { id: args.template_id, ...agent.ownerFilter },
          });
          if (!existing) {
            throw new Error('Plantilla de ingresos no encontrada');
          }

          const validated = updateIncomeTemplateSchema.parse({
            ...(args.name != null ? { name: args.name } : {}),
            ...(args.suggested_amount !== undefined
              ? { suggestedAmount: args.suggested_amount }
              : {}),
            ...(args.source !== undefined ? { source: args.source } : {}),
            ...(args.applies_first_fortnight !== undefined
              ? { appliesFirstFortnight: args.applies_first_fortnight }
              : {}),
            ...(args.applies_second_fortnight !== undefined
              ? { appliesSecondFortnight: args.applies_second_fortnight }
              : {}),
            ...(args.active !== undefined ? { active: args.active } : {}),
          });

          let categoryId = existing.category_id;
          if (args.category_id != null || args.category_name) {
            categoryId =
              (await resolveCategoryRef(
                agent.ownerFilter,
                args.category_id,
                args.category_name,
                { required: true },
              )) ?? categoryId;
            validated.categoryId = categoryId ?? undefined;
          }

          if (validated.categoryId != null) {
            await assertOwnedCategoryOfKind(
              prisma,
              agent.ownerType,
              agent.ownerId,
              validated.categoryId,
              'INCOME',
            );
          }

          const updateData: Record<string, unknown> = {};
          if (validated.name !== undefined) updateData.name = validated.name;
          if (validated.suggestedAmount !== undefined) {
            updateData.suggested_amount =
              validated.suggestedAmount === null
                ? null
                : validated.suggestedAmount.toString();
          }
          if (validated.source !== undefined) updateData.source = validated.source;
          if (validated.categoryId !== undefined) {
            updateData.category_id = validated.categoryId;
          } else if (categoryId != null) {
            updateData.category_id = categoryId;
          }
          if (validated.appliesFirstFortnight !== undefined) {
            updateData.applies_first_fortnight = validated.appliesFirstFortnight;
          }
          if (validated.appliesSecondFortnight !== undefined) {
            updateData.applies_second_fortnight = validated.appliesSecondFortnight;
          }
          if (validated.active !== undefined) updateData.active = validated.active;

          const template = await prisma.incomeTemplate.update({
            where: { id: args.template_id },
            data: updateData,
            include: {
              category: { select: { id: true, name: true, icon: true } },
              user: { select: { id: true, name: true } },
            },
          });

          return formatIncomeTemplate(template);
        },
      ),
  );

  server.registerTool(
    'delete_income_template',
    {
      title: 'Eliminar plantilla de ingreso',
      description:
        'Elimina plantilla de ingreso si no está en uso. Requiere confirm: true.',
      inputSchema: z.object({
        ...ownerArgs,
        template_id: z.number().int().positive(),
        confirm: confirmSchema,
      }),
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async (args, ctx) =>
      runAgentTool(
        'delete_income_template',
        ctx as McpToolContext,
        args,
        'write',
        async (agent) => {
          const existing = await prisma.incomeTemplate.findFirst({
            where: { id: args.template_id, ...agent.ownerFilter },
          });
          if (!existing) {
            throw new Error('Plantilla de ingresos no encontrada');
          }

          const relatedIncome = await prisma.income.findFirst({
            where: { income_template_id: args.template_id },
          });
          if (relatedIncome) {
            throw new Error('La plantilla de ingresos está en uso y no puede eliminarse');
          }

          await prisma.incomeTemplate.delete({ where: { id: args.template_id } });

          return { deleted: true, template_id: args.template_id };
        },
      ),
  );
}
