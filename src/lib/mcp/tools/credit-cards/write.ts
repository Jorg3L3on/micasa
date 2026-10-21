import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { todayCalendarDate } from '@/lib/calendar-dates';
import { createCreditCardPayment } from '@/lib/finance/credit-card.service';
import {
  createInstallmentPlan,
  updateInstallmentPlan,
} from '@/lib/finance/credit-card-installment-plan.service';
import { upsertCreditCardPaymentPlan } from '@/lib/finance/credit-card-payment-plan.service';
import { createScheduledPayment } from '@/lib/finance/credit-card-scheduled-payment.service';
import type { AgentContext } from '@/lib/server/resolve-agent-context';
import { defineOwnerTool } from '@/lib/mcp/define-tool';
import { McpToolError } from '@/lib/mcp/errors';
import { categoryRef, dateYmd, fortnightRef } from '@/lib/mcp/schemas';
import {
  resolveCategoryRef,
  resolveFortnightRef,
  resolveWalletRef,
} from '@/lib/mcp/resolvers';
import {
  normalizeCreditCardPaymentInput,
  createCreditCardPaymentSchema,
} from '@/schemas/credit-card.schema';
import {
  createCreditCardInstallmentPlanSchema,
  updateCreditCardInstallmentPlanSchema,
} from '@/schemas/credit-card-installment-plan.schema';
import { createCreditCardScheduledPaymentSchema } from '@/schemas/credit-card-scheduled-payment.schema';
import { cardPaymentPlanSchema } from '@/schemas/credit-card-payment-plan.schema';
import { cardIdSchema } from '@/lib/mcp/tools/credit-cards/shared';

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

  if (args.source_wallet_id == null && !args.source_wallet_name) {
    throw new McpToolError(
      'VALIDATION',
      'mode wallet requiere source_wallet_id o source_wallet_name',
    );
  }
  const sourceWallet = await resolveWalletRef(
    agent.ownerFilter,
    args.source_wallet_id,
    args.source_wallet_name,
  );
  const categoryId =
    args.create_fortnight_expense === true &&
    (args.category_id != null || args.category_name)
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

/**
 * Purchases, payments, scheduled payments and installments of a card in a
 * date range (default: the current cutoff cycle). Used by `list_movements`.
 */
/** Card writes: payments, MSI plans, scheduled payments and fortnight payment plans. */
export function registerCardWriteTools(server: McpServer) {
  defineOwnerTool(server, {
    name: 'add_card_payment',
    title: 'Registrar pago de tarjeta',
    description:
      'Registra un pago de tarjeta. mode external: pago hecho fuera de MiCasa (no descuenta billeteras). mode wallet: descuenta una billetera de efectivo/débito del contexto y puede registrar el gasto en la quincena.',
    scope: 'write',
    annotations: { destructiveHint: false, idempotentHint: false },
    input: {
      card_id: cardIdSchema,
      mode: z
        .enum(['external', 'wallet'])
        .default('external')
        .describe('external = pago ya hecho fuera; wallet = descuenta billetera MiCasa.'),
      amount: z.number().positive().describe('Monto pagado en MXN.'),
      paid_at: dateYmd.optional().describe('Fecha del pago (YYYY-MM-DD). Default: hoy (CDMX).'),
      note: z.string().trim().max(200).optional().describe('Nota opcional.'),
      adjusts_debt: z
        .boolean()
        .default(true)
        .describe('Solo mode external: false si la deuda ya refleja el pago.'),
      source_wallet_id: z.number().int().positive().optional().describe('mode wallet: billetera que paga, de list_wallets.'),
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
      fortnight_id: z.number().int().positive().optional().describe('mode wallet: quincena del gasto; default la de paid_at.'),
      ...categoryRef,
      expense_description: z.string().trim().max(200).optional().describe('mode wallet: concepto del gasto en la quincena.'),
    },
    run: (agent, args) => executeCardPayment(agent, args),
  });

  defineOwnerTool(server, {
    name: 'upsert_installment_plan',
    title: 'Crear o actualizar plan de cuotas (MSI)',
    description:
      'Sin plan_id crea un plan de meses sin intereses en la tarjeta y sube la deuda por las cuotas restantes (salvo already_in_balance: true). Con plan_id actualiza ese plan y reajusta la deuda si cambia la estructura.',
    scope: 'write',
    annotations: { destructiveHint: false, idempotentHint: false },
    input: {
      card_id: cardIdSchema,
      plan_id: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Plan a actualizar (de get_card include installments). Omítelo para crear.'),
      name: z.string().trim().min(1).max(120).describe('Nombre del plan (p. ej. Laptop 12 MSI).'),
      installment_amount: z.number().positive().describe('Mensualidad en MXN.'),
      total_installments: z.number().int().min(2).max(60).describe('Total de mensualidades.'),
      paid_installments: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe('Cuotas ya pagadas. Default 0 al crear; obligatorio al actualizar.'),
      next_due_date: dateYmd
        .optional()
        .describe('Próxima fecha de cuota; default derivado del día de pago.'),
      already_in_balance: z.boolean().default(false).describe('true si la deuda ya incluye las cuotas restantes.'),
      issuer_remaining_balance: z
        .number()
        .positive()
        .nullable()
        .optional()
        .describe(
          'Saldo restante del emisor si no es mensualidad × cuotas. La última cuota absorbe los centavos.',
        ),
    },
    run: async (agent, args) => {
      const fields = {
        name: args.name,
        installment_amount: args.installment_amount,
        total_installments: args.total_installments,
        next_due_date: args.next_due_date,
        already_in_card_balance: args.already_in_balance,
        issuer_remaining_balance: args.issuer_remaining_balance,
      };

      if (args.plan_id == null) {
        const input = createCreditCardInstallmentPlanSchema.parse({
          ...fields,
          paid_installments: args.paid_installments ?? 0,
        });
        return createInstallmentPlan(args.card_id, agent.ownerFilter, input);
      }

      if (args.paid_installments == null) {
        throw new McpToolError(
          'VALIDATION',
          'paid_installments es obligatorio al actualizar un plan',
        );
      }
      const input = updateCreditCardInstallmentPlanSchema.parse({
        ...fields,
        paid_installments: args.paid_installments,
      });
      return updateInstallmentPlan(args.plan_id, args.card_id, agent.ownerFilter, input);
    },
  });

  defineOwnerTool(server, {
    name: 'create_scheduled_payment',
    title: 'Crear cuota programada de tarjeta',
    description:
      'Programa una cuota suelta en el calendario de la tarjeta. Para borrarla usa delete con kind scheduled_payment.',
    scope: 'write',
    annotations: { destructiveHint: false, idempotentHint: false },
    input: {
      card_id: cardIdSchema,
      due_date: dateYmd,
      amount: z.number().positive().describe('Monto de la cuota.'),
      label: z.string().trim().max(120).optional().describe('Etiqueta opcional.'),
    },
    run: async (agent, args) => {
      const input = createCreditCardScheduledPaymentSchema.parse({
        due_date: args.due_date,
        amount: args.amount,
        label: args.label ?? null,
      });
      return createScheduledPayment(args.card_id, agent.ownerFilter, input);
    },
  });

  defineOwnerTool(server, {
    name: 'upsert_card_payment_plan',
    title: 'Planear pago de tarjeta en quincena',
    description:
      'Fija cuánto planeas pagar de una tarjeta en una quincena (como Panel financiero y el calendario de tarjetas).',
    scope: 'write',
    annotations: { destructiveHint: false, idempotentHint: true },
    input: {
      card_id: cardIdSchema,
      planned_amount: z.number().positive().describe('Monto a pagar en la quincena.'),
      scope: z
        .enum(['this_cycle', 'n_cycles', 'until_date'])
        .optional()
        .describe('Vigencia del pago planeado. this_cycle (default), n_cycles o until_date.'),
      cycle_count: z
        .number()
        .int()
        .min(1)
        .max(36)
        .optional()
        .describe('Cortes que cubre el plan cuando scope es n_cycles.'),
      valid_until: dateYmd
        .optional()
        .describe('Fecha inclusive cuando scope es until_date (YYYY-MM-DD).'),
      ...fortnightRef,
    },
    run: async (agent, args) => {
      const fortnightId = await resolveFortnightRef(agent, args);
      const validated = cardPaymentPlanSchema.parse({
        walletId: args.card_id,
        plannedAmount: args.planned_amount,
        scope: args.scope ?? 'this_cycle',
        cycleCount: args.cycle_count,
        validUntil: args.valid_until,
      });
      // Schema allows a missing amount only when declareZero is set.
      // This tool always sends a positive plan, so a missing amount stays
      // an error instead of becoming a stored $0.
      const plannedAmount = validated.plannedAmount;
      if (plannedAmount == null) {
        throw new McpToolError(
          'VALIDATION',
          'El monto planeado debe ser mayor a 0, o declara que este ciclo es $0.',
        );
      }
      const plan = await upsertCreditCardPaymentPlan(
        agent.ownerFilter,
        fortnightId,
        validated.walletId,
        plannedAmount,
        {
          scope: validated.scope ?? 'this_cycle',
          cycleCount: validated.cycleCount,
          validUntil: validated.validUntil,
        },
      );
      return {
        card_id: plan.credit_card_wallet_id,
        fortnight_id: plan.fortnight_id,
        planned_amount: Number(plan.planned_amount),
        scope: validated.scope ?? 'this_cycle',
        cycle_count: validated.cycleCount ?? null,
        valid_until: validated.validUntil ?? null,
      };
    },
  });
}
