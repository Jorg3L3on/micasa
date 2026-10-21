import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { getCreditCardByOwner } from '@/lib/finance/credit-card.service';
import { getCreditCardStatementByOwner } from '@/lib/finance/credit-card-statement.service';
import { getCreditCardReconciliationReport } from '@/lib/finance/credit-card-reconciliation.service';
import { computeCreditCardCycleReconciliation } from '@/lib/finance/credit-card-cycle-reconciliation';
import {
  buildInstallmentPortfolio,
  sumInstallmentExposure,
} from '@/lib/finance/credit-card-installment-portfolio';
import { listInstallmentPlansForCard } from '@/lib/finance/credit-card-installment-plan.service';
import { listScheduledPaymentsForCard } from '@/lib/finance/credit-card-scheduled-payment.service';
import type { AgentContext } from '@/lib/server/resolve-agent-context';
import { defineOwnerTool } from '@/lib/mcp/define-tool';
import { McpToolError } from '@/lib/mcp/errors';
import { cardIdSchema } from '@/lib/mcp/tools/credit-cards/shared';

const CARD_SECTIONS = [
  'statement',
  'movements',
  'installments',
  'reconciliation',
  'cycle_reconciliation',
] as const;

type CardSection = (typeof CARD_SECTIONS)[number];

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

const RECENT_MOVEMENTS_LIMIT = 20;
const RECENT_PAYMENTS_LIMIT = 10;

const movementsSection = (statement: CardStatement) => ({
  recent_movements: [
    ...statement.current_cycle_purchase_items,
    ...statement.statement_purchases,
  ]
    .slice(0, RECENT_MOVEMENTS_LIMIT)
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
  recent_payments: statement.payment_history.slice(0, RECENT_PAYMENTS_LIMIT).map((payment) => ({
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

/** get_card: card summary plus the sections requested in `include`. */
export function registerCardReadTools(server: McpServer) {
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
}
