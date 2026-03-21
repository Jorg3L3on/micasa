import prisma from '@/lib/prisma';
import { PaymentMethodType, FortnightPeriod } from '@/generated/prisma/client';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import {
  computeObligationBreakdownFromLedger,
  loadCreditCardActivityLedger,
  resolveCreditCardStatementWindow,
} from '@/lib/finance/credit-card-statement.service';
import { isFundingWalletType } from '@/lib/finance/wallet-accounting';
import {
  addDaysUtc,
  compareUtcDateOnly,
  DEFAULT_PROJECTION_HORIZON_DAYS,
  LIQUIDITY_MAX_CYCLES_PER_CARD_GROUP,
  LIQUIDITY_PROJECTION_ASSUMPTIONS_ES,
  advanceStatementCursor,
  toUtcDateOnlyString,
} from '@/lib/finance/liquidity-projection';

export type LiquidityObligationSource =
  | 'credit_card_statement'
  | 'unpaid_expense'
  | 'expense_template';

export type LiquidityObligationItem = {
  source: LiquidityObligationSource;
  wallet_id: number;
  wallet_name: string;
  wallet_type: string;
  statement_start: string;
  statement_end: string;
  statement_due_date: string;
  last_statement_balance: number;
  payments_applied_to_statement: number;
  next_due_payment: number;
  stress_adjustment?: number;
  expense_id?: number;
  expense_description?: string;
  expense_template_id?: number;
  template_name?: string;
  is_estimate?: boolean;
  fortnight_id?: number;
};

export type LiquidityMilestone = {
  due_date: string;
  is_past_due: boolean;
  obligations: LiquidityObligationItem[];
  total_due: number;
  cumulative_due_through_date: number;
  funding_total: number;
  liquidity_headroom: number;
};

export type LiquidityProjectionSummary = {
  total_obligations_due_on_or_before_until: number;
  funding_total: number;
  net_liquidity_versus_obligations: number;
  shortfall_versus_funding: number;
  first_cumulative_shortfall_date: string | null;
};

export type LiquidityProjectionOptionsEcho = {
  stress_cycle_percent: number;
  include_unpaid_expenses: boolean;
  include_expense_templates: boolean;
};

export type LiquidityProjectionResult = {
  as_of: string;
  until: string;
  funding_wallets: Array<{
    id: number;
    name: string;
    type: string;
    balance: number;
  }>;
  milestones: LiquidityMilestone[];
  summary: LiquidityProjectionSummary;
  assumptions: readonly string[];
  options: LiquidityProjectionOptionsEcho;
};

export type GetLiquidityProjectionInput = {
  ownerFilter: OwnerFilter;
  asOf?: Date;
  until: Date;
  omitZeroObligations?: boolean;
  /** 0–100: sobre periodos con estado cerrado en $0, añade % del gasto del ciclo actual en curso. */
  stressCyclePercent?: number;
  includeUnpaidExpenses?: boolean;
  includeExpenseTemplates?: boolean;
};

const calendarGroupKey = (cutoff: number, due: number) => `${cutoff}-${due}`;

const mergeMilestoneMap = (
  target: Map<string, LiquidityObligationItem[]>,
  dueDate: string,
  items: LiquidityObligationItem[],
) => {
  const existing = target.get(dueDate);
  if (existing) {
    existing.push(...items);
  } else {
    target.set(dueDate, [...items]);
  }
};

const clampStressPercent = (n: number | undefined) => {
  if (n == null || Number.isNaN(n) || n <= 0) return 0;
  return Math.min(100, Math.round(n));
};

const endOfUtcDay = (until: Date) => {
  const ymd = toUtcDateOnlyString(until);
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
};

const collectUnpaidFundingObligations = async (
  ownerFilter: OwnerFilter,
  fundingWalletIds: number[],
  asOfStr: string,
  untilStr: string,
  omitZero: boolean,
): Promise<Map<string, LiquidityObligationItem[]>> => {
  const out = new Map<string, LiquidityObligationItem[]>();
  if (fundingWalletIds.length === 0) return out;

  const rows = await prisma.expense.findMany({
    where: {
      ...ownerFilter,
      is_paid: false,
      wallet_id: { in: fundingWalletIds },
    },
    select: {
      id: true,
      description: true,
      amount: true,
      payment_date: true,
      wallet_id: true,
      fortnight: { select: { id: true, end_date: true } },
      wallet: { select: { id: true, name: true, type: true } },
    },
  });

  for (const row of rows) {
    const w = row.wallet;
    if (!w || !isFundingWalletType(w.type)) continue;
    const dueAt = row.payment_date ?? row.fortnight.end_date;
    const dueStr = toUtcDateOnlyString(dueAt);
    if (compareUtcDateOnly(dueStr, untilStr) > 0) continue;
    const amt = Number(row.amount);
    if (omitZero && amt === 0) continue;
    const item: LiquidityObligationItem = {
      source: 'unpaid_expense',
      wallet_id: w.id,
      wallet_name: w.name,
      wallet_type: w.type,
      statement_start: '',
      statement_end: '',
      statement_due_date: dueStr,
      last_statement_balance: 0,
      payments_applied_to_statement: 0,
      next_due_payment: amt,
      expense_id: row.id,
      expense_description: row.description,
      fortnight_id: row.fortnight.id,
    };
    mergeMilestoneMap(out, dueStr, [item]);
  }
  return out;
};

const collectTemplateObligations = async (
  ownerFilter: OwnerFilter,
  fundingWalletIds: number[],
  fundingById: Map<
    number,
    { name: string; type: PaymentMethodType }
  >,
  asOf: Date,
  until: Date,
  untilStr: string,
  omitZero: boolean,
): Promise<Map<string, LiquidityObligationItem[]>> => {
  const out = new Map<string, LiquidityObligationItem[]>();
  if (fundingWalletIds.length === 0) return out;

  const fortnights = await prisma.fortnight.findMany({
    where: {
      ...ownerFilter,
      end_date: { gte: asOf },
      start_date: { lte: endOfUtcDay(until) },
    },
    select: {
      id: true,
      period: true,
      end_date: true,
      start_date: true,
    },
  });

  if (fortnights.length === 0) return out;

  const fortnightIds = fortnights.map((f) => f.id);
  const existingTemplateExpenses = await prisma.expense.findMany({
    where: {
      fortnight_id: { in: fortnightIds },
      expense_template_id: { not: null },
    },
    select: { fortnight_id: true, expense_template_id: true },
  });
  const existingKey = new Set(
    existingTemplateExpenses.map(
      (e) => `${e.fortnight_id}-${e.expense_template_id}`,
    ),
  );

  for (const fn of fortnights) {
    const appliesField =
      fn.period === FortnightPeriod.FIRST
        ? ('applies_first_fortnight' as const)
        : ('applies_second_fortnight' as const);

    const templates = await prisma.expenseTemplate.findMany({
      where: {
        ...ownerFilter,
        active: true,
        [appliesField]: true,
        category_id: { not: null },
        wallet_id: { in: fundingWalletIds },
      },
      select: {
        id: true,
        name: true,
        suggested_amount: true,
        wallet_id: true,
      },
    });

    const dueStr = toUtcDateOnlyString(fn.end_date);
    if (compareUtcDateOnly(dueStr, untilStr) > 0) continue;

    for (const t of templates) {
      if (!t.wallet_id) continue;
      if (existingKey.has(`${fn.id}-${t.id}`)) continue;
      const amt =
        t.suggested_amount != null && Number(t.suggested_amount) > 0
          ? Number(t.suggested_amount)
          : 0.01;
      if (omitZero && amt === 0) continue;

      const wallet = fundingById.get(t.wallet_id);
      if (!wallet || !isFundingWalletType(wallet.type)) continue;

      const item: LiquidityObligationItem = {
        source: 'expense_template',
        wallet_id: t.wallet_id,
        wallet_name: wallet.name,
        wallet_type: wallet.type,
        statement_start: toUtcDateOnlyString(fn.start_date),
        statement_end: dueStr,
        statement_due_date: dueStr,
        last_statement_balance: 0,
        payments_applied_to_statement: 0,
        next_due_payment: amt,
        expense_template_id: t.id,
        template_name: t.name,
        is_estimate: true,
        fortnight_id: fn.id,
      };
      mergeMilestoneMap(out, dueStr, [item]);
    }
  }

  return out;
};

const mergeAllMilestones = (
  primary: Map<string, LiquidityObligationItem[]>,
  extra: Map<string, LiquidityObligationItem[]>,
) => {
  for (const [date, items] of extra) {
    mergeMilestoneMap(primary, date, items);
  }
};

/**
 * Proyección de liquidez: efectivo/débito vs pagos a estado y, opcionalmente,
 * gastos impagos y huecos de plantillas por quincena.
 */
export const getLiquidityProjection = async (
  input: GetLiquidityProjectionInput,
): Promise<LiquidityProjectionResult> => {
  const asOf = input.asOf ?? new Date();
  const asOfStr = toUtcDateOnlyString(asOf);
  const untilStr = toUtcDateOnlyString(input.until);

  if (compareUtcDateOnly(untilStr, asOfStr) < 0) {
    const error = new Error(
      'La fecha "until" no puede ser anterior a "asOf" (comparación UTC).',
    );
    (error as { code?: string }).code = 'INVALID_HORIZON';
    throw error;
  }

  const omitZero = input.omitZeroObligations ?? true;
  const stressPct = clampStressPercent(input.stressCyclePercent);
  const includeUnpaid = input.includeUnpaidExpenses ?? true;
  const includeTemplates = input.includeExpenseTemplates ?? false;

  const [fundingWallets, creditCards] = await Promise.all([
    prisma.wallet.findMany({
      where: {
        ...input.ownerFilter,
        active: true,
        type: {
          in: [PaymentMethodType.CASH, PaymentMethodType.DEBIT_CARD],
        },
      },
      select: { id: true, name: true, type: true, amount: true },
      orderBy: { name: 'asc' },
    }),
    prisma.wallet.findMany({
      where: {
        ...input.ownerFilter,
        active: true,
        type: {
          in: [
            PaymentMethodType.CREDIT_CARD,
            PaymentMethodType.DEPARTMENT_STORE_CARD,
          ],
        },
        cutoff_day: { not: null },
        due_day: { not: null },
      },
      select: {
        id: true,
        name: true,
        type: true,
        cutoff_day: true,
        due_day: true,
      },
    }),
  ]);

  const fundingTotal = fundingWallets.reduce(
    (sum, w) => sum + Number(w.amount),
    0,
  );
  const fundingIds = fundingWallets.map((w) => w.id);
  const fundingById = new Map(
    fundingWallets.map((w) => [
      w.id,
      { name: w.name, type: w.type as PaymentMethodType },
    ]),
  );
  const allCardIds = creditCards.map((c) => c.id);

  const cardMeta = new Map(
    creditCards.map((c) => [
      c.id,
      {
        name: c.name,
        type: c.type,
        cutoff_day: c.cutoff_day!,
        due_day: c.due_day!,
      },
    ]),
  );

  const groups = new Map<string, number[]>();
  for (const card of creditCards) {
    const key = calendarGroupKey(card.cutoff_day!, card.due_day!);
    const list = groups.get(key);
    if (list) {
      list.push(card.id);
    } else {
      groups.set(key, [card.id]);
    }
  }

  const ledgerRangeStart = addDaysUtc(asOf, -420);
  const ledgerRangeEnd = addDaysUtc(input.until, 150);

  const ledger =
    allCardIds.length > 0
      ? await loadCreditCardActivityLedger(
          allCardIds,
          input.ownerFilter,
          ledgerRangeStart,
          ledgerRangeEnd,
        )
      : { expenses: [], payments: [] };

  const byDueDate = new Map<string, LiquidityObligationItem[]>();

  for (const [, cardIds] of groups) {
    const head = cardMeta.get(cardIds[0]);
    if (!head) continue;

    let cursor = asOf;

    for (let i = 0; i < LIQUIDITY_MAX_CYCLES_PER_CARD_GROUP; i += 1) {
      const window = resolveCreditCardStatementWindow(
        cursor,
        head.cutoff_day,
        head.due_day,
      );
      const dueStr = toUtcDateOnlyString(window.statementDueDate);

      if (compareUtcDateOnly(dueStr, untilStr) > 0) {
        break;
      }

      const breakdowns = computeObligationBreakdownFromLedger(
        cardIds,
        window,
        ledger.expenses,
        ledger.payments,
      );

      const statementStart = toUtcDateOnlyString(window.statementStart);
      const statementEnd = toUtcDateOnlyString(window.statementEnd);

      const chunk: LiquidityObligationItem[] = [];
      for (const id of cardIds) {
        const meta = cardMeta.get(id);
        const row = breakdowns.get(id);
        if (!meta || !row) continue;

        let nextDue = row.next_due_payment;
        let stressAdj = 0;
        if (
          stressPct > 0 &&
          row.last_statement_balance === 0 &&
          row.current_cycle_purchases > 0
        ) {
          stressAdj = row.current_cycle_purchases * (stressPct / 100);
          nextDue += stressAdj;
        }

        if (omitZero && nextDue === 0) continue;

        chunk.push({
          source: 'credit_card_statement',
          wallet_id: id,
          wallet_name: meta.name,
          wallet_type: meta.type,
          statement_start: statementStart,
          statement_end: statementEnd,
          statement_due_date: dueStr,
          last_statement_balance: row.last_statement_balance,
          payments_applied_to_statement: row.payments_applied_to_statement,
          next_due_payment: nextDue,
          ...(stressAdj > 0 ? { stress_adjustment: stressAdj } : {}),
        });
      }

      if (chunk.length > 0) {
        mergeMilestoneMap(byDueDate, dueStr, chunk);
      }

      const nextCursor = advanceStatementCursor(window);
      if (nextCursor.getTime() <= cursor.getTime()) {
        break;
      }
      cursor = nextCursor;
    }
  }

  if (includeUnpaid) {
    const unpaidMap = await collectUnpaidFundingObligations(
      input.ownerFilter,
      fundingIds,
      asOfStr,
      untilStr,
      omitZero,
    );
    mergeAllMilestones(byDueDate, unpaidMap);
  }

  if (includeTemplates) {
    const tplMap = await collectTemplateObligations(
      input.ownerFilter,
      fundingIds,
      fundingById,
      asOf,
      input.until,
      untilStr,
      omitZero,
    );
    mergeAllMilestones(byDueDate, tplMap);
  }

  const sortedDates = [...byDueDate.keys()].sort(compareUtcDateOnly);

  let cumulative = 0;
  const milestones: LiquidityMilestone[] = [];
  let firstShortfall: string | null = null;

  for (const dueDate of sortedDates) {
    const obligations = byDueDate.get(dueDate) ?? [];
    const totalDue = obligations.reduce((s, o) => s + o.next_due_payment, 0);
    cumulative += totalDue;
    const headroom = fundingTotal - cumulative;
    if (firstShortfall === null && headroom < 0) {
      firstShortfall = dueDate;
    }
    milestones.push({
      due_date: dueDate,
      is_past_due: compareUtcDateOnly(dueDate, asOfStr) < 0,
      obligations,
      total_due: totalDue,
      cumulative_due_through_date: cumulative,
      funding_total: fundingTotal,
      liquidity_headroom: headroom,
    });
  }

  const summary: LiquidityProjectionSummary = {
    total_obligations_due_on_or_before_until: cumulative,
    funding_total: fundingTotal,
    net_liquidity_versus_obligations: fundingTotal - cumulative,
    shortfall_versus_funding: Math.max(0, cumulative - fundingTotal),
    first_cumulative_shortfall_date: firstShortfall,
  };

  const extraAssumptions: string[] = [];
  if (includeUnpaid) {
    extraAssumptions.push(
      'Gastos impagos: se usan billeteras efectivo/débito; la fecha es payment_date si existe, si no el fin de la quincena.',
    );
  }
  if (includeTemplates) {
    extraAssumptions.push(
      'Plantillas: solo quincenas ya creadas sin gasto generado para esa plantilla; montos sugeridos son estimaciones.',
    );
  }
  if (stressPct > 0) {
    extraAssumptions.push(
      `Escenario de estrés: +${stressPct}% del gasto del ciclo en curso cuando el estado cerrado va en $0 (solo tarjetas).`,
    );
  }

  return {
    as_of: asOfStr,
    until: untilStr,
    funding_wallets: fundingWallets.map((w) => ({
      id: w.id,
      name: w.name,
      type: w.type,
      balance: Number(w.amount),
    })),
    milestones,
    summary,
    assumptions: [...LIQUIDITY_PROJECTION_ASSUMPTIONS_ES, ...extraAssumptions],
    options: {
      stress_cycle_percent: stressPct,
      include_unpaid_expenses: includeUnpaid,
      include_expense_templates: includeTemplates,
    },
  };
};

export const defaultLiquidityUntilFromAsOf = (asOf = new Date()): Date =>
  addDaysUtc(asOf, DEFAULT_PROJECTION_HORIZON_DAYS);
