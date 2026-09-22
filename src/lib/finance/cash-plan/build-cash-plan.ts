import { ACTION_CATALOG, canDefer, canPayMinimum, canPayOff, isUntouchableObligation, plannedPeriodPaymentCents } from '@/lib/finance/cash-plan/catalog';
import { BALANCED_EPS_CENTS, formatPlanMoney, fromCents, toCents } from '@/lib/finance/cash-plan/money';
import { compositeScore, riskScore, TIE_COMPOSITE_EPS } from '@/lib/finance/cash-plan/score';
import { simulateBridge } from '@/lib/finance/cash-plan/simulate-bridge';
import { simulateConsolidate } from '@/lib/finance/cash-plan/simulate-consolidate';
import { simulatePayoff, type PayoffDebt } from '@/lib/finance/cash-plan/simulate-payoff';
import {
  ASSUMED_HIGH_APR,
  ASSUMED_MEDIAN_APR,
  CASH_PLAN_ENGINE_VERSION,
  type ActionInstance,
  type DataGap,
  type MissingAprPolicy,
  type Obligation,
  type PlanHorizon,
  type PlanInput,
  type PlanMode,
  type PlanResult,
  type PlanStrategyKey,
  type RankedPlan,
  type RiskTag,
} from '@/lib/finance/cash-plan/types';

const INTEREST_MONTHS = 6;
const FUTURE_CUOTA_MONTHS = 6;
/** Caller-injected runs stay deterministic. Noon matches calendar-date storage. */
const DEFAULT_COMPUTED_AT = '1970-01-01T12:00:00.000Z';

type AprResolution = {
  apr: number;
  assumed: boolean;
  excludeFromRank: boolean;
};

type Draft = {
  id: string;
  strategyKey: PlanStrategyKey;
  title: string;
  summary: string;
  actions: ActionInstance[];
  netFreedCents: number;
  costCents: number;
  riskTags: RiskTag[];
  touchesUntouchable: boolean;
  worseRate: boolean;
  warnings: string[];
  surplusAllocatedCents?: number;
  impact?: { monthsDelta: number; interestDelta: number };
  runwayPeriods: number;
  credit: number;
  paidOffIds: string[];
};

const emptyPlan = (summary: string): RankedPlan => ({
  id: 'empty',
  strategyKey: 'other',
  title: 'Aún no hay una ruta',
  summary,
  actions: [],
  scores: {
    gapClosed: 0,
    cost: 0,
    risk: 0,
    liquidityRunway: 0,
    creditLimitPreservation: 1,
    composite: 0,
  },
  estimatedCost: 0,
  estimatedRiskTags: [],
  warnings: [],
  touchesUntouchable: false,
});

const horizonCopy = (horizon: PlanHorizon): string =>
  horizon === 'quincena' ? 'esta quincena' : 'este mes';

const resolveApr = (obligation: Obligation, policy: MissingAprPolicy): AprResolution => {
  const known = obligation.aprAnnual ?? obligation.catAnnual ?? null;
  if (known != null && known > 0) {
    return { apr: known, assumed: false, excludeFromRank: false };
  }
  if (policy === 'exclude_from_apr_rank') {
    return { apr: 0, assumed: true, excludeFromRank: true };
  }
  if (policy === 'assume_high') {
    return { apr: ASSUMED_HIGH_APR, assumed: true, excludeFromRank: false };
  }
  return { apr: ASSUMED_MEDIAN_APR, assumed: true, excludeFromRank: false };
};

const uniqueTags = (tags: readonly RiskTag[]): RiskTag[] =>
  [...new Set(tags)].sort((a, b) => a.localeCompare(b));

const action = (
  type: ActionInstance['type'],
  extras: Omit<ActionInstance, 'type' | 'label' | 'riskTags' | 'warnings'> & {
    label?: string;
    riskTags?: RiskTag[];
    warnings?: string[];
  },
): ActionInstance => {
  const entry = ACTION_CATALOG[type];
  return {
    type,
    label: extras.label ?? entry.uiLabel,
    detail: extras.detail,
    obligationId: extras.obligationId,
    amount: extras.amount,
    riskTags: uniqueTags([...(extras.riskTags ?? entry.riskTags)]),
    warnings: extras.warnings ?? [],
    touchesUntouchable: extras.touchesUntouchable,
  };
};

const dedupeGaps = (gaps: readonly DataGap[]): DataGap[] => {
  const seen = new Set<string>();
  const result: DataGap[] = [];
  for (const gap of gaps) {
    const key = `${gap.code}:${gap.obligationId ?? ''}:${gap.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(gap);
  }
  return result;
};

const collectDataGaps = (input: PlanInput): DataGap[] => {
  const gaps: DataGap[] = [...(input.dataGaps ?? [])];
  for (const obligation of input.obligations) {
    if (!obligation.dueInHorizon) continue;
    const needsApr = obligation.kind === 'card_revolving' || obligation.kind === 'loan';
    const known = obligation.aprAnnual ?? obligation.catAnnual ?? null;
    if (needsApr && (known == null || known <= 0)) {
      gaps.push({
        code: 'missing_apr',
        obligationId: obligation.id,
        message: `No tenemos la tasa de ${obligation.labelSynthetic}. El orden no la trata como dato real y la confianza baja.`,
      });
    }
    if (
      obligation.kind === 'card_revolving' &&
      (obligation.minimumDue == null || obligation.minimumDue <= 0)
    ) {
      gaps.push({
        code: 'missing_minimum',
        obligationId: obligation.id,
        message: `No tenemos el pago mínimo de ${obligation.labelSynthetic}.`,
      });
    }
  }
  return dedupeGaps(gaps);
};

const confidenceFor = (gaps: readonly DataGap[]): PlanResult['confidence'] => {
  if (gaps.some((gap) => gap.code === 'missing_apr' || gap.code === 'missing_minimum')) {
    return 'low';
  }
  if (gaps.length > 0) return 'medium';
  return 'high';
};

const interestCents = (balanceCents: number, apr: number): number => {
  if (balanceCents <= 0 || apr <= 0) return 0;
  return Math.round((balanceCents * apr * INTEREST_MONTHS) / 12);
};

const creditPreservation = (obligations: readonly Obligation[], paidOffIds: ReadonlySet<string>): number => {
  const cards = obligations.filter(
    (obligation) =>
      obligation.kind === 'card_revolving' &&
      obligation.creditLimit != null &&
      obligation.creditLimit > 0,
  );
  if (cards.length === 0) return 1;
  const total = cards.reduce((sum, card) => {
    const balance = paidOffIds.has(card.id) ? 0 : Math.max(0, card.balanceTotal ?? 0);
    const used = Math.min(1, balance / (card.creditLimit as number));
    return sum + (1 - used);
  }, 0);
  return total / cards.length;
};

const msiActions = (obligations: readonly Obligation[]): ActionInstance[] =>
  obligations
    .filter((obligation) => obligation.kind === 'card_msi' && obligation.dueInHorizon)
    .map((obligation) =>
      action('pay_msi_installment', {
        obligationId: obligation.id,
        label: `Cubrir mensualidad MSI · ${obligation.labelSynthetic}`,
        amount: obligation.msiInstallment ?? 0,
        detail: 'El saldo del plan no entra como pago de este periodo.',
      }),
    );

const isClone = (left: Draft, right: Draft): boolean => {
  if (left.strategyKey !== right.strategyKey) return false;
  if (Math.abs(left.netFreedCents - right.netFreedCents) > 100) return false;
  const leftIds = left.actions.map((item) => `${item.type}:${item.obligationId ?? ''}`).sort().join('|');
  const rightIds = right.actions.map((item) => `${item.type}:${item.obligationId ?? ''}`).sort().join('|');
  return leftIds === rightIds;
};

const scoreDraft = (draft: Draft, gapCents: number, scaleCents: number): RankedPlan => {
  const gapClosed = gapCents <= BALANCED_EPS_CENTS
    ? 1
    : Math.min(1, Math.max(0, draft.netFreedCents) / gapCents);
  const tags = uniqueTags([
    ...draft.riskTags,
    ...draft.actions.flatMap((item) => item.riskTags),
  ]);
  const risk = riskScore(tags);
  const composite = compositeScore({
    gapClosed: draft.strategyKey === 'buffer' || draft.strategyKey === 'avalanche' || draft.strategyKey === 'snowball'
      ? 1
      : gapClosed,
    costCents: draft.costCents,
    scaleCents,
    risk,
    runwayPeriods: draft.runwayPeriods,
    credit: draft.credit,
  });
  return {
    id: draft.id,
    strategyKey: draft.strategyKey,
    title: draft.title,
    summary: draft.summary,
    actions: draft.actions,
    scores: {
      gapClosed,
      cost: fromCents(draft.costCents),
      risk,
      liquidityRunway: Math.round(draft.runwayPeriods * 100) / 100,
      creditLimitPreservation: Math.round(draft.credit * 1000) / 1000,
      composite: Math.round(composite * 10000) / 10000,
    },
    estimatedCost: fromCents(draft.costCents),
    estimatedRiskTags: tags,
    gapClosed: gapCents > 0 ? fromCents(Math.min(gapCents, Math.max(0, draft.netFreedCents))) : undefined,
    surplusAllocated: draft.surplusAllocatedCents != null ? fromCents(draft.surplusAllocatedCents) : undefined,
    impact: draft.impact,
    warnings: draft.warnings,
    touchesUntouchable: draft.touchesUntouchable,
  };
};

const payoffDebts = (obligations: readonly Obligation[], policy: MissingAprPolicy): PayoffDebt[] =>
  obligations
    .filter((obligation) => obligation.kind === 'card_revolving' || obligation.kind === 'loan')
    .map((obligation) => {
      const apr = resolveApr(obligation, policy);
      const minimum = obligation.minimumDue ?? obligation.statementDue ?? 0;
      return {
        id: obligation.id,
        balanceCents: Math.max(0, toCents(obligation.balanceTotal ?? 0)),
        aprAnnual: apr.apr,
        minimumCents: Math.max(0, toCents(minimum)),
        aprKnown: !apr.assumed && !apr.excludeFromRank,
      };
    })
    .filter((debt) => debt.balanceCents > 0);

const buildShortfallDrafts = (
  input: PlanInput,
  due: readonly Obligation[],
  untouchableIds: ReadonlySet<string>,
  policy: MissingAprPolicy,
  gapCents: number,
  monthlyNeedCents: number,
): Draft[] => {
  const drafts: Draft[] = [];
  const available = Math.max(0, toCents(input.availableCash));
  const runwayBase = available / Math.max(monthlyNeedCents, 1);

  const aprOf = (obligation: Obligation) => resolveApr(obligation, policy);

  const remainingInterest = (obligation: Obligation, paidCents: number): number => {
    const balance = Math.max(0, toCents(obligation.balanceTotal ?? 0) - paidCents);
    return interestCents(balance, aprOf(obligation).apr);
  };

  const pushMinimums = (obligations: readonly Obligation[], id: string, title: string) => {
    const chosen = obligations.filter((obligation) => canPayMinimum(obligation, untouchableIds));
    if (chosen.length === 0) return;
    let net = 0;
    let cost = 0;
    const actions: ActionInstance[] = chosen.map((obligation) => {
      const planned = plannedPeriodPaymentCents(obligation, toCents);
      const minimum = toCents(obligation.minimumDue ?? 0);
      net += planned - minimum;
      cost += remainingInterest(obligation, minimum);
      return action('pay_minimum', {
        obligationId: obligation.id,
        label: `Pagar solo el mínimo · ${obligation.labelSynthetic}`,
        amount: fromCents(minimum),
        detail: `Liberas ${formatPlanMoney(planned - minimum)} frente al corte.`,
      });
    });
    actions.push(...msiActions(due));
    drafts.push({
      id,
      strategyKey: 'minimums',
      title,
      summary: `Bajas ${chosen.length === 1 ? 'un pago' : `${chosen.length} pagos`} al mínimo y dejas intactos renta, servicios y nómina.`,
      actions,
      netFreedCents: net,
      costCents: cost,
      riskTags: ['interest_accrual'],
      touchesUntouchable: false,
      worseRate: false,
      warnings: [],
      runwayPeriods: (available + Math.max(0, net)) / Math.max(monthlyNeedCents, 1),
      credit: creditPreservation(input.obligations, new Set()),
      paidOffIds: [],
    });
  };

  const reducible = due
    .filter((obligation) => canPayMinimum(obligation, untouchableIds))
    .sort((a, b) => {
      const aprA = aprOf(a);
      const aprB = aprOf(b);
      if (aprA.excludeFromRank !== aprB.excludeFromRank) return aprA.excludeFromRank ? 1 : -1;
      if (aprB.apr !== aprA.apr) return aprB.apr - aprA.apr;
      const saveA = plannedPeriodPaymentCents(a, toCents) - toCents(a.minimumDue ?? 0);
      const saveB = plannedPeriodPaymentCents(b, toCents) - toCents(b.minimumDue ?? 0);
      if (saveB !== saveA) return saveB - saveA;
      return a.id.localeCompare(b.id);
    });

  const stacked: Obligation[] = [];
  let stackedSaved = 0;
  for (const obligation of reducible) {
    stacked.push(obligation);
    stackedSaved += plannedPeriodPaymentCents(obligation, toCents) - toCents(obligation.minimumDue ?? 0);
    if (gapCents > 0 && stackedSaved >= gapCents) break;
  }
  if (stacked.length > 0) {
    pushMinimums(stacked, 'minimums', 'Pagar solo el mínimo');
  }

  for (const obligation of reducible) {
    const saved = plannedPeriodPaymentCents(obligation, toCents) - toCents(obligation.minimumDue ?? 0);
    if (gapCents > 0 && saved < gapCents * 0.95) continue;
    pushMinimums([obligation], `min:${obligation.id}`, `Mínimo en ${obligation.labelSynthetic}`);
  }

  const payoffTargets = due
    .filter((obligation) => {
      const balance = toCents(obligation.balanceTotal ?? 0);
      return canPayOff(obligation, untouchableIds, available, balance);
    })
    .sort((a, b) => toCents(a.balanceTotal ?? 0) - toCents(b.balanceTotal ?? 0) || a.id.localeCompare(b.id));

  const payoffTarget = payoffTargets[0];
  if (payoffTarget) {
    const balance = toCents(payoffTarget.balanceTotal ?? 0);
    const planned = plannedPeriodPaymentCents(payoffTarget, toCents);
    const cuota = toCents(payoffTarget.minimumDue ?? payoffTarget.statementDue ?? 0);
    let net = planned - balance;
    let cost = 0;
    const companions: Obligation[] = [];
    if (net < gapCents) {
      for (const obligation of reducible) {
        if (obligation.id === payoffTarget.id) continue;
        const saved = plannedPeriodPaymentCents(obligation, toCents) - toCents(obligation.minimumDue ?? 0);
        companions.push(obligation);
        net += saved;
        cost += remainingInterest(obligation, toCents(obligation.minimumDue ?? 0));
        if (net >= gapCents) break;
      }
    }
    const credit = Math.max(0, cuota) * FUTURE_CUOTA_MONTHS;
    cost = Math.max(0, cost - credit);
    const actions: ActionInstance[] = [
      action('pay_off', {
        obligationId: payoffTarget.id,
        label: `Liquidar ${payoffTarget.labelSynthetic}`,
        amount: fromCents(balance),
        detail: `Su cuota de ${formatPlanMoney(cuota)} deja de repetirse.`,
      }),
      ...companions.map((obligation) =>
        action('pay_minimum', {
          obligationId: obligation.id,
          label: `Pagar solo el mínimo · ${obligation.labelSynthetic}`,
          amount: obligation.minimumDue,
        }),
      ),
    ];
    if (companions.length > 0) {
      actions.unshift(
        action('split_hybrid', {
          label: 'Plan mixto (mínimos + liquidar una chica)',
          detail: 'Cierras la deuda chica y bajas el resto solo si hace falta.',
        }),
      );
    }
    actions.push(...msiActions(due));
    drafts.push({
      id: 'payoff-small',
      strategyKey: 'payoff',
      title: `Liquidar ${payoffTarget.labelSynthetic}`,
      summary: `Cierras ${payoffTarget.labelSynthetic} porque su cuota aporta al hueco y el saldo cabe en el efectivo disponible.`,
      actions,
      netFreedCents: net,
      costCents: cost,
      riskTags: ['liquidity_drain'],
      touchesUntouchable: false,
      worseRate: false,
      warnings: [],
      runwayPeriods: (available - balance + Math.max(0, net)) / Math.max(monthlyNeedCents, 1),
      credit: creditPreservation(input.obligations, new Set([payoffTarget.id])),
      paidOffIds: [payoffTarget.id],
    });
  }

  const deferrable = due
    .filter((obligation) => canDefer(obligation, untouchableIds))
    .sort((a, b) => plannedPeriodPaymentCents(b, toCents) - plannedPeriodPaymentCents(a, toCents) || a.id.localeCompare(b.id));
  if (deferrable.length > 0) {
    const chosen: Obligation[] = [];
    let net = 0;
    for (const obligation of deferrable) {
      chosen.push(obligation);
      net += plannedPeriodPaymentCents(obligation, toCents);
      if (gapCents > 0 && net >= gapCents) break;
    }
    drafts.push({
      id: 'defer',
      strategyKey: 'defer',
      title: 'Aplazar gasto no esencial',
      summary: 'Mueves gastos que puedes posponer y no abres una deuda nueva.',
      actions: [
        ...chosen.map((obligation) =>
          action('defer_nonessential', {
            obligationId: obligation.id,
            label: `Aplazar ${obligation.labelSynthetic}`,
            amount: fromCents(plannedPeriodPaymentCents(obligation, toCents)),
          }),
        ),
        ...msiActions(due),
      ],
      netFreedCents: net,
      costCents: 0,
      riskTags: [],
      touchesUntouchable: false,
      worseRate: false,
      warnings: ['Confirma que ese gasto sí se puede mover este periodo.'],
      runwayPeriods: (available + net) / Math.max(monthlyNeedCents, 1),
      credit: creditPreservation(input.obligations, new Set()),
      paidOffIds: [],
    });
  }

  const statementTarget = [...due]
    .filter((obligation) => obligation.kind === 'card_revolving' && obligation.statementDue != null && !isUntouchableObligation(obligation, untouchableIds))
    .sort((a, b) => aprOf(b).apr - aprOf(a).apr || a.id.localeCompare(b.id))[0];
  if (statementTarget?.statementDue != null) {
    const statement = toCents(statementTarget.statementDue);
    drafts.push({
      id: `statement:${statementTarget.id}`,
      strategyKey: 'other',
      title: `Pagar el corte de ${statementTarget.labelSynthetic}`,
      summary: 'Cubres el corte para no generar intereses. No suelta efectivo: el hueco se cierra con otros ajustes.',
      actions: [
        action('pay_statement', {
          obligationId: statementTarget.id,
          label: `Pagar el corte · ${statementTarget.labelSynthetic}`,
          amount: fromCents(statement),
        }),
        ...msiActions(due),
      ],
      netFreedCents: 0,
      costCents: remainingInterest(statementTarget, statement),
      riskTags: gapCents > BALANCED_EPS_CENTS ? ['liquidity_drain'] : [],
      touchesUntouchable: false,
      worseRate: false,
      warnings: [],
      runwayPeriods: runwayBase,
      credit: creditPreservation(input.obligations, new Set()),
      paidOffIds: [],
    });
  }

  const bridgeAllowed = input.prefs?.allowBridgeSim !== false && input.bridgeSim;
  if (bridgeAllowed && gapCents > BALANCED_EPS_CENTS) {
    const amountCents = input.bridgeSim?.amount != null
      ? toCents(input.bridgeSim.amount)
      : gapCents;
    const simulated = simulateBridge({
      amountCents,
      aprAnnual: input.bridgeSim?.aprAnnual ?? 0,
      termMonths: input.bridgeSim?.termMonths ?? 0,
      feePct: input.bridgeSim?.feePct ?? -1,
    });
    if (simulated) {
      drafts.push({
        id: 'bridge',
        strategyKey: 'bridge',
        title: 'Simular préstamo puente',
        summary: `Entras ${formatPlanMoney(simulated.proceedsCents)} netos. Es una simulación: nadie te está aprobando el crédito.`,
        actions: [
          action('bridge_loan', {
            amount: fromCents(simulated.amountCents),
            detail: `Tasa ${(input.bridgeSim?.aprAnnual ?? 0) * 100}% · ${input.bridgeSim?.termMonths} meses · comisión ${(input.bridgeSim?.feePct ?? 0) * 100}%.`,
            warnings: ['Simulación. No es una aprobación de crédito.'],
          }),
          ...msiActions(due),
        ],
        netFreedCents: simulated.proceedsCents,
        costCents: simulated.totalCostCents,
        riskTags: ['new_debt', 'approval_uncertain', 'interest_accrual'],
        touchesUntouchable: false,
        worseRate: false,
        warnings: ['Simulación. No es una aprobación de crédito.'],
        runwayPeriods: (available + simulated.proceedsCents) / Math.max(monthlyNeedCents, 1),
        credit: creditPreservation(input.obligations, new Set()),
        paidOffIds: [],
      });
    }
  }

  const consolidateAllowed = input.prefs?.allowConsolidateSim !== false && input.consolidateSim;
  const unsecured = due.filter(
    (obligation) =>
      (obligation.kind === 'card_revolving' || obligation.kind === 'loan') &&
      !isUntouchableObligation(obligation, untouchableIds) &&
      toCents(obligation.balanceTotal ?? 0) > 0,
  );
  if (consolidateAllowed && unsecured.length >= 2) {
    const simulated = simulateConsolidate({
      balancesCents: unsecured.map((obligation) => toCents(obligation.balanceTotal ?? 0)),
      aprs: unsecured.map((obligation) => {
        const apr = aprOf(obligation);
        return apr.assumed ? null : apr.apr;
      }),
      aprAnnual: input.consolidateSim?.aprAnnual ?? 0,
      termMonths: input.consolidateSim?.termMonths ?? 0,
      feePct: input.consolidateSim?.feePct ?? -1,
    });
    if (simulated) {
      const currentDues = unsecured.reduce(
        (sum, obligation) => sum + plannedPeriodPaymentCents(obligation, toCents),
        0,
      );
      const warning = simulated.worseRate
        ? 'La tasa nueva no baja la tasa ponderada. Por eso no es la ruta principal.'
        : 'Simulación. No es una aprobación de crédito.';
      drafts.push({
        id: 'consolidate',
        strategyKey: 'consolidate',
        title: 'Simular consolidación',
        summary: simulated.worseRate
          ? 'La tasa que pusiste no mejora lo que ya pagas. La dejamos como alternativa, no como ruta principal.'
          : 'Juntas varias deudas en un solo pago simulado, con la tasa y el plazo que indicaste.',
        actions: [
          action('consolidate', {
            amount: fromCents(simulated.paymentCents),
            detail: `Pago simulado ${formatPlanMoney(simulated.paymentCents)} durante ${input.consolidateSim?.termMonths} meses.`,
            warnings: [warning],
          }),
          ...msiActions(due),
        ],
        netFreedCents: currentDues - simulated.paymentCents,
        costCents: simulated.interestCents + simulated.feeCents,
        riskTags: ['new_debt', 'approval_uncertain'],
        touchesUntouchable: false,
        worseRate: simulated.worseRate,
        warnings: [warning],
        runwayPeriods: runwayBase,
        credit: creditPreservation(input.obligations, new Set(unsecured.map((obligation) => obligation.id))),
        paidOffIds: unsecured.map((obligation) => obligation.id),
      });
    }
  }

  const tier1Bills = due
    .filter((obligation) => isUntouchableObligation(obligation, untouchableIds) && obligation.kind === 'bill')
    .sort((a, b) => plannedPeriodPaymentCents(b, toCents) - plannedPeriodPaymentCents(a, toCents));
  const tier1 = tier1Bills[0];
  if (tier1) {
    const amount = plannedPeriodPaymentCents(tier1, toCents);
    if (amount > 0) {
      drafts.push({
        id: `untouchable:${tier1.id}`,
        strategyKey: 'defer',
        title: `Recortar ${tier1.labelSynthetic}`,
        summary: `Esto sí toca ${tier1.labelSynthetic}. Solo como alternativa, con riesgo alto: no es la ruta principal.`,
        actions: [
          action('defer_nonessential', {
            obligationId: tier1.id,
            label: `Aplazar ${tier1.labelSynthetic}`,
            amount: fromCents(amount),
            riskTags: ['untouchable_conflict', 'late_fee'],
            touchesUntouchable: true,
            warnings: ['Riesgo alto: este gasto está en la lista de intocables.'],
          }),
        ],
        netFreedCents: amount,
        costCents: 0,
        riskTags: ['untouchable_conflict', 'late_fee'],
        touchesUntouchable: true,
        worseRate: false,
        warnings: ['Riesgo alto: este gasto está en la lista de intocables.'],
        runwayPeriods: (available + amount) / Math.max(monthlyNeedCents, 1),
        credit: 1,
        paidOffIds: [],
      });
    }
  }

  return drafts;
};

const buildSurplusDrafts = (
  input: PlanInput,
  due: readonly Obligation[],
  policy: MissingAprPolicy,
  extraCents: number,
  monthlyNeedCents: number,
): Draft[] => {
  const available = Math.max(0, toCents(input.availableCash));
  const debts = payoffDebts(input.obligations, policy);
  const baseline = simulatePayoff(debts, 0, 'minimums');
  const avalanche = simulatePayoff(debts, extraCents, 'avalanche');
  const snowball = simulatePayoff(debts, extraCents, 'snowball');
  const impactOf = (result: typeof avalanche) => ({
    monthsDelta: baseline.months - result.months,
    interestDelta: fromCents(baseline.interestCents - result.interestCents),
  });

  const runwayBase = available / Math.max(monthlyNeedCents, 1);
  const cushionGap = Math.max(0, monthlyNeedCents - available);
  const bufferCents = cushionGap > 0
    ? Math.min(extraCents, cushionGap)
    : Math.min(extraCents, monthlyNeedCents);
  const bufferPayoff = simulatePayoff(debts, Math.max(0, extraCents - bufferCents), 'avalanche');
  const drafts: Draft[] = [];

  if (debts.length > 0) {
    drafts.push({
      id: 'avalanche',
      strategyKey: 'avalanche',
      title: 'Extra a la tasa más alta',
      summary: 'Después de los mínimos, el extra de este periodo va a la deuda más cara.',
      actions: [
        action('extra_to_debt_avalanche', {
          amount: fromCents(extraCents),
          detail: 'Un solo extra de este periodo; los meses siguientes siguen en mínimo.',
        }),
        ...msiActions(due),
      ],
      netFreedCents: extraCents,
      costCents: avalanche.interestCents,
      riskTags: [],
      touchesUntouchable: false,
      worseRate: false,
      warnings: [],
      surplusAllocatedCents: extraCents,
      impact: impactOf(avalanche),
      runwayPeriods: runwayBase,
      credit: creditPreservation(input.obligations, new Set()),
      paidOffIds: [],
    });
    drafts.push({
      id: 'snowball',
      strategyKey: 'snowball',
      title: 'Extra a la deuda más chica',
      summary: 'Después de los mínimos, el extra va al saldo más bajo para cerrarlo antes.',
      actions: [
        action('extra_to_debt_snowball', {
          amount: fromCents(extraCents),
          detail: 'Misma caja que la avalancha; cambia a cuál deuda le pega primero.',
        }),
        ...msiActions(due),
      ],
      netFreedCents: extraCents,
      costCents: snowball.interestCents,
      riskTags: [],
      touchesUntouchable: false,
      worseRate: false,
      warnings: [],
      surplusAllocatedCents: extraCents,
      impact: impactOf(snowball),
      runwayPeriods: runwayBase,
      credit: creditPreservation(input.obligations, new Set()),
      paidOffIds: [],
    });
  }

  if (bufferCents > 0) {
    const debtSlice = Math.max(0, extraCents - bufferCents);
    const actions: ActionInstance[] = [
      action('buffer_reserve', {
        amount: fromCents(bufferCents),
        detail: 'Se queda en efectivo para el siguiente periodo.',
      }),
    ];
    if (debtSlice > 0 && debts.length > 0) {
      actions.push(
        action('extra_to_debt_avalanche', {
          amount: fromCents(debtSlice),
          detail: 'El resto del extra va a la tasa más alta.',
        }),
      );
    }
    drafts.push({
      id: 'buffer',
      strategyKey: 'buffer',
      title: 'Guardar colchón',
      summary: runwayBase < 1
        ? 'El efectivo de hoy no cubre un periodo de pagos. Conviene dejar el extra en caja antes de adelantar deuda.'
        : 'Puedes apartar una parte del extra y no dejar la caja en cero.',
      actions,
      netFreedCents: extraCents,
      costCents: debts.length > 0 ? bufferPayoff.interestCents : 0,
      riskTags: [],
      touchesUntouchable: false,
      worseRate: false,
      warnings: [],
      surplusAllocatedCents: bufferCents,
      runwayPeriods: (available + bufferCents) / Math.max(monthlyNeedCents, 1),
      credit: creditPreservation(input.obligations, new Set()),
      paidOffIds: [],
    });
  }

  return drafts;
};

const explain = (
  input: PlanInput,
  primary: RankedPlan,
  gaps: readonly DataGap[],
  untouchableLabels: readonly string[],
): PlanResult['explainability'] => {
  const assumptions = [
    `Horizonte: ${horizonCopy(input.horizon)}.`,
    'La deuda total de un plan a meses no es el pago del periodo: solo entra la mensualidad.',
    'Un pago menor al mínimo no cuenta como mínimo pagado.',
    'Renta, hipoteca, luz, agua, gas, internet, seguros, colegiaturas y nómina no se recortan en la ruta principal.',
  ];
  if (gaps.some((gap) => gap.code === 'missing_apr')) {
    assumptions.push('Si falta la tasa, no la inventamos como dato tuyo. La confianza de la ruta baja.');
  }
  if (gaps.some((gap) => gap.code === 'income_monthly_only')) {
    assumptions.push('El ingreso está por mes. En quincena no lo partimos a la mitad: solo cuentan obligaciones con fecha y el efectivo disponible.');
  }
  if (input.bridgeSim) {
    assumptions.push('El préstamo puente usa la tasa, el plazo y la comisión que escribiste. Es simulación, no una aprobación.');
  }
  if (input.consolidateSim) {
    assumptions.push('La consolidación usa los números que escribiste. Si la tasa no mejora, no sale como ruta principal.');
  }
  const closed = primary.scores.gapClosed;
  const scoreSummary = input.gapAmount > 0
    ? `Esta ruta cubre cerca de ${Math.round(closed * 100)}% del hueco. Costo estimado ${formatPlanMoney(toCents(primary.estimatedCost))}.`
    : `Costo estimado de intereses ${formatPlanMoney(toCents(primary.estimatedCost))}.`;
  return {
    assumptions,
    untouchableLabels: [...untouchableLabels],
    scoreSummary,
  };
};

const rankDrafts = (
  drafts: Draft[],
  gapCents: number,
  mode: PlanMode,
  momentum: boolean,
  lowRunway: boolean,
): RankedPlan[] => {
  const scale = Math.max(Math.abs(gapCents), 100);
  const ranked = drafts.map((draft) => {
    const plan = scoreDraft(draft, Math.max(gapCents, 0), scale);
    let composite = plan.scores.composite;
    if (mode === 'surplus' && lowRunway && draft.strategyKey === 'buffer') composite += 0.35;
    if (mode === 'surplus' && momentum && draft.strategyKey === 'snowball') composite += 0.2;
    if (draft.worseRate) composite -= 0.5;
    if (draft.touchesUntouchable) composite -= 0.5;
    return {
      ...plan,
      scores: {
        ...plan.scores,
        composite: Math.round(composite * 10000) / 10000,
      },
    };
  });
  ranked.sort((a, b) => {
    if (b.scores.composite !== a.scores.composite) return b.scores.composite - a.scores.composite;
    if (a.scores.risk !== b.scores.risk) return a.scores.risk - b.scores.risk;
    if (a.scores.cost !== b.scores.cost) return a.scores.cost - b.scores.cost;
    if (b.scores.liquidityRunway !== a.scores.liquidityRunway) {
      return b.scores.liquidityRunway - a.scores.liquidityRunway;
    }
    return a.id.localeCompare(b.id);
  });
  return ranked;
};

const balancedResult = (
  input: PlanInput,
  gaps: DataGap[],
  computedAt: string,
  untouchableLabels: string[],
): PlanResult => {
  const primary: RankedPlan = {
    id: 'balanced',
    strategyKey: 'other',
    title: 'Este periodo cuadra',
    summary: 'Con lo que entra y lo que toca pagar, este periodo cierra sin hueco.',
    actions: [],
    scores: {
      gapClosed: 1,
      cost: 0,
      risk: 0,
      liquidityRunway: Math.round((toCents(input.availableCash) / 100) * 100) / 100,
      creditLimitPreservation: 1,
      composite: 1,
    },
    estimatedCost: 0,
    estimatedRiskTags: [],
    warnings: [],
    touchesUntouchable: false,
  };
  const alternatives: RankedPlan[] = [
    {
      ...primary,
      id: 'buffer-soft',
      strategyKey: 'buffer',
      title: 'Dejar el colchón quieto',
      summary: 'No hace falta mover el efectivo disponible en este periodo.',
      actions: [
        action('buffer_reserve', {
          detail: 'El efectivo se queda donde está.',
        }),
      ],
      scores: { ...primary.scores, composite: 0.4 },
    },
  ];
  const hasDebt = input.obligations.some(
    (obligation) =>
      (obligation.kind === 'card_revolving' || obligation.kind === 'loan') &&
      (obligation.balanceTotal ?? 0) > 0,
  );
  if (hasDebt) {
    alternatives.push({
      ...primary,
      id: 'prepay-soft',
      strategyKey: 'avalanche',
      title: 'Si sobra después, adelantar la tasa más alta',
      summary: 'Este periodo no sobra ni falta. Cuando sobre, el extra rinde más en la deuda más cara.',
      actions: [
        action('extra_to_debt_avalanche', {
          detail: 'Sin extra asignado en este periodo.',
        }),
      ],
      scores: { ...primary.scores, composite: 0.3 },
    });
  }
  const assumptions = explain(input, primary, gaps, untouchableLabels);
  return {
    mode: 'balanced',
    primary,
    alternatives: alternatives.slice(0, 4),
    confidence: confidenceFor(gaps),
    dataGaps: gaps,
    tie: false,
    explainability: assumptions,
    meta: {
      horizon: input.horizon,
      computedAt,
      engineVersion: CASH_PLAN_ENGINE_VERSION,
      assumptions: assumptions.assumptions,
    },
  };
};

/** Deterministic plan. Same input → same routes, scores, and copy. */
export const buildCashPlan = (input: PlanInput): PlanResult => {
  const computedAt = input.computedAt ?? DEFAULT_COMPUTED_AT;
  const policy: MissingAprPolicy = input.prefs?.missingAprPolicy ?? 'assume_median';
  const untouchableIds = new Set(input.untouchableIds ?? []);
  const gaps = collectDataGaps(input);
  const due = input.obligations
    .filter((obligation) => obligation.dueInHorizon)
    .sort((a, b) => a.id.localeCompare(b.id));
  const untouchableLabels = input.obligations
    .filter((obligation) => isUntouchableObligation(obligation, untouchableIds))
    .map((obligation) => obligation.labelSynthetic)
    .sort((a, b) => a.localeCompare(b, 'es'));
  const gapCents = toCents(input.gapAmount);
  const monthlyNeedCents = Math.max(
    1,
    due.reduce((sum, obligation) => sum + plannedPeriodPaymentCents(obligation, toCents), 0),
  );

  if (Math.abs(gapCents) <= BALANCED_EPS_CENTS) {
    return balancedResult(input, gaps, computedAt, untouchableLabels);
  }

  const mode: PlanMode = gapCents > 0 ? 'shortfall' : 'surplus';
  const drafts = mode === 'shortfall'
    ? buildShortfallDrafts(input, due, untouchableIds, policy, gapCents, monthlyNeedCents)
    : buildSurplusDrafts(input, due, policy, Math.abs(gapCents), monthlyNeedCents);

  const debts = payoffDebts(input.obligations, policy);
  const knownAprs = input.obligations
    .filter((obligation) => obligation.kind === 'card_revolving' || obligation.kind === 'loan')
    .map((obligation) => obligation.aprAnnual ?? obligation.catAnnual)
    .filter((apr): apr is number => apr != null && apr > 0);
  const spread = knownAprs.length >= 2 ? Math.max(...knownAprs) - Math.min(...knownAprs) : 1;
  const avalancheSim = simulatePayoff(debts, Math.abs(gapCents), 'avalanche');
  const snowballSim = simulatePayoff(debts, Math.abs(gapCents), 'snowball');
  const momentum = mode === 'surplus'
    && spread <= 0.01
    && snowballSim.debtsClearedFirstMonth > avalancheSim.debtsClearedFirstMonth;
  const lowRunway = toCents(input.availableCash) / monthlyNeedCents < 1;

  const ranked = rankDrafts(drafts, gapCents, mode, momentum, lowRunway);
  const eligible = ranked.filter((plan) => {
    const draftWorse = drafts.find((draft) => draft.id === plan.id)?.worseRate;
    return !plan.touchesUntouchable && !draftWorse;
  });
  const primary = eligible[0] ?? ranked[0] ?? emptyPlan(
    'Con estos datos no hay una ruta que cierre el periodo sin inventar números.',
  );
  const alternatives: RankedPlan[] = [];
  for (const plan of ranked) {
    if (plan.id === primary.id) continue;
    if (alternatives.length >= 4) break;
    const draft = drafts.find((item) => item.id === plan.id);
    const primaryDraft = drafts.find((item) => item.id === primary.id);
    if (draft && primaryDraft && isClone(draft, primaryDraft)) continue;
    if (draft && alternatives.some((picked) => {
      const pickedDraft = drafts.find((item) => item.id === picked.id);
      return pickedDraft ? isClone(draft, pickedDraft) : false;
    })) continue;
    alternatives.push(plan);
  }

  const runnerUp = eligible.find((plan) => plan.id !== primary.id);
  const tie = runnerUp != null && Math.abs(primary.scores.composite - runnerUp.scores.composite) <= TIE_COMPOSITE_EPS;
  const explainability = explain(input, primary, gaps, untouchableLabels);

  return {
    mode,
    primary,
    alternatives,
    confidence: confidenceFor(gaps),
    dataGaps: gaps,
    tie,
    tiePlanId: tie ? runnerUp?.id : undefined,
    explainability,
    meta: {
      horizon: input.horizon,
      computedAt,
      engineVersion: CASH_PLAN_ENGINE_VERSION,
      assumptions: explainability.assumptions,
    },
  };
};
