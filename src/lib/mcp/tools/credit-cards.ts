import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { todayCalendarDate } from '@/lib/calendar-dates';
import {
  createCreditCardPayment,
  createCreditCardForOwner,
  createCreditCardPurchase,
  getCreditCardByOwner,
  listCreditCardsByOwner,
  updateCreditCardForOwner,
} from '@/lib/finance/credit-card.service';
import { getCreditCardStatementByOwner } from '@/lib/finance/credit-card-statement.service';
import { getCreditCardReconciliationReport } from '@/lib/finance/credit-card-reconciliation.service';
import { computeCreditCardCycleReconciliation } from '@/lib/finance/credit-card-cycle-reconciliation';
import {
  buildInstallmentPortfolio,
  sumInstallmentExposure,
} from '@/lib/finance/credit-card-installment-portfolio';
import {
  createInstallmentPlan,
  listInstallmentPlansForCard,
  updateInstallmentPlan,
} from '@/lib/finance/credit-card-installment-plan.service';
import { upsertCreditCardPaymentPlan } from '@/lib/finance/credit-card-payment-plan.service';
import {
  createScheduledPayment,
  deleteScheduledPayment,
  listScheduledPaymentsForCard,
} from '@/lib/finance/credit-card-scheduled-payment.service';
import { FortnightPeriod } from '@/generated/prisma/client';
import { findFortnightByCalendarPeriod } from '@/features/monthly/server/monthly.queries';
import type { AgentContext } from '@/lib/server/resolve-agent-context';
import {
  confirmSchema,
  ownerIdSchema,
  ownerTypeSchema,
  runAgentTool,
  type McpToolContext,
} from '@/lib/mcp/tool-helpers';
import {
  calendarRangeBounds,
  resolveCategoryRef,
  resolveDateRange,
  resolveFortnightIdForDate,
  resolveWalletRef,
} from '@/lib/mcp/resolvers';
import {
  createCreditCardPurchaseSchema,
  normalizeCreditCardPaymentInput,
  createCreditCardPaymentSchema,
  createCreditCardSchema,
  updateCreditCardSchema,
} from '@/schemas/credit-card.schema';
import {
  createCreditCardInstallmentPlanSchema,
  updateCreditCardInstallmentPlanSchema,
} from '@/schemas/credit-card-installment-plan.schema';
import { createCreditCardScheduledPaymentSchema } from '@/schemas/credit-card-scheduled-payment.schema';
import { cardPaymentPlanSchema } from '@/schemas/credit-card-payment-plan.schema';

const ownerArgs = {
  ownerType: ownerTypeSchema,
  ownerId: ownerIdSchema,
};

const cardIdSchema = z
  .number()
  .int()
  .positive()
  .describe('Id de la tarjeta (billetera CREDIT_CARD o DEPARTMENT_STORE_CARD). Usa list_cards.');

const dateYmdSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato requerido: YYYY-MM-DD');

const periodSchema = z.enum(['FIRST', 'SECOND']);

const resolveFortnightIdFromArgs = async (
  agent: AgentContext,
  input: {
    fortnight_id?: number;
    year?: number;
    month?: number;
    period?: 'FIRST' | 'SECOND';
  },
): Promise<number> => {
  if (input.fortnight_id != null) {
    return input.fortnight_id;
  }
  if (input.year != null && input.month != null && input.period != null) {
    const parsedPeriod =
      input.period === 'SECOND'
        ? FortnightPeriod.SECOND
        : FortnightPeriod.FIRST;
    const fortnight = await findFortnightByCalendarPeriod(
      agent.ownerFilter,
      input.year,
      input.month,
      parsedPeriod,
    );
    if (!fortnight) {
      throw new Error('Quincena no encontrada');
    }
    return fortnight.id;
  }
  throw new Error('Indica fortnight_id o year + month + period');
};

type CardPaymentToolArgs = {
  card_id: number;
  mode?: 'external' | 'wallet';
  amount: number;
  paid_at?: string;
  note?: string;
  adjusts_debt?: boolean;
  source_wallet_id?: number;
  source_wallet_name?: string;
  create_fortnight_expense?: boolean;
  fortnight_id?: number;
  category_id?: number;
  category_name?: string;
  expense_description?: string;
};

const executeCardPayment = async (
  agent: AgentContext,
  args: CardPaymentToolArgs,
) => {
  const paidAt = args.paid_at ?? todayCalendarDate();
  const mode = args.mode ?? 'external';

  if (mode === 'external') {
    const input = normalizeCreditCardPaymentInput(
      createCreditCardPaymentSchema.parse({
        mode: 'external',
        amount: args.amount,
        paid_at: paidAt,
        note: args.note ?? null,
        adjusts_debt: args.adjusts_debt ?? true,
      }),
    );
    const payment = await createCreditCardPayment(
      args.card_id,
      agent.ownerFilter,
      input,
    );
    return {
      payment_id: payment.id,
      mode: 'external' as const,
      amount: payment.amount,
      paid_at: paidAt,
      adjusts_debt: args.adjusts_debt ?? true,
    };
  }

  const sourceWallet = await resolveWalletRef(
    agent.ownerFilter,
    args.source_wallet_id,
    args.source_wallet_name,
  );
  const categoryId =
    args.create_fortnight_expense === true
      ? await resolveCategoryRef(
          agent.ownerFilter,
          args.category_id,
          args.category_name,
          { required: true },
        )
      : undefined;

  const input = normalizeCreditCardPaymentInput(
    createCreditCardPaymentSchema.parse({
      mode: 'wallet',
      amount: args.amount,
      paid_at: paidAt,
      note: args.note ?? null,
      source_wallet_id: sourceWallet.id,
      create_fortnight_expense: args.create_fortnight_expense,
      fortnight_id: args.fortnight_id,
      category_id: categoryId,
      expense_description: args.expense_description ?? null,
    }),
  );
  const payment = await createCreditCardPayment(
    args.card_id,
    agent.ownerFilter,
    input,
  );

  return {
    payment_id: payment.id,
    mode: 'wallet' as const,
    amount: payment.amount,
    paid_at: paidAt,
    source_wallet_id: sourceWallet.id,
    source_wallet_name: sourceWallet.name,
    expense_id: payment.expense_id ?? null,
  };
};

export function registerCreditCardTools(server: McpServer) {
  server.registerTool(
    'list_cards',
    {
      title: 'Listar tarjetas de crédito',
      description:
        'Tarjetas de crédito y departamentales del contexto: deuda actual, límite, crédito disponible, día de corte y de pago.',
      inputSchema: z.object(ownerArgs),
      annotations: { readOnlyHint: true },
    },
    async (args, ctx) =>
      runAgentTool('list_cards', ctx as McpToolContext, args, 'read', async (agent) => {
        const cards = await listCreditCardsByOwner(agent.ownerFilter);
        return cards.map((card) => ({
          id: card.id,
          name: card.name,
          type: card.type,
          debt: card.amount,
          credit_limit: card.credit_limit,
          temporary_credit_limit: card.temporary_credit_limit,
          available_credit: card.available_credit,
          cutoff_day: card.cutoff_day,
          due_day: card.due_day,
          active: card.active,
        }));
      }),
  );

  server.registerTool(
    'get_card',
    {
      title: 'Detalle de una tarjeta',
      description:
        'Detalle completo de una tarjeta: deuda, límite, corte, estado de cuenta vigente, movimientos recientes, planes de cuotas (MSI) y pagos programados.',
      inputSchema: z.object({
        ...ownerArgs,
        card_id: cardIdSchema,
      }),
      annotations: { readOnlyHint: true },
    },
    async (args, ctx) =>
      runAgentTool('get_card', ctx as McpToolContext, args, 'read', async (agent) => {
        const card = await getCreditCardByOwner(args.card_id, agent.ownerFilter);

        let statement: Awaited<
          ReturnType<typeof getCreditCardStatementByOwner>
        > | null = null;
        try {
          statement = await getCreditCardStatementByOwner(
            args.card_id,
            agent.ownerFilter,
          );
        } catch {
          // Card without cutoff/due configured — summary only.
        }

        const [plans, scheduledPayments] = await Promise.all([
          listInstallmentPlansForCard(args.card_id, agent.ownerFilter),
          listScheduledPaymentsForCard(args.card_id, agent.ownerFilter),
        ]);

        return {
          card: {
            id: card.id,
            name: card.name,
            type: card.type,
            debt: card.amount,
            credit_limit: card.credit_limit,
            temporary_credit_limit: card.temporary_credit_limit,
            available_credit: card.available_credit,
            cutoff_day: card.cutoff_day,
            due_day: card.due_day,
            active: card.active,
          },
          statement: statement
            ? {
                statement_start: statement.statement_start,
                statement_end: statement.statement_end,
                statement_due_date: statement.statement_due_date,
                last_statement_balance: statement.last_statement_balance,
                payments_applied_to_statement:
                  statement.payments_applied_to_statement,
                next_due_payment: statement.next_due_payment,
                minimum_payment: statement.minimum_payment,
                current_cycle_purchases: statement.current_cycle_purchases,
                current_cycle_payments: statement.current_cycle_payments,
              }
            : null,
          recent_movements: statement
            ? [
                ...statement.current_cycle_purchase_items,
                ...statement.statement_purchases,
              ]
                .slice(0, 20)
                .map((item) => ({
                  id: item.id,
                  description: item.description,
                  amount: item.amount,
                  date: item.payment_date,
                  category: item.category,
                  installment:
                    item.credit_installment_current != null &&
                    item.credit_installment_total != null
                      ? `${item.credit_installment_current}/${item.credit_installment_total}`
                      : null,
                }))
            : [],
          recent_payments: statement
            ? statement.payment_history.slice(0, 10).map((payment) => ({
                id: payment.id,
                amount: payment.amount,
                paid_at: payment.paid_at,
                source: payment.source_wallet_name,
                note: payment.note,
              }))
            : [],
          installment_plans: plans,
          scheduled_payments: scheduledPayments,
        };
      }),
  );

  server.registerTool(
    'create_card',
    {
      title: 'Crear tarjeta de crédito',
      description:
        'Alta de tarjeta CREDIT_CARD o DEPARTMENT_STORE_CARD (mismo POST /api/credit-cards que la app).',
      inputSchema: z.object({
        ...ownerArgs,
        name: z.string().trim().min(1),
        type: z.enum(['CREDIT_CARD', 'DEPARTMENT_STORE_CARD']).default('CREDIT_CARD'),
        amount: z.number().min(0).default(0).describe('Deuda inicial / saldo utilizado.'),
        credit_limit: z.number().positive().optional(),
        cutoff_day: z.number().int().min(1).max(31),
        due_day: z.number().int().min(1).max(31),
        active: z.boolean().default(true),
      }),
      annotations: { destructiveHint: false, idempotentHint: false },
    },
    async (args, ctx) =>
      runAgentTool('create_card', ctx as McpToolContext, args, 'write', async (agent) => {
        const parsed = createCreditCardSchema.parse({
          name: args.name,
          type: args.type,
          amount: args.amount,
          credit_limit: args.credit_limit ?? null,
          cutoff_day: args.cutoff_day,
          due_day: args.due_day,
          active: args.active,
          include_in_liquidity: true,
          temporary_credit_limit: null,
          goal_amount: null,
          goal_due_date: null,
        });

        const card = await createCreditCardForOwner(
          agent.ownerType,
          agent.ownerId,
          parsed,
        );

        return {
          id: card.id,
          name: card.name,
          type: card.type,
          debt: card.amount,
          credit_limit: card.credit_limit,
          cutoff_day: card.cutoff_day,
          due_day: card.due_day,
        };
      }),
  );

  server.registerTool(
    'adjust_card_debt',
    {
      title: 'Ajustar deuda de tarjeta',
      description:
        'Alinea la deuda en libros con la del banco. No registra movimientos ni pagos: solo fija el saldo utilizado. Requiere confirm: true.',
      inputSchema: z.object({
        ...ownerArgs,
        card_id: cardIdSchema,
        new_debt: z
          .number()
          .min(0)
          .describe('Nueva deuda total de la tarjeta (saldo utilizado).'),
        confirm: confirmSchema,
      }),
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async (args, ctx) =>
      runAgentTool('adjust_card_debt', ctx as McpToolContext, args, 'write', async (agent) => {
        const input = updateCreditCardSchema.parse({ amount: args.new_debt });
        const card = await updateCreditCardForOwner(
          args.card_id,
          input,
          agent.ownerFilter,
        );
        return {
          id: card.id,
          name: card.name,
          debt: card.amount,
          available_credit: card.available_credit,
        };
      }),
  );

  server.registerTool(
    'update_card',
    {
      title: 'Actualizar tarjeta',
      description:
        'Actualiza metadatos de la tarjeta: nombre, día de corte, día de pago, límite de crédito o límite temporal (null lo quita).',
      inputSchema: z.object({
        ...ownerArgs,
        card_id: cardIdSchema,
        name: z.string().trim().min(1).optional(),
        cutoff_day: z.number().int().min(1).max(31).optional(),
        due_day: z.number().int().min(1).max(31).optional(),
        credit_limit: z.number().positive().optional(),
        temporary_credit_limit: z
          .number()
          .positive()
          .nullable()
          .optional()
          .describe('Límite temporal del emisor; null para quitarlo.'),
      }),
      annotations: { destructiveHint: false, idempotentHint: true },
    },
    async (args, ctx) =>
      runAgentTool('update_card', ctx as McpToolContext, args, 'write', async (agent) => {
        const input = updateCreditCardSchema.parse({
          ...(args.name != null ? { name: args.name } : {}),
          ...(args.cutoff_day != null ? { cutoff_day: args.cutoff_day } : {}),
          ...(args.due_day != null ? { due_day: args.due_day } : {}),
          ...(args.credit_limit != null
            ? { credit_limit: args.credit_limit }
            : {}),
          ...(args.temporary_credit_limit !== undefined
            ? { temporary_credit_limit: args.temporary_credit_limit }
            : {}),
        });
        const card = await updateCreditCardForOwner(
          args.card_id,
          input,
          agent.ownerFilter,
        );
        return {
          id: card.id,
          name: card.name,
          debt: card.amount,
          credit_limit: card.credit_limit,
          temporary_credit_limit: card.temporary_credit_limit,
          available_credit: card.available_credit,
          cutoff_day: card.cutoff_day,
          due_day: card.due_day,
        };
      }),
  );

  server.registerTool(
    'add_card_purchase',
    {
      title: 'Registrar compra con tarjeta',
      description:
        'Registra una compra en la tarjeta. Sube la deuda salvo already_in_balance: true (la compra ya está reflejada en el saldo del banco). La quincena se resuelve desde la fecha.',
      inputSchema: z.object({
        ...ownerArgs,
        card_id: cardIdSchema,
        description: z.string().trim().min(1).max(200),
        amount: z.number().positive(),
        purchase_date: dateYmdSchema
          .optional()
          .describe('Fecha de la compra (YYYY-MM-DD). Default: hoy (CDMX).'),
        category_id: z.number().int().positive().optional(),
        category_name: z
          .string()
          .trim()
          .min(1)
          .optional()
          .describe('Nombre de la categoría (alternativa a category_id).'),
        already_in_balance: z
          .boolean()
          .default(false)
          .describe('true si la compra ya está incluida en la deuda actual.'),
        installment_current: z.number().int().positive().optional(),
        installment_total: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Total de mensualidades (MSI); requiere installment_current.'),
      }),
      annotations: { destructiveHint: false, idempotentHint: false },
    },
    async (args, ctx) =>
      runAgentTool('add_card_purchase', ctx as McpToolContext, args, 'write', async (agent) => {
        const purchaseDate = args.purchase_date ?? todayCalendarDate();
        const [fortnightId, categoryId] = await Promise.all([
          resolveFortnightIdForDate(agent, purchaseDate),
          resolveCategoryRef(agent.ownerFilter, args.category_id, args.category_name, {
            required: true,
          }),
        ]);

        const input = createCreditCardPurchaseSchema.parse({
          fortnight_id: fortnightId,
          category_id: categoryId,
          description: args.description,
          amount: args.amount,
          payment_date: purchaseDate,
          already_in_card_balance: args.already_in_balance,
          credit_installment_current: args.installment_current ?? null,
          credit_installment_total: args.installment_total ?? null,
        });

        const purchase = await createCreditCardPurchase(
          args.card_id,
          agent.ownerFilter,
          input,
        );

        return {
          expense_id: purchase.id,
          description: purchase.description,
          amount: Number(purchase.amount),
          date: purchaseDate,
          already_in_balance: args.already_in_balance,
        };
      }),
  );

  server.registerTool(
    'add_card_payment',
    {
      title: 'Registrar pago de tarjeta',
      description:
        'Registra un pago de tarjeta. mode external: pago fuera de MiCasa (no descuenta billeteras). mode wallet: descuenta una billetera del contexto (mismo POST que la UI).',
      inputSchema: z
        .object({
          ...ownerArgs,
          card_id: cardIdSchema,
          mode: z
            .enum(['external', 'wallet'])
            .default('external')
            .describe(
              'external = pago ya hecho fuera; wallet = descuenta billetera MiCasa.',
            ),
          amount: z.number().positive(),
          paid_at: dateYmdSchema
            .optional()
            .describe('Fecha del pago (YYYY-MM-DD). Default: hoy (CDMX).'),
          note: z.string().trim().max(200).optional(),
          adjusts_debt: z
            .boolean()
            .default(true)
            .describe('Solo mode external: false si la deuda ya refleja el pago.'),
          source_wallet_id: z.number().int().positive().optional(),
          source_wallet_name: z
            .string()
            .trim()
            .min(1)
            .optional()
            .describe('Billetera origen (mode wallet).'),
          create_fortnight_expense: z
            .boolean()
            .optional()
            .describe('mode wallet: registrar gasto en quincena.'),
          fortnight_id: z.number().int().positive().optional(),
          category_id: z.number().int().positive().optional(),
          category_name: z.string().trim().min(1).optional(),
          expense_description: z.string().trim().max(200).optional(),
        })
        .superRefine((data, ctxRef) => {
          if (data.mode === 'wallet' && !data.source_wallet_id && !data.source_wallet_name) {
            ctxRef.addIssue({
              code: 'custom',
              message: 'mode wallet requiere source_wallet_id o source_wallet_name',
              path: ['source_wallet_id'],
            });
          }
          if (
            data.mode === 'wallet' &&
            data.create_fortnight_expense === true &&
            data.category_id == null &&
            !data.category_name
          ) {
            ctxRef.addIssue({
              code: 'custom',
              message: 'create_fortnight_expense requiere category_id o category_name',
              path: ['category_id'],
            });
          }
        }),
      annotations: { destructiveHint: false, idempotentHint: false },
    },
    async (args, ctx) =>
      runAgentTool('add_card_payment', ctx as McpToolContext, args, 'write', async (agent) => {
        const payment = await executeCardPayment(agent, args);
        return payment;
      }),
  );

  server.registerTool(
    'pay_card',
    {
      title: 'Pagar tarjeta desde billetera',
      description:
        'Paga una tarjeta descontando una billetera de efectivo/débito del contexto. Alias de add_card_payment con mode wallet.',
      inputSchema: z
        .object({
          ...ownerArgs,
          card_id: cardIdSchema,
          amount: z.number().positive(),
          paid_at: dateYmdSchema.optional(),
          note: z.string().trim().max(200).optional(),
          source_wallet_id: z.number().int().positive().optional(),
          source_wallet_name: z.string().trim().min(1).optional(),
          create_fortnight_expense: z.boolean().optional(),
          fortnight_id: z.number().int().positive().optional(),
          category_id: z.number().int().positive().optional(),
          category_name: z.string().trim().min(1).optional(),
          expense_description: z.string().trim().max(200).optional(),
        })
        .superRefine((data, ctxRef) => {
          if (!data.source_wallet_id && !data.source_wallet_name) {
            ctxRef.addIssue({
              code: 'custom',
              message: 'Indica source_wallet_id o source_wallet_name',
              path: ['source_wallet_id'],
            });
          }
          if (
            data.create_fortnight_expense === true &&
            data.category_id == null &&
            !data.category_name
          ) {
            ctxRef.addIssue({
              code: 'custom',
              message: 'create_fortnight_expense requiere category_id o category_name',
              path: ['category_id'],
            });
          }
        }),
      annotations: { destructiveHint: false, idempotentHint: false },
    },
    async (args, ctx) =>
      runAgentTool('pay_card', ctx as McpToolContext, args, 'write', async (agent) =>
        executeCardPayment(agent, { ...args, mode: 'wallet' as const }),
      ),
  );

  server.registerTool(
    'create_installment_plan',
    {
      title: 'Crear plan de cuotas (MSI)',
      description:
        'Crea un plan de meses sin intereses en la tarjeta. Sube la deuda por las cuotas restantes salvo already_in_balance: true.',
      inputSchema: z.object({
        ...ownerArgs,
        card_id: cardIdSchema,
        name: z.string().trim().min(1).max(120),
        installment_amount: z.number().positive(),
        total_installments: z.number().int().min(2).max(60),
        paid_installments: z.number().int().min(0).default(0),
        next_due_date: dateYmdSchema
          .optional()
          .describe('Próxima fecha de cuota; default derivado del día de pago.'),
        already_in_balance: z.boolean().default(false),
      }),
      annotations: { destructiveHint: false, idempotentHint: false },
    },
    async (args, ctx) =>
      runAgentTool('create_installment_plan', ctx as McpToolContext, args, 'write', async (agent) => {
        const input = createCreditCardInstallmentPlanSchema.parse({
          name: args.name,
          installment_amount: args.installment_amount,
          total_installments: args.total_installments,
          paid_installments: args.paid_installments,
          next_due_date: args.next_due_date,
          already_in_card_balance: args.already_in_balance,
        });
        return createInstallmentPlan(args.card_id, agent.ownerFilter, input);
      }),
  );

  server.registerTool(
    'update_installment_plan',
    {
      title: 'Actualizar plan de cuotas',
      description:
        'Actualiza un plan de cuotas existente (nombre, monto, total/pagadas, próxima fecha). Reajusta la deuda si cambia la estructura.',
      inputSchema: z.object({
        ...ownerArgs,
        card_id: cardIdSchema,
        plan_id: z.number().int().positive(),
        name: z.string().trim().min(1).max(120),
        installment_amount: z.number().positive(),
        total_installments: z.number().int().min(2).max(60),
        paid_installments: z.number().int().min(0),
        next_due_date: dateYmdSchema.optional(),
        already_in_balance: z.boolean().default(false),
      }),
      annotations: { destructiveHint: false, idempotentHint: true },
    },
    async (args, ctx) =>
      runAgentTool('update_installment_plan', ctx as McpToolContext, args, 'write', async (agent) => {
        const input = updateCreditCardInstallmentPlanSchema.parse({
          name: args.name,
          installment_amount: args.installment_amount,
          total_installments: args.total_installments,
          paid_installments: args.paid_installments,
          next_due_date: args.next_due_date,
          already_in_card_balance: args.already_in_balance,
        });
        return updateInstallmentPlan(
          args.plan_id,
          args.card_id,
          agent.ownerFilter,
          input,
        );
      }),
  );

  server.registerTool(
    'create_scheduled_payment',
    {
      title: 'Crear cuota programada de tarjeta',
      description:
        'Programa una cuota suelta en el calendario de la tarjeta (mismo POST que la UI de cuotas).',
      inputSchema: z.object({
        ...ownerArgs,
        card_id: cardIdSchema,
        due_date: dateYmdSchema,
        amount: z.number().positive(),
        label: z.string().trim().max(120).optional(),
      }),
      annotations: { destructiveHint: false, idempotentHint: false },
    },
    async (args, ctx) =>
      runAgentTool(
        'create_scheduled_payment',
        ctx as McpToolContext,
        args,
        'write',
        async (agent) => {
          const input = createCreditCardScheduledPaymentSchema.parse({
            due_date: args.due_date,
            amount: args.amount,
            label: args.label ?? null,
          });
          const item = await createScheduledPayment(
            args.card_id,
            agent.ownerFilter,
            input,
          );
          return item;
        },
      ),
  );

  server.registerTool(
    'upsert_card_payment_plan',
    {
      title: 'Planear pago de tarjeta en quincena',
      description:
        'Fija cuánto planeas pagar de una tarjeta en una quincena (mismo PUT que Panel financiero / calendario de tarjetas).',
      inputSchema: z
        .object({
          ...ownerArgs,
          card_id: cardIdSchema,
          planned_amount: z.number().positive(),
          fortnight_id: z.number().int().positive().optional(),
          year: z.number().int().min(2000).max(2100).optional(),
          month: z.number().int().min(1).max(12).optional(),
          period: periodSchema.optional(),
        })
        .superRefine((data, ctxRef) => {
          if (
            data.fortnight_id == null &&
            (data.year == null || data.month == null || data.period == null)
          ) {
            ctxRef.addIssue({
              code: 'custom',
              message: 'Indica fortnight_id o year + month + period',
              path: ['fortnight_id'],
            });
          }
        }),
      annotations: { destructiveHint: false, idempotentHint: true },
    },
    async (args, ctx) =>
      runAgentTool(
        'upsert_card_payment_plan',
        ctx as McpToolContext,
        args,
        'write',
        async (agent) => {
          const fortnightId = await resolveFortnightIdFromArgs(agent, args);
          const validated = cardPaymentPlanSchema.parse({
            walletId: args.card_id,
            plannedAmount: args.planned_amount,
          });
          const plan = await upsertCreditCardPaymentPlan(
            agent.ownerFilter,
            fortnightId,
            validated.walletId,
            validated.plannedAmount,
          );
          return {
            card_id: plan.credit_card_wallet_id,
            fortnight_id: plan.fortnight_id,
            planned_amount: Number(plan.planned_amount),
          };
        },
      ),
  );

  server.registerTool(
    'delete_scheduled_payment',
    {
      title: 'Eliminar cuota programada',
      description:
        'Elimina una cuota programada (no cubierta) del calendario de la tarjeta. Requiere confirm: true.',
      inputSchema: z.object({
        ...ownerArgs,
        card_id: cardIdSchema,
        payment_id: z.number().int().positive(),
        confirm: confirmSchema,
      }),
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async (args, ctx) =>
      runAgentTool('delete_scheduled_payment', ctx as McpToolContext, args, 'write', async (agent) => {
        await deleteScheduledPayment(
          args.payment_id,
          args.card_id,
          agent.ownerFilter,
        );
        return { deleted: true, payment_id: args.payment_id };
      }),
  );

  server.registerTool(
    'list_card_movements',
    {
      title: 'Movimientos de tarjeta por rango',
      description:
        'Lista compras, pagos e importaciones de una tarjeta en un rango de fechas o el ciclo actual.',
      inputSchema: z.object({
        ...ownerArgs,
        card_id: cardIdSchema,
        from: dateYmdSchema.optional(),
        to: dateYmdSchema.optional(),
        use_current_cycle: z
          .boolean()
          .default(false)
          .describe('true = ciclo de corte vigente en lugar de from/to.'),
      }),
      annotations: { readOnlyHint: true },
    },
    async (args, ctx) =>
      runAgentTool(
        'list_card_movements',
        ctx as McpToolContext,
        args,
        'read',
        async (agent) => {
          const statement = await getCreditCardStatementByOwner(
            args.card_id,
            agent.ownerFilter,
          );

          let from = args.from;
          let to = args.to;
          if (args.use_current_cycle || (!from && !to)) {
            from = statement.current_cycle_start.slice(0, 10);
            to = statement.current_cycle_end.slice(0, 10);
          }
          if (!from || !to) {
            const range = resolveDateRange({});
            from = range.from;
            to = range.to;
          }

          const inRange = (dateYmd: string) => dateYmd >= from! && dateYmd <= to!;

          const [scheduledPayments, installmentPlans] = await Promise.all([
            listScheduledPaymentsForCard(args.card_id, agent.ownerFilter),
            listInstallmentPlansForCard(args.card_id, agent.ownerFilter),
          ]);

          const purchaseMap = new Map<number, (typeof statement.statement_purchases)[number]>();
          for (const purchase of [
            ...statement.statement_purchases,
            ...statement.current_cycle_purchase_items,
            ...statement.installment_active_purchases,
          ]) {
            if (inRange(purchase.payment_date.slice(0, 10))) {
              purchaseMap.set(purchase.id, purchase);
            }
          }

          const movements = [
            ...[...purchaseMap.values()].map((purchase) => ({
              kind: 'purchase' as const,
              id: purchase.id,
              date: purchase.payment_date.slice(0, 10),
              description: purchase.description,
              amount: purchase.amount,
            })),
            ...statement.payment_history
              .filter((payment) => inRange(payment.paid_at.slice(0, 10)))
              .map((payment) => ({
                kind: 'payment' as const,
                id: payment.id,
                date: payment.paid_at.slice(0, 10),
                description: payment.note ?? `Pago ${payment.source_wallet_name}`,
                amount: payment.amount,
              })),
            ...scheduledPayments
              .filter(
                (row) =>
                  row.status === 'SCHEDULED' && inRange(row.dueDate.slice(0, 10)),
              )
              .map((row) => ({
                kind: 'scheduled_payment' as const,
                id: row.id,
                date: row.dueDate.slice(0, 10),
                description: row.label ?? 'Cuota programada',
                amount: row.amount,
              })),
            ...installmentPlans.flatMap((plan) =>
              plan.payments
                .filter(
                  (payment) =>
                    payment.status === 'SCHEDULED' &&
                    inRange(payment.dueDate.slice(0, 10)),
                )
                .map((payment) => ({
                  kind: 'installment' as const,
                  id: payment.id,
                  date: payment.dueDate.slice(0, 10),
                  description: `${plan.name} (${payment.sequence}/${plan.totalInstallments})`,
                  amount: payment.amount,
                })),
            ),
          ].sort((a, b) => a.date.localeCompare(b.date));

          return {
            card_id: args.card_id,
            from,
            to,
            movements,
          };
        },
      ),
  );

  server.registerTool(
    'get_card_reconciliation',
    {
      title: 'Reconciliación de tarjetas',
      description:
        'Reporte de inconsistencias en tarjetas de crédito del contexto (deuda, pagos huérfanos, planes obsoletos). Misma lógica que GET /api/credit-cards/reconciliation.',
      inputSchema: z.object({
        ...ownerArgs,
        card_id: cardIdSchema.optional().describe(
          'Filtra a una tarjeta. Omite para todas las tarjetas de crédito activas.',
        ),
      }),
      annotations: { readOnlyHint: true },
    },
    async (args, ctx) =>
      runAgentTool(
        'get_card_reconciliation',
        ctx as McpToolContext,
        args,
        'read',
        async (agent) =>
          getCreditCardReconciliationReport(agent.ownerFilter, args.card_id),
      ),
  );

  server.registerTool(
    'get_card_cycle_reconciliation',
    {
      title: 'Reconciliación del ciclo de tarjeta',
      description:
        'Compara saldo registrado vs esperado (ledger o total importado) para el ciclo vigente de una tarjeta. Misma lógica que la franja de reconciliación en detalle de tarjeta.',
      inputSchema: z.object({
        ...ownerArgs,
        card_id: cardIdSchema,
      }),
      annotations: { readOnlyHint: true },
    },
    async (args, ctx) =>
      runAgentTool(
        'get_card_cycle_reconciliation',
        ctx as McpToolContext,
        args,
        'read',
        async (agent) => {
          const statement = await getCreditCardStatementByOwner(
            args.card_id,
            agent.ownerFilter,
          );
          const reconciliation = computeCreditCardCycleReconciliation({
            lastStatementBalance: statement.last_statement_balance,
            paymentsAppliedToStatement: statement.payments_applied_to_statement,
            currentCyclePurchases: statement.current_cycle_purchases,
            currentCyclePayments: statement.current_cycle_payments,
            outstandingBalance: statement.outstanding_balance,
            importedStatementTotal: statement.imported_statement_total,
            importedMinimumPayment: statement.minimum_payment,
          });
          return {
            card_id: args.card_id,
            card_name: statement.name,
            statement_end: statement.statement_end,
            ...reconciliation,
          };
        },
      ),
  );

  server.registerTool(
    'get_installment_portfolio',
    {
      title: 'Portafolio MSI activo',
      description:
        'Cuotas MSI activas en una tarjeta: progreso, cuotas restantes y exposición. Misma proyección que la pestaña Cuotas / portafolio MSI en detalle de tarjeta.',
      inputSchema: z.object({
        ...ownerArgs,
        card_id: cardIdSchema,
      }),
      annotations: { readOnlyHint: true },
    },
    async (args, ctx) =>
      runAgentTool(
        'get_installment_portfolio',
        ctx as McpToolContext,
        args,
        'read',
        async (agent) => {
          const statement = await getCreditCardStatementByOwner(
            args.card_id,
            agent.ownerFilter,
          );
          const items = buildInstallmentPortfolio(statement.installment_active_purchases);
          return {
            card_id: args.card_id,
            card_name: statement.name,
            total_exposure: sumInstallmentExposure(items),
            item_count: items.length,
            items: items.map((item) => ({
              expense_id: item.purchase.id,
              description: item.purchase.description,
              installment_amount: item.purchase.amount,
              current_installment: item.currentInstallment,
              total_installments: item.totalInstallments,
              remaining_installments: item.remainingInstallments,
              progress_pct: item.progressPct,
              remaining_amount: item.remainingAmount,
              original_amount_estimate: item.originalAmountEstimate,
              payment_date: item.purchase.payment_date,
            })),
          };
        },
      ),
  );
}
