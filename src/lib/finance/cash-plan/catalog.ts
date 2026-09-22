import type { ActionTypeId, Obligation, RiskTag } from '@/lib/finance/cash-plan/types';

export type ActionCatalogEntry = {
  type: ActionTypeId;
  uiLabel: string;
  uiDescription: string;
  riskTags: RiskTag[];
};

/**
 * Closed catalog. The engine may only emit these ids.
 * A payment below `minimumDue` is not `pay_minimum`.
 */
export const ACTION_CATALOG: Record<ActionTypeId, ActionCatalogEntry> = {
  pay_minimum: {
    type: 'pay_minimum',
    uiLabel: 'Pagar solo el mínimo',
    uiDescription: 'Bajas este pago al mínimo para soltar efectivo. La diferencia sigue generando intereses.',
    riskTags: ['interest_accrual'],
  },
  pay_statement: {
    type: 'pay_statement',
    uiLabel: 'Pagar el corte (evitar intereses)',
    uiDescription: 'Cubres el pago para no generar intereses de este corte, no la deuda total.',
    riskTags: ['liquidity_drain'],
  },
  pay_msi_installment: {
    type: 'pay_msi_installment',
    uiLabel: 'Cubrir mensualidad MSI',
    uiDescription: 'Pagas la mensualidad del plan. El saldo restante no es el pago de este periodo.',
    riskTags: [],
  },
  pay_off: {
    type: 'pay_off',
    uiLabel: 'Liquidar esta deuda',
    uiDescription: 'Cierras el saldo y dejas de cargar con esa cuota.',
    riskTags: ['liquidity_drain'],
  },
  defer_nonessential: {
    type: 'defer_nonessential',
    uiLabel: 'Aplazar gasto no esencial',
    uiDescription: 'Mueves un gasto que puedes posponer y no abres deuda nueva.',
    riskTags: [],
  },
  split_hybrid: {
    type: 'split_hybrid',
    uiLabel: 'Plan mixto (mínimos + un ajuste)',
    uiDescription: 'Combinas mínimos con un solo ajuste focal.',
    riskTags: ['interest_accrual'],
  },
  bridge_loan: {
    type: 'bridge_loan',
    uiLabel: 'Simular préstamo puente',
    uiDescription: 'Simulas un préstamo de corto plazo con la tasa, el plazo y la comisión que tú indicas.',
    riskTags: ['new_debt', 'approval_uncertain', 'interest_accrual'],
  },
  consolidate: {
    type: 'consolidate',
    uiLabel: 'Simular consolidación',
    uiDescription: 'Simulas juntar deudas en un solo pago. No es una oferta ni una aprobación.',
    riskTags: ['new_debt', 'approval_uncertain'],
  },
  extra_to_debt_avalanche: {
    type: 'extra_to_debt_avalanche',
    uiLabel: 'Extra a la tasa más alta (avalancha)',
    uiDescription: 'Después de los mínimos, el extra va a la deuda con la tasa más alta.',
    riskTags: [],
  },
  extra_to_debt_snowball: {
    type: 'extra_to_debt_snowball',
    uiLabel: 'Extra a la deuda más chica (bola de nieve)',
    uiDescription: 'Después de los mínimos, el extra va a la deuda con el saldo más bajo.',
    riskTags: [],
  },
  buffer_reserve: {
    type: 'buffer_reserve',
    uiLabel: 'Guardar colchón',
    uiDescription: 'Dejas parte del extra en efectivo para el siguiente periodo.',
    riskTags: [],
  },
};

export const RISK_TAG_LABELS: Record<RiskTag, string> = {
  late_fee: 'Cargo por atraso',
  credit_report_30d: 'Reporte a 30 días',
  interest_accrual: 'Sigue generando intereses',
  liquidity_drain: 'Usa mucho efectivo',
  new_debt: 'Deuda nueva',
  approval_uncertain: 'Sin aprobación',
  msi_break: 'Rompe el plan MSI',
  untouchable_conflict: 'Toca un gasto fijo',
};

export const isUntouchableObligation = (
  obligation: Obligation,
  untouchableIds: ReadonlySet<string>,
): boolean => obligation.consequenceTier === 1 || untouchableIds.has(obligation.id);

/** Period cash this obligation asks for. Never the MSI remaining balance. */
export const plannedPeriodPaymentCents = (
  obligation: Obligation,
  toCents: (pesos: number) => number,
): number => {
  if (!obligation.dueInHorizon) return 0;
  if (obligation.kind === 'card_msi') {
    return Math.max(0, toCents(obligation.msiInstallment ?? 0));
  }
  if (obligation.kind === 'card_revolving' || obligation.kind === 'loan') {
    const statement = obligation.statementDue;
    const minimum = obligation.minimumDue;
    if (statement != null) return Math.max(0, toCents(statement));
    if (minimum != null) return Math.max(0, toCents(minimum));
    return 0;
  }
  if (obligation.statementDue != null) return Math.max(0, toCents(obligation.statementDue));
  return Math.max(0, toCents(obligation.balanceTotal ?? 0));
};

export const canPayMinimum = (
  obligation: Obligation,
  untouchableIds: ReadonlySet<string>,
): boolean => {
  if (!obligation.dueInHorizon) return false;
  if (isUntouchableObligation(obligation, untouchableIds)) return false;
  if (obligation.kind !== 'card_revolving' && obligation.kind !== 'loan') return false;
  if (obligation.minimumDue == null || obligation.minimumDue <= 0) return false;
  const planned =
    obligation.statementDue ??
    obligation.minimumDue;
  return obligation.minimumDue < planned - 0.009;
};

export const canPayOff = (
  obligation: Obligation,
  untouchableIds: ReadonlySet<string>,
  availableCashCents: number,
  balanceCents: number,
): boolean => {
  if (!obligation.dueInHorizon) return false;
  if (obligation.kind === 'card_msi' || obligation.kind === 'bill') return false;
  if (isUntouchableObligation(obligation, untouchableIds)) return false;
  if (balanceCents <= 0) return false;
  return balanceCents <= availableCashCents;
};

export const canDefer = (
  obligation: Obligation,
  untouchableIds: ReadonlySet<string>,
): boolean =>
  obligation.dueInHorizon &&
  obligation.discretionary === true &&
  obligation.kind === 'bill' &&
  !isUntouchableObligation(obligation, untouchableIds) &&
  plannedPeriodPaymentCents(obligation, (value) => Math.round(value * 100)) > 0;
