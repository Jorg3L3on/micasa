import { getCalendarFortnightRefForYmd, ymdFallsInFortnight } from '@/lib/fortnight-calendar';
import type { LiquidityProjectionResponse } from '@/types/catalog';
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

  for (const milestone of projection.milestones) {
    if (!inHorizon(milestone.due_date)) continue;
    for (const item of milestone.obligations) {
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
          consequenceTier: classified.tier,
          discretionary: classified.discretionary,
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
      consequenceTier: 3,
    }, {
      id: item.id,
      label: item.title,
      amount: installment,
      detail: 'Mensualidad',
    });
  }

  if (horizon === 'quincena') {
    dataGaps.push({
      code: 'income_monthly_only',
      message: 'El ingreso está por mes. Esta quincena no lo parte a la mitad.',
    });
  }

  const unresolvedCards = projection.summary.unresolved_card_obligation_count ?? 0;
  if (unresolvedCards > 0) {
    dataGaps.push({
      code: 'missing_statement',
      message:
        'Hay tarjetas con deuda y fecha de pago sin el pago del corte. Ese hueco no es $0.',
    });
  }

  const incomeCents = horizon === 'mes' ? toCents(month?.expected_income_total ?? 0) : 0;
  const paymentCents = horizon === 'mes'
    ? toCents(month?.total_payments_due ?? 0)
    : added.reduce((sum, line) => sum + toCents(line.amount), 0);
  const cashCents = toCents(projection.summary.funding_total);
  const gapAmount = (paymentCents - incomeCents - cashCents) / 100;
  const gapLines: GapBreakdownLine[] = horizon === 'mes'
    ? [
      { id: 'month-payments', label: 'Pagos del mes', amount: fromCents(paymentCents) },
      { id: 'month-income', label: 'Ingreso del mes', amount: fromCents(-incomeCents) },
      { id: 'cash', label: 'Efectivo disponible', amount: fromCents(-cashCents) },
    ]
    : [
      ...added,
      { id: 'cash', label: 'Efectivo disponible', amount: fromCents(-cashCents) },
    ];
  const gapNote = horizon === 'quincena'
    ? 'No entran plantillas sin gasto en la quincena, ni tarjetas cuyo pago de este periodo ya está cubierto. El ingreso del mes no se parte.'
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
  };
};
