import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { deriveLegacyDueDayForTemplate } from '@/lib/finance/expense-template-due';
import {
  createExpenseTemplateForOwner,
  findExpenseTemplateForOwner,
  listExpenseTemplatesForOwner,
  updateExpenseTemplateForOwner,
} from '@/lib/finance/expense-template.service';
import {
  createIncomeTemplateForOwner,
  listIncomeTemplatesForOwner,
  updateIncomeTemplateForOwner,
} from '@/lib/finance/income-template.service';
import {
  createExpenseTemplateSchema,
  updateExpenseTemplateSchema,
} from '@/schemas/expense-template.schema';
import {
  createIncomeTemplateSchema,
  updateIncomeTemplateSchema,
} from '@/schemas/income-template.schema';
import type { AgentContext } from '@/lib/server/resolve-agent-context';
import { defineOwnerTool } from '@/lib/mcp/define-tool';
import { McpToolError } from '@/lib/mcp/errors';
import { categoryRef, pagination, walletRef } from '@/lib/mcp/schemas';
import { out, paginate } from '@/lib/mcp/shapes';
import { resolveCategoryRef, resolveWalletRef } from '@/lib/mcp/resolvers';

const formatExpenseTemplate = (template: {
  id: number;
  name: string;
  suggested_amount: unknown;
  active: boolean;
  due_day: number | null;
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
  wallet_id: number | null;
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
  wallet_id: template.wallet_id,
  applies_first_fortnight: template.applies_first_fortnight,
  applies_second_fortnight: template.applies_second_fortnight,
  active: template.active,
  user_id: template.user_id,
});

const templateKindSchema = z
  .enum(['expense', 'income'])
  .describe('expense = plantilla de gasto recurrente; income = plantilla de ingreso.');

const EXPENSE_ONLY_FIELDS = [
  'due_day_first',
  'due_day_second',
  'cutoff_day',
  'is_recurring',
  'is_subscription',
] as const;
const INCOME_ONLY_FIELDS = ['source'] as const;

const templateFields = {
  ...categoryRef,
  ...walletRef,
  suggested_amount: z.number().positive().nullable().optional().describe('Monto sugerido; null lo quita.'),
  active: z.boolean().optional().describe('Default true.'),
  applies_first_fortnight: z.boolean().optional().describe('Se expande en FIRST. Default false.'),
  applies_second_fortnight: z.boolean().optional().describe('Se expande en SECOND. Default false.'),
  due_day_first: z
    .number()
    .int()
    .min(1)
    .max(15)
    .nullable()
    .optional()
    .describe('Solo expense: día de pago en FIRST.'),
  due_day_second: z
    .number()
    .int()
    .min(16)
    .max(31)
    .nullable()
    .optional()
    .describe('Solo expense: día de pago en SECOND.'),
  cutoff_day: z
    .number()
    .int()
    .min(1)
    .max(31)
    .nullable()
    .optional()
    .describe('Solo expense: día de corte.'),
  is_recurring: z.boolean().optional().describe('Solo expense. Default true.'),
  is_subscription: z.boolean().optional().describe('Solo expense. Default false.'),
  source: z
    .string()
    .trim()
    .max(255)
    .nullable()
    .optional()
    .describe('Solo income: origen (p. ej. Nómina).'),
};

type TemplateArgs = {
  kind: 'expense' | 'income';
  name?: string;
  category_id?: number;
  category_name?: string;
  wallet_id?: number;
  wallet_name?: string;
  suggested_amount?: number | null;
  active?: boolean;
  applies_first_fortnight?: boolean;
  applies_second_fortnight?: boolean;
  due_day_first?: number | null;
  due_day_second?: number | null;
  cutoff_day?: number | null;
  is_recurring?: boolean;
  is_subscription?: boolean;
  source?: string | null;
};

/** Rejects fields of the other template kind. */
const assertFieldsForTemplateKind = (args: TemplateArgs) => {
  const foreign = (args.kind === 'expense' ? INCOME_ONLY_FIELDS : EXPENSE_ONLY_FIELDS).filter(
    (field) => args[field] !== undefined,
  );
  if (foreign.length > 0) {
    throw new McpToolError(
      'VALIDATION',
      `${foreign.join(', ')} no aplica a plantillas de tipo ${args.kind}`,
    );
  }
};

const createExpenseTemplate = async (agent: AgentContext, args: TemplateArgs & { name: string }) => {
  const categoryId = await resolveCategoryRef(
    agent.ownerFilter,
    args.category_id,
    args.category_name,
    { required: true },
  );

  let walletId: number | undefined;
  if (args.wallet_id != null || args.wallet_name) {
    walletId = (
      await resolveWalletRef(agent.ownerFilter, args.wallet_id, args.wallet_name)
    ).id;
  }

  const validated = createExpenseTemplateSchema.parse({
    name: args.name,
    categoryId,
    suggestedAmount: args.suggested_amount ?? undefined,
    paymentMethodId: walletId,
    active: args.active ?? true,
    dueDayFirst: args.due_day_first ?? null,
    dueDaySecond: args.due_day_second ?? null,
    cutoffDay: args.cutoff_day ?? null,
    isRecurring: args.is_recurring ?? true,
    appliesFirstFortnight: args.applies_first_fortnight ?? false,
    appliesSecondFortnight: args.applies_second_fortnight ?? false,
    isSubscription: args.is_subscription ?? false,
  });

  return formatExpenseTemplate(await createExpenseTemplateForOwner(agent, validated));
};

/**
 * The update schema is the full create schema, so unspecified fields are
 * filled from the stored template before calling the shared service.
 */
const updateExpenseTemplate = async (
  agent: AgentContext,
  templateId: number,
  args: TemplateArgs,
) => {
  const existing = await findExpenseTemplateForOwner(templateId, agent.ownerFilter);

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
      await resolveWalletRef(agent.ownerFilter, undefined, args.wallet_name)
    ).id;
  }

  const validated = updateExpenseTemplateSchema.parse({
    name: args.name ?? existing.name,
    categoryId,
    suggestedAmount:
      args.suggested_amount ??
      (existing.suggested_amount ? Number(existing.suggested_amount) : undefined),
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
    cutoffDay: args.cutoff_day !== undefined ? args.cutoff_day : existing.cutoff_day,
    isRecurring: args.is_recurring ?? existing.is_recurring,
    appliesFirstFortnight:
      args.applies_first_fortnight ?? existing.applies_first_fortnight,
    appliesSecondFortnight:
      args.applies_second_fortnight ?? existing.applies_second_fortnight,
    isSubscription: args.is_subscription ?? existing.is_subscription,
  });

  return formatExpenseTemplate(
    await updateExpenseTemplateForOwner(templateId, agent.ownerFilter, validated),
  );
};

const resolveIncomeWalletId = async (
  agent: AgentContext,
  args: TemplateArgs,
): Promise<number | null | undefined> => {
  if (args.wallet_id !== undefined) return args.wallet_id;
  if (!args.wallet_name) return undefined;
  return (await resolveWalletRef(agent.ownerFilter, undefined, args.wallet_name)).id;
};

const createIncomeTemplate = async (agent: AgentContext, args: TemplateArgs & { name: string }) => {
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
    walletId: (await resolveIncomeWalletId(agent, args)) ?? null,
    appliesFirstFortnight: args.applies_first_fortnight ?? false,
    appliesSecondFortnight: args.applies_second_fortnight ?? false,
    active: args.active ?? true,
  });

  return formatIncomeTemplate(await createIncomeTemplateForOwner(agent, validated));
};

const updateIncomeTemplate = async (
  agent: AgentContext,
  templateId: number,
  args: TemplateArgs,
) => {
  const categoryId =
    args.category_id != null || args.category_name
      ? await resolveCategoryRef(agent.ownerFilter, args.category_id, args.category_name, {
          required: true,
        })
      : undefined;
  const walletId = await resolveIncomeWalletId(agent, args);

  const validated = updateIncomeTemplateSchema.parse({
    ...(args.name != null ? { name: args.name } : {}),
    ...(args.suggested_amount !== undefined ? { suggestedAmount: args.suggested_amount } : {}),
    ...(args.source !== undefined ? { source: args.source } : {}),
    ...(categoryId != null ? { categoryId } : {}),
    ...(walletId !== undefined ? { walletId } : {}),
    ...(args.applies_first_fortnight !== undefined
      ? { appliesFirstFortnight: args.applies_first_fortnight }
      : {}),
    ...(args.applies_second_fortnight !== undefined
      ? { appliesSecondFortnight: args.applies_second_fortnight }
      : {}),
    ...(args.active !== undefined ? { active: args.active } : {}),
  });

  return formatIncomeTemplate(await updateIncomeTemplateForOwner(templateId, agent, validated));
};

export function registerTemplateTools(server: McpServer) {
  defineOwnerTool(server, {
    name: 'list_templates',
    title: 'Listar plantillas',
    description:
      'Plantillas recurrentes de gasto y/o ingreso; applies_first_fortnight / applies_second_fortnight deciden en qué quincena las expande create_month.',
    scope: 'read',
    input: {
      kind: z
        .enum(['expense', 'income', 'all'])
        .default('all')
        .describe('expense, income o all (default).'),
      ...pagination,
    },
    output: {
      templates: out.list({
        kind: z.enum(['expense', 'income']),
        id: z.number(),
        name: z.string(),
        suggested_amount: out.nullableMoney,
      }),
      ...out.page,
    },
    run: async (agent, args) => {
      const [expenseTemplates, incomeTemplates] = await Promise.all([
        args.kind === 'income' ? [] : listExpenseTemplatesForOwner(agent.ownerFilter),
        args.kind === 'expense' ? [] : listIncomeTemplatesForOwner(agent.ownerFilter),
      ]);
      const rows = [
        ...expenseTemplates.map((t) => ({ kind: 'expense' as const, ...formatExpenseTemplate(t) })),
        ...incomeTemplates.map((t) => ({ kind: 'income' as const, ...formatIncomeTemplate(t) })),
      ];
      return paginate('templates', rows, args);
    },
  });

  defineOwnerTool(server, {
    name: 'create_template',
    title: 'Crear plantilla',
    description:
      'Alta de plantilla de gasto (kind expense: días de pago, corte, suscripción) o de ingreso (kind income: source). La billetera es opcional en ambas (en ingresos, solo efectivo/débito).',
    scope: 'write',
    annotations: { destructiveHint: false, idempotentHint: false },
    input: {
      kind: templateKindSchema,
      name: z.string().trim().min(1).describe('Nombre.'),
      ...templateFields,
    },
    run: async (agent, args) => {
      assertFieldsForTemplateKind(args);
      return args.kind === 'expense'
        ? createExpenseTemplate(agent, args)
        : createIncomeTemplate(agent, args);
    },
  });

  defineOwnerTool(server, {
    name: 'update_template',
    title: 'Actualizar plantilla',
    description:
      'Edita una plantilla de gasto o de ingreso; solo cambian los campos enviados. Para borrarla usa delete con kind expense_template o income_template.',
    scope: 'write',
    annotations: { destructiveHint: false, idempotentHint: true },
    input: {
      kind: templateKindSchema,
      template_id: z.number().int().positive().describe('Id de list_templates.'),
      name: z.string().trim().min(1).optional().describe('Nuevo nombre.'),
      ...templateFields,
    },
    run: async (agent, args) => {
      assertFieldsForTemplateKind(args);
      return args.kind === 'expense'
        ? updateExpenseTemplate(agent, args.template_id, args)
        : updateIncomeTemplate(agent, args.template_id, args);
    },
  });
}
