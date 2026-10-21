import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { todayCalendarDate } from '@/lib/calendar-dates';
import {
  createCreditCardPayment,
  getCreditCardByOwner,
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
  listScheduledPaymentsForCard,
} from '@/lib/finance/credit-card-scheduled-payment.service';
import type { AgentContext } from '@/lib/server/resolve-agent-context';
import { defineOwnerTool } from '@/lib/mcp/define-tool';
import { McpToolError } from '@/lib/mcp/errors';
import { categoryRef, dateYmd, fortnightRef } from '@/lib/mcp/schemas';
import {
  resolveCategoryRef,
  resolveDateRange,
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

const cardIdSchema = z
  .number()
  .int()
  .positive()
  .describe('Tarjeta, de list_wallets (type credit).');

const CARD_SECTIONS = [
  'statement',
  'movements',
  'installments',
  'reconciliation',
  'cycle_reconciliation',
] as const;

type CardSection = (typeof CARD_SECTIONS)[number];

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
export async function listCardMovements(
  agent: AgentContext,
  cardId: number,
  input: { from?: string; to?: string; use_current_cycle?: boolean },
) {
  const statement = await getCreditCardStatementByOwner(cardId, agent.ownerFilter);

  let from = input.from;
  let to = input.to;
  if (input.use_current_cycle || (!from && !to)) {
    from = statement.current_cycle_start.slice(0, 10);
    to = statement.current_cycle_end.slice(0, 10);
  }
  if (!from || !to) {
    const range = resolveDateRange({ from, to });
    from = range.from;
    to = range.to;
  }

  const inRange = (dateYmd: string) => dateYmd >= from! && dateYmd <= to!;

  const [scheduledPayments, installmentPlans] = await Promise.all([
    listScheduledPaymentsForCard(cardId, agent.ownerFilter),
    listInstallmentPlansForCard(cardId, agent.ownerFilter),
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
        (row) => row.status === 'SCHEDULED' && inRange(row.dueDate.slice(0, 10)),
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
            payment.status === 'SCHEDULED' && inRange(payment.dueDate.slice(0, 10)),
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
    balance: statement.outstanding_balance,
    from,
    to,
    movements,
  };
}

type CardStatement = Awaited<ReturnType<typeof getCreditCardStatementByOwner>>;

const loadStatementOrNull = async (
  cardId: number,
  agent: AgentContext,
): Promise<CardStatement | null> => {
  try {
    return await getCreditCardStatementByOwner(cardId, agent.ownerFilter);
  } catch {
    // Card without cutoff/due configured — summary only.
    return null;
  }
};

const requireStatement = (statement: CardStatement | null, section: CardSection) => {
  if (!statement) {
    throw new McpToolError(
      'VALIDATION',
      `La sección ${section} necesita día de corte y de pago en la tarjeta.`,
      { hint: 'Configúralos con update_wallet (cutoff_day, due_day).' },
    );
  }
  return statement;
};

const statementSection = (statement: CardStatement) => ({
  statement_start: statement.statement_start,
  statement_end: statement.statement_end,
  statement_due_date: statement.statement_due_date,
  last_statement_balance: statement.last_statement_balance,
  payments_applied_to_statement: statement.payments_applied_to_statement,
  next_due_payment:
    statement.period_obligation?.confidence === 'missing'
      ? null
      : statement.next_due_payment,
  period_obligation: statement.period_obligation ?? null,
  minimum_payment: statement.minimum_payment,
  current_cycle_purchases: statement.current_cycle_purchases,
  current_cycle_payments: statement.current_cycle_payments,
});

const movementsSection = (statement: CardStatement) => ({
  recent_movements: [
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
    })),
  recent_payments: statement.payment_history.slice(0, 10).map((payment) => ({
    id: payment.id,
    amount: payment.amount,
    paid_at: payment.paid_at,
    source: payment.source_wallet_name,
    note: payment.note,
  })),
});

const installmentPortfolioSection = (statement: CardStatement) => {
  const items = buildInstallmentPortfolio(statement.installment_active_purchases);
  return {
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
};

const cycleReconciliationSection = (statement: CardStatement) => ({
  statement_end: statement.statement_end,
  ...computeCreditCardCycleReconciliation({
    lastStatementBalance: statement.last_statement_balance,
    paymentsAppliedToStatement: statement.payments_applied_to_statement,
    currentCyclePurchases: statement.current_cycle_purchases,
    currentCyclePayments: statement.current_cycle_payments,
    outstandingBalance: statement.outstanding_balance,
    importedStatementTotal: statement.imported_statement_total,
    importedMinimumPayment: statement.minimum_payment,
  }),
});

export function registerCreditCardTools(server: McpServer) {
  defineOwnerTool(server, {
    name: 'get_card',
    title: 'Detalle de una tarjeta',
    description:
      'Deuda, límite y corte de una tarjeta, más las secciones de include: statement (estado de cuenta vigente), movements (compras y pagos recientes), installments (planes MSI, cuotas programadas, portafolio MSI), reconciliation (deuda inconsistente, pagos huérfanos, planes obsoletos), cycle_reconciliation (saldo registrado vs esperado del ciclo).',
    scope: 'read',
    input: {
      card_id: cardIdSchema,
      include: z
        .array(z.enum(CARD_SECTIONS))
        .min(1)
        .default(['statement'])
        .describe('Secciones a incluir (default ["statement"]).'),
    },
    run: async (agent, args) => {
      const card = await getCreditCardByOwner(args.card_id, agent.ownerFilter);
      const include = new Set<CardSection>(args.include);
      const needsStatement =
        include.has('statement') ||
        include.has('movements') ||
        include.has('installments') ||
        include.has('cycle_reconciliation');
      const statement = needsStatement ? await loadStatementOrNull(args.card_id, agent) : null;

      const result: Record<string, unknown> = {
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
      };

      if (include.has('statement')) {
        result.statement = statement ? statementSection(statement) : null;
      }
      if (include.has('movements')) {
        Object.assign(
          result,
          statement ? movementsSection(statement) : { recent_movements: [], recent_payments: [] },
        );
      }
      if (include.has('installments')) {
        const [plans, scheduledPayments] = await Promise.all([
          listInstallmentPlansForCard(args.card_id, agent.ownerFilter),
          listScheduledPaymentsForCard(args.card_id, agent.ownerFilter),
        ]);
        result.installment_plans = plans;
        result.scheduled_payments = scheduledPayments;
        result.installment_portfolio = statement
          ? installmentPortfolioSection(statement)
          : null;
      }
      if (include.has('reconciliation')) {
        result.reconciliation = await getCreditCardReconciliationReport(
          agent.ownerFilter,
          args.card_id,
        );
      }
      if (include.has('cycle_reconciliation')) {
        result.cycle_reconciliation = cycleReconciliationSection(
          requireStatement(statement, 'cycle_reconciliation'),
        );
      }

      return result;
    },
  });

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
      amount: z.number().positive(),
      paid_at: dateYmd.optional().describe('Fecha del pago (YYYY-MM-DD). Default: hoy (CDMX).'),
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
      ...categoryRef,
      expense_description: z.string().trim().max(200).optional(),
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
      name: z.string().trim().min(1).max(120),
      installment_amount: z.number().positive(),
      total_installments: z.number().int().min(2).max(60),
      paid_installments: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe('Cuotas ya pagadas. Default 0 al crear; obligatorio al actualizar.'),
      next_due_date: dateYmd
        .optional()
        .describe('Próxima fecha de cuota; default derivado del día de pago.'),
      already_in_balance: z.boolean().default(false),
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
      amount: z.number().positive(),
      label: z.string().trim().max(120).optional(),
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
      planned_amount: z.number().positive(),
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
