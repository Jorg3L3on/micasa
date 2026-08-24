import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { todayCalendarDate } from '@/lib/calendar-dates';
import {
  createCreditCardPayment,
  createCreditCardPurchase,
  getCreditCardByOwner,
  listCreditCardsByOwner,
  updateCreditCardForOwner,
} from '@/lib/finance/credit-card.service';
import { getCreditCardStatementByOwner } from '@/lib/finance/credit-card-statement.service';
import {
  createInstallmentPlan,
  listInstallmentPlansForCard,
  updateInstallmentPlan,
} from '@/lib/finance/credit-card-installment-plan.service';
import {
  deleteScheduledPayment,
  listScheduledPaymentsForCard,
} from '@/lib/finance/credit-card-scheduled-payment.service';
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
} from '@/lib/mcp/resolvers';
import {
  createCreditCardPurchaseSchema,
  normalizeCreditCardPaymentInput,
  createCreditCardPaymentSchema,
  updateCreditCardSchema,
} from '@/schemas/credit-card.schema';
import {
  createCreditCardInstallmentPlanSchema,
  updateCreditCardInstallmentPlanSchema,
} from '@/schemas/credit-card-installment-plan.schema';

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
      title: 'Registrar pago de tarjeta (externo)',
      description:
        'Registra un pago ya hecho fuera de MiCasa (transferencia bancaria, efectivo). Baja la deuda de la tarjeta salvo adjusts_debt: false (el pago ya está reflejado en el saldo). NO descuenta de ninguna billetera de MiCasa.',
      inputSchema: z.object({
        ...ownerArgs,
        card_id: cardIdSchema,
        amount: z.number().positive(),
        paid_at: dateYmdSchema
          .optional()
          .describe('Fecha del pago (YYYY-MM-DD). Default: hoy (CDMX).'),
        note: z.string().trim().max(200).optional(),
        adjusts_debt: z
          .boolean()
          .default(true)
          .describe('false si la deuda actual ya refleja este pago.'),
      }),
      annotations: { destructiveHint: false, idempotentHint: false },
    },
    async (args, ctx) =>
      runAgentTool('add_card_payment', ctx as McpToolContext, args, 'write', async (agent) => {
        const input = normalizeCreditCardPaymentInput(
          createCreditCardPaymentSchema.parse({
            mode: 'external',
            amount: args.amount,
            paid_at: args.paid_at ?? todayCalendarDate(),
            note: args.note ?? null,
            adjusts_debt: args.adjusts_debt,
          }),
        );
        const payment = await createCreditCardPayment(
          args.card_id,
          agent.ownerFilter,
          input,
        );
        return {
          payment_id: payment.id,
          amount: payment.amount,
          paid_at: args.paid_at ?? todayCalendarDate(),
          adjusts_debt: args.adjusts_debt,
        };
      }),
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
}
