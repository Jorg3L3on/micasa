import { getCalendarFortnightRefForYmd, ymdFallsInFortnight } from '@/lib/fortnight-calendar';
import { formatDisplayDate, formatMonthShort } from '@/lib/calendar-dates';
import type {
  LiquidityProjectionObligationItem,
  LiquidityProjectionResponse,
} from '@/types/catalog';
import { planContributionFromObligation } from '@/lib/finance/card-period-surfaces';
import { isUntouchableObligation } from '@/lib/finance/cash-plan/catalog';
import { fromCents, toCents } from '@/lib/finance/cash-plan/money';
import type {
  BridgeSimInput,
  ConsequenceTier,
  ConsolidateSimInput,
  DataGap,
  GapBreakdownLine,
  Obligation,
  PlanHorizon,
  PlanInput,
} from '@/lib/finance/cash-plan/types';

export type LiquidityPlanSelection = {
  projection: LiquidityProjectionResponse;
  monthKey: string;
  horizon: PlanHorizon;
  /** Civil YYYY-MM-DD used to pick the fortnight inside the month. */
  asOfYmd: string;
  bridgeSim?: BridgeSimInput | null;
  consolidateSim?: ConsolidateSimInput | null;
  computedAt?: string;
};

const normalizeLabel = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const hasWord = (text: string, word: string): boolean =>
  new RegExp(`(^|[^a-z])${word}([^a-z]|$)`).test(text);

const TIER1_PHRASES = [
  'servicios del hogar',
  'colegiatura',
  'guarderia',
  'hipoteca',
  'nomina',
  'sueldo',
  'salario',
  'seguro',
  'renta',
  'alquiler',
  'internet',
];

const TIER1_WORDS = ['luz', 'agua', 'gas', 'cfe'];

const TIER2_PHRASES = ['transporte', 'gasolina', 'doctor', 'farmacia', 'trabajo', 'uber'];

const DISCRETIONARY_PHRASES = [
  'netflix',
  'spotify',
  'disney',
  'prime',
  'youtube',
  'restaurante',
  'entretenimiento',
  'cine',
  'juego',
  'viaje',
  'ropa',
  'cafe',
  'suscripcion',
  'social',
];

export const classifyObligationLabel = (
  label: string,
  hints?: { payroll?: boolean },
): { tier: ConsequenceTier; discretionary: boolean } => {
  if (hints?.payroll) return { tier: 1, discretionary: false };
  const text = normalizeLabel(label);
  if (TIER1_PHRASES.some((phrase) => text.includes(phrase)) || TIER1_WORDS.some((word) => hasWord(text, word))) {
    return { tier: 1, discretionary: false };
  }
  if (DISCRETIONARY_PHRASES.some((phrase) => text.includes(phrase))) {
    return { tier: 3, discretionary: true };
  }
  if (TIER2_PHRASES.some((phrase) => text.includes(phrase))) {
    return { tier: 2, discretionary: false };
  }
  return { tier: 3, discretionary: false };
};

const monthOf = (ymd: string): string => ymd.slice(0, 7);

const FUNDING_WALLET_TYPES = new Set(['CASH', 'DEBIT_CARD']);

/** Gap line ids for simulated items start with this, so the hero can mark them. */
export const SCENARIO_LINE_PREFIX = 'scenario-';

export const isScenarioGapLine = (line: GapBreakdownLine): boolean =>
  line.id.startsWith(SCENARIO_LINE_PREFIX);

const scenarioLineId = (item: LiquidityProjectionObligationItem): string =>
  `${SCENARIO_LINE_PREFIX}${item.scenario_index ?? 0}-${item.scenario_instalment_number ?? 1}`;

const scenarioLabel = (item: LiquidityProjectionObligationItem): string =>
  item.scenario_kind === 'instalment' ? 'Pago mensual simulado' : 'Compra simulada';

const scenarioDetail = (item: LiquidityProjectionObligationItem): string => {
  const charge = formatDisplayDate(item.scenario_charge_date ?? item.statement_due_date);
  const cuota =
    item.scenario_instalment_total != null
      ? ` · ${item.scenario_instalment_number} de ${item.scenario_instalment_total}`
      : '';
  if (FUNDING_WALLET_TYPES.has(item.wallet_type)) {
    return `${charge} · ${item.wallet_name}${cuota}`;
  }
  return `${charge} · ${item.wallet_name}${cuota} · se paga el ${formatDisplayDate(item.statement_due_date)}`;
};

const resolveFortnight = (monthKey: string, asOfYmd: string) => {
  if (monthOf(asOfYmd) === monthKey) return getCalendarFortnightRefForYmd(asOfYmd);
  const [year, month] = monthKey.split('-').map(Number);
  return { year, month, period: 'FIRST' as const };
};

/**
 * Maps a liquidity projection into engine input.
 * Quincena does not split monthly income in half.
 * Card `payment_amount` is the statement due, never the MSI remaining balance.
 */
export const planInputFromLiquidity = (selection: LiquidityPlanSelection): PlanInput => {
  const { projection, monthKey, horizon, asOfYmd } = selection;
  const month = projection.monthly_series.find((row) => row.month_key === monthKey);
  const fortnight = horizon === 'quincena' ? resolveFortnight(monthKey, asOfYmd) : null;
  const dataGaps: DataGap[] = [];
  const obligations: Obligation[] = [];
  const seen = new Set<string>();
  const added: GapBreakdownLine[] = [];
  const unresolvedCardIds = new Set(
    (projection.summary.unresolved_card_obligations ?? []).map((card) => card.wallet_id),
  );

  const inHorizon = (dueDate: string | undefined): boolean => {
    if (!dueDate) return horizon === 'mes';
    if (horizon === 'mes') return monthOf(dueDate) === monthKey;
    if (!fortnight) return false;
    return ymdFallsInFortnight(dueDate, fortnight.year, fortnight.month, fortnight.period);
  };

  const push = (obligation: Obligation, line: GapBreakdownLine) => {
    if (seen.has(obligation.id)) return;
    seen.add(obligation.id);
    obligations.push(obligation);
    added.push(line);
  };

  const scenarioItems: Array<{ item: LiquidityProjectionObligationItem; dueDate: string }> = [];

  for (const milestone of projection.milestones) {
    if (!inHorizon(milestone.due_date)) continue;
    for (const item of milestone.obligations) {
      if (item.source === 'scenario') {
        scenarioItems.push({ item, dueDate: milestone.due_date });
        continue;
      }
      if (item.source === 'expense_template') {
        if (horizon === 'quincena') continue;
        const label = item.template_name || item.wallet_name || 'Gasto';
        const classified = classifyObligationLabel(label);
        push({
          id: `bill-${item.expense_template_id ?? label}`,
          kind: 'bill',
          labelSynthetic: label,
          statementDue: item.next_due_payment,
          dueInHorizon: true,
          dueDate: milestone.due_date,
          consequenceTier: classified.tier,
          // A template occurrence has no expense to move yet, so it is never offered as a deferral.
          discretionary: false,
        }, {
          id: `bill-${item.expense_template_id ?? label}`,
          label,
          amount: item.next_due_payment,
          detail: 'Plantilla',
        });
        continue;
      }
      if (item.source === 'credit_card_statement') {
        if (item.planner_status === 'pagado') continue;
        if (unresolvedCardIds.has(item.wallet_id)) continue;
        const usesFortnightPlan = item.planned_fortnight_payment != null && item.remaining_planner_amount != null;
        const dueAmount = usesFortnightPlan ? item.remaining_planner_amount! : item.next_due_payment;
        if (dueAmount <= 0) continue;
        const contribution = planContributionFromObligation({
          amount: dueAmount,
          basis: 'statement_no_interest',
          confidence: 'exact',
          gaps: [],
        });
        if (contribution.statementDue == null) continue;
        const card = projection.card_utilization_summary.cards.find((row) => row.card_id === item.wallet_id);
        const debt = month?.debt_items.find((row) => row.kind === 'card' && row.id.startsWith(`card-${item.wallet_id}-`));
        const minimumDue =
          item.minimum_payment != null && item.minimum_payment > 0
            ? item.minimum_payment
            : null;
        const aprAnnual =
          item.apr_annual != null && item.apr_annual > 0 ? item.apr_annual : null;
        const catAnnual =
          item.cat_annual != null && item.cat_annual > 0 ? item.cat_annual : null;
        push({
          id: `card-${item.wallet_id}`,
          kind: 'card_revolving',
          labelSynthetic: item.wallet_name,
          balanceTotal: card?.used_amount ?? debt?.amount,
          statementDue: contribution.statementDue,
          minimumDue,
          aprAnnual,
          catAnnual,
          creditLimit: card?.credit_limit ?? undefined,
          dueInHorizon: true,
          dueDate: milestone.due_date,
          consequenceTier: 3,
        }, {
          id: `card-${item.wallet_id}`,
          label: item.wallet_name,
          amount: contribution.statementDue,
          detail: usesFortnightPlan ? 'Lo que falta de pagar esta quincena' : 'Corte pendiente',
        });
        continue;
      }
      if (item.source === 'loan_payment') {
        const payroll = item.payment_source === 'PAYROLL_DEDUCTION';
        const label = item.loan_name || item.wallet_name || 'Préstamo';
        const lender = item.lender?.trim() || 'Sin prestamista';
        const classified = classifyObligationLabel(label, { payroll });
        const debt = month?.debt_items.find(
          (row) => row.kind === 'loan' && (row.title === item.loan_name || row.id.includes(String(item.loan_id))),
        );
        const loanApr = item.apr_annual != null && item.apr_annual > 0 ? item.apr_annual : undefined;
        push({
          id: `loan-${item.loan_id ?? item.loan_payment_id}`,
          kind: 'loan',
          labelSynthetic: label,
          balanceTotal: debt?.amount,
          statementDue: item.next_due_payment,
          aprAnnual: loanApr,
          dueInHorizon: true,
          dueDate: milestone.due_date,
          consequenceTier: classified.tier,
        }, {
          id: `loan-${item.loan_id ?? item.loan_payment_id}`,
          label,
          amount: item.next_due_payment,
          detail: 'Pago de préstamo',
          group: { id: lender, label: lender },
        });
        continue;
      }
      if (item.source === 'unpaid_expense') {
        const label = item.template_name || item.expense_description || item.wallet_name || 'Gasto';
        const classified = classifyObligationLabel(label);
        push({
          id: `bill-${item.expense_template_id ?? item.expense_id ?? label}`,
          kind: 'bill',
          labelSynthetic: label,
          statementDue: item.next_due_payment,
          dueInHorizon: true,
          dueDate: milestone.due_date,
          consequenceTier: classified.tier,
          discretionary: classified.discretionary,
        }, {
          id: `bill-${item.expense_id ?? label}`,
          label,
          amount: item.next_due_payment,
          detail: 'Gasto sin pagar',
        });
      }
    }
  }

  for (const item of month?.debt_items ?? []) {
    if (item.kind !== 'msi') continue;
    const installment = item.payment_amount ?? 0;
    if (installment <= 0) continue;
    if (horizon === 'mes' && !item.due_date) {
      // Counted in the month, but no civil day to schedule its step on.
      dataGaps.push({
        code: 'undated_obligation',
        obligationId: item.id,
        message: `La mensualidad de ${item.title} no tiene día de pago, así que su paso no lleva fecha.`,
      });
    }
    if (horizon === 'quincena') {
      if (!item.due_date) {
        dataGaps.push({
          code: 'undated_obligation',
          obligationId: item.id,
          message: `La mensualidad de ${item.title} no tiene día dentro de la quincena, así que no entra en este horizonte.`,
        });
        continue;
      }
      if (!fortnight || !ymdFallsInFortnight(item.due_date, fortnight.year, fortnight.month, fortnight.period)) {
        continue;
      }
    }
    push({
      id: item.id,
      kind: 'card_msi',
      labelSynthetic: item.title,
      balanceTotal: item.amount,
      msiInstallment: installment,
      dueInHorizon: true,
      ...(item.due_date ? { dueDate: item.due_date } : {}),
      consequenceTier: 3,
    }, {
      id: item.id,
      label: item.title,
      amount: installment,
      detail: 'Mensualidad',
    });
  }

  // A simulated purchase or instalment is one more debt item (Jorge, MIC-I8):
  // on a funding wallet a bill the route may defer; on a card it rides the
  // card's statement, so the route can pay that card's minimum; a card
  // instalment is a cuota.
  const scenarioLines: GapBreakdownLine[] = [];
  for (const { item, dueDate } of scenarioItems) {
    const id = scenarioLineId(item);
    const label = scenarioLabel(item);
    const line: GapBreakdownLine = {
      id,
      label,
      amount: item.next_due_payment,
      detail: scenarioDetail(item),
    };
    scenarioLines.push(line);
    if (FUNDING_WALLET_TYPES.has(item.wallet_type)) {
      push({
        id,
        kind: 'bill',
        labelSynthetic: label,
        statementDue: item.next_due_payment,
        dueInHorizon: true,
        dueDate,
        consequenceTier: 3,
        discretionary: true,
      }, line);
      continue;
    }
    if (item.credit_installment_total != null) {
      push({
        id,
        kind: 'card_msi',
        labelSynthetic: `${label} · ${item.wallet_name}`,
        balanceTotal: item.next_due_payment,
        msiInstallment: item.next_due_payment,
        dueInHorizon: true,
        dueDate,
        consequenceTier: 3,
      }, line);
      continue;
    }
    const cardId = `card-${item.wallet_id}`;
    const card = obligations.find((obligation) => obligation.id === cardId);
    if (card) {
      card.statementDue = fromCents(toCents(card.statementDue ?? 0) + toCents(item.next_due_payment));
      added.push(line);
      continue;
    }
    const utilization = projection.card_utilization_summary.cards.find(
      (row) => row.card_id === item.wallet_id,
    );
    push({
      id: cardId,
      kind: 'card_revolving',
      labelSynthetic: item.wallet_name,
      balanceTotal: utilization?.used_amount,
      statementDue: item.next_due_payment,
      minimumDue: item.minimum_payment != null && item.minimum_payment > 0 ? item.minimum_payment : null,
      aprAnnual: item.apr_annual != null && item.apr_annual > 0 ? item.apr_annual : null,
      catAnnual: item.cat_annual != null && item.cat_annual > 0 ? item.cat_annual : null,
      creditLimit: utilization?.credit_limit ?? undefined,
      dueInHorizon: true,
      dueDate,
      consequenceTier: 3,
    }, line);
  }
  const scenarioCents = scenarioLines.reduce((sum, line) => sum + toCents(line.amount), 0);

  // Quincena: an income counts when its civil day falls inside the period, from today on.
  // Without dated incomes (an older projection), income stays out and the plan says so.
  const datedIncomes = projection.income_dates;
  const periodIncomes = horizon === 'quincena' && datedIncomes
    ? datedIncomes.filter((income) => income.amount > 0 && income.date >= asOfYmd && inHorizon(income.date))
    : [];
  if (horizon === 'quincena' && !datedIncomes) {
    dataGaps.push({
      code: 'income_monthly_only',
      message: 'El ingreso está por mes. Esta quincena no lo parte a la mitad.',
    });
  }

  const unresolvedCards = projection.summary.unresolved_card_obligation_count ?? 0;
  const unresolvedInHorizon = (projection.summary.unresolved_card_obligations ?? []).filter(
    (card) => inHorizon(card.statement_due_date),
  );
  if (unresolvedInHorizon.length > 0) {
    // One gap per card, so the plan can show it on that card's line.
    for (const card of unresolvedInHorizon) {
      dataGaps.push({
        code: 'missing_statement',
        obligationId: `card-${card.wallet_id}`,
        message: `Falta el pago del corte de ${card.wallet_name} (vence el ${formatDisplayDate(card.statement_due_date)}). No está sumado aquí.`,
      });
    }
  } else if (unresolvedCards > 0 && (projection.summary.unresolved_card_obligations ?? []).length === 0) {
    dataGaps.push({
      code: 'missing_statement',
      message:
        'Hay tarjetas con deuda y fecha de pago sin el pago del corte. Ese hueco no es $0.',
    });
  }

  const incomeCents = horizon === 'mes'
    ? toCents(month?.expected_income_total ?? 0)
    : periodIncomes.reduce((sum, income) => sum + toCents(income.amount), 0);
  const incomeLines: GapBreakdownLine[] = periodIncomes.map((income, index) => {
    const [, incomeMonth, incomeDay] = income.date.split('-').map(Number);
    return {
      id: `income-${income.date}-${index}`,
      label: `${income.title} · ${incomeDay} ${formatMonthShort(incomeMonth)}`,
      amount: fromCents(-toCents(income.amount)),
    };
  });
  const paymentCents = horizon === 'mes'
    ? toCents(month?.total_payments_due ?? 0)
    : added.reduce((sum, line) => sum + toCents(line.amount), 0);
  const cashCents = toCents(projection.summary.funding_total);
  const gapAmount = (paymentCents - incomeCents - cashCents) / 100;
  const gapLines: GapBreakdownLine[] = horizon === 'mes'
    ? [
      { id: 'month-payments', label: 'Pagos del mes', amount: fromCents(paymentCents - scenarioCents) },
      ...scenarioLines,
      { id: 'month-income', label: 'Ingreso del mes', amount: fromCents(-incomeCents) },
      { id: 'cash', label: 'Efectivo disponible', amount: fromCents(-cashCents) },
    ]
    : [
      ...added,
      { id: 'cash', label: 'Efectivo disponible', amount: fromCents(-cashCents) },
      ...incomeLines,
    ];
  const gapNote = horizon === 'quincena'
    ? datedIncomes
      ? 'No entran plantillas sin gasto en la quincena, ni tarjetas cuyo pago de este periodo ya está cubierto. Solo entra el ingreso que cae dentro de la quincena, completo; no se parte.'
      : 'No entran plantillas sin gasto en la quincena, ni tarjetas cuyo pago de este periodo ya está cubierto. El ingreso del mes no se parte.'
    : undefined;

  const untouchableIds = obligations
    .filter((obligation) => isUntouchableObligation(obligation, new Set()))
    .map((obligation) => obligation.id);

  return {
    horizon,
    gapAmount,
    gapLines,
    gapNote,
    availableCash: projection.summary.funding_total,
    obligations,
    untouchableIds,
    prefs: {
      surplusStrategyDefault: 'avalanche',
      allowBridgeSim: true,
      allowConsolidateSim: true,
      missingAprPolicy: 'exclude_from_apr_rank',
    },
    bridgeSim: selection.bridgeSim ?? null,
    consolidateSim: selection.consolidateSim ?? null,
    computedAt: selection.computedAt,
    dataGaps,
    fundingWallets: projection.funding_wallets.map((wallet) => ({ id: wallet.id, balance: wallet.balance })),
  };
};
