import { getCalendarFortnightRefForYmd, ymdFallsInFortnight } from '@/lib/fortnight-calendar';
import type { LiquidityProjectionResponse } from '@/types/catalog';
import { isUntouchableObligation } from '@/lib/finance/cash-plan/catalog';
import { toCents } from '@/lib/finance/cash-plan/money';
import type {
  BridgeSimInput,
  ConsequenceTier,
  ConsolidateSimInput,
  DataGap,
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

  const inHorizon = (dueDate: string | undefined): boolean => {
    if (!dueDate) return horizon === 'mes';
    if (horizon === 'mes') return monthOf(dueDate) === monthKey;
    if (!fortnight) return false;
    return ymdFallsInFortnight(dueDate, fortnight.year, fortnight.month, fortnight.period);
  };

  const push = (obligation: Obligation) => {
    if (seen.has(obligation.id)) return;
    seen.add(obligation.id);
    obligations.push(obligation);
  };

  for (const milestone of projection.milestones) {
    if (!inHorizon(milestone.due_date)) continue;
    for (const item of milestone.obligations) {
      if (item.source === 'credit_card_statement') {
        const card = projection.card_utilization_summary.cards.find((row) => row.card_id === item.wallet_id);
        const debt = month?.debt_items.find((row) => row.kind === 'card' && row.id.startsWith(`card-${item.wallet_id}-`));
        const statementDue = item.next_due_payment;
        const statedMinimum = item.minimum_payment;
        const minimumDue = statedMinimum != null
          && statedMinimum > 0
          && statedMinimum < statementDue - 0.009
          ? statedMinimum
          : undefined;
        const aprAnnual = item.apr_annual != null && item.apr_annual > 0 ? item.apr_annual : undefined;
        push({
          id: `card-${item.wallet_id}`,
          kind: 'card_revolving',
          labelSynthetic: item.wallet_name,
          balanceTotal: card?.used_amount ?? debt?.amount,
          statementDue,
          minimumDue,
          aprAnnual,
          creditLimit: card?.credit_limit ?? undefined,
          dueInHorizon: true,
          consequenceTier: 3,
        });
        continue;
      }
      if (item.source === 'loan_payment') {
        const payroll = item.payment_source === 'PAYROLL_DEDUCTION';
        const label = item.loan_name || item.wallet_name || 'Préstamo';
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
        });
        continue;
      }
      if (item.source === 'expense_template' || item.source === 'unpaid_expense') {
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
    });
  }

  if (horizon === 'quincena') {
    dataGaps.push({
      code: 'income_monthly_only',
      message: 'El ingreso está por mes. Esta quincena no lo parte a la mitad.',
    });
  }

  const incomeCents = horizon === 'mes' ? toCents(month?.expected_income_total ?? 0) : 0;
  const paymentCents = horizon === 'mes'
    ? toCents(month?.total_payments_due ?? 0)
    : obligations.reduce((sum, obligation) => sum + toCents(obligation.statementDue ?? obligation.msiInstallment ?? 0), 0);
  const cashCents = toCents(projection.summary.funding_total);
  const gapAmount = (paymentCents - incomeCents - cashCents) / 100;

  const untouchableIds = obligations
    .filter((obligation) => isUntouchableObligation(obligation, new Set()))
    .map((obligation) => obligation.id);

  return {
    horizon,
    gapAmount,
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
