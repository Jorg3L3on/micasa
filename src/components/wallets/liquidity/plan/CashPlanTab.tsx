'use client';

import { ErrorBanner } from '@/components/error-banner';
import EmptyState from '@/components/EmptyState';
import { PlannerPageSkeleton } from '@/components/loading/page-skeletons';
import { useEffect, useMemo, useState } from 'react';
import { useFinanceContext } from '@/context/finance-context';
import { getFinanceOwnerKey } from '@/lib/api/client-fetch';
import { getPaymentMethodOptions } from '@/lib/api/wallets';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { formatDisplayDate, parseCalendarDate } from '@/lib/calendar-dates';
import { cn, formatCurrency } from '@/lib/utils';
import { buildCashPlan, planInputFromLiquidity } from '@/lib/finance/cash-plan';
import { isScenarioGapLine } from '@/lib/finance/cash-plan/from-liquidity';
import type { PlanHorizon } from '@/lib/finance/cash-plan/types';
import type { LiquidityProjectionResponse } from '@/types/catalog';
import { ApplyPlanChecklist } from '@/components/wallets/liquidity/plan/ApplyPlanChecklist';
import { HorizonToggle } from '@/components/wallets/liquidity/plan/HorizonToggle';
import { parseLoanSimFields } from '@/components/wallets/liquidity/plan/loan-sim-fields';
import { PlanFlowPanel } from '@/components/wallets/liquidity/plan/PlanFlowPanel';
import { PlanHero, type PlanHeroScenario } from '@/components/wallets/liquidity/plan/PlanHero';
import { planPeriodLabel, planTodayLabel } from '@/components/wallets/liquidity/plan/plan-period';
import { PlanRoutesSection } from '@/components/wallets/liquidity/plan/PlanRoutesSection';
import { resolveFeaturedPlan, type TiePreference } from '@/components/wallets/liquidity/plan/route-selection';
import { PlanSimulatorPanel } from '@/components/wallets/liquidity/plan/PlanSimulatorPanel';
import { PlanStepsPanel } from '@/components/wallets/liquidity/plan/PlanStepsPanel';
import {
  PlanDataGapsPanel,
  PlanUntouchablesPanel,
  PlanWeightsPanel,
} from '@/components/wallets/liquidity/plan/PlanRailPanels';
import { MONTHLY_PANEL_SHELL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { getCurrentMonthlyPanelHref } from '@/lib/fortnight-calendar';
import { simulateBridge } from '@/lib/finance/cash-plan/simulate-bridge';
import { toCents } from '@/lib/finance/cash-plan/money';
import { PLAN_COPY } from '@/components/wallets/liquidity/plan/copy';
import {
  isWhatIfWalletType,
  type WhatIfWallet,
} from '@/components/wallets/liquidity/plan/WhatIfPanel';
import { SCENARIO_COPY } from '@/components/wallets/liquidity/scenario/copy';
import {
  formatWholeCurrency,
  scenarioDateOf,
} from '@/components/wallets/liquidity/scenario/scenario-format';
import type { LiquidityScenarioController } from '@/components/wallets/liquidity/use-liquidity-scenario';

type CashPlanTabProps = {
  data: LiquidityProjectionResponse | null;
  loading: boolean;
  error: string | null;
  onReload: () => void;
  selectedMonthKey: string;
  /** "¿Y si…?" state shared with Proyección; absent in surfaces without it. */
  scenario?: LiquidityScenarioController;
};

/** Wallets the "¿Y si…?" picker offers: every active one of the context, cards included. */
const useWhatIfWallets = (enabled: boolean): WhatIfWallet[] | null => {
  const { context } = useFinanceContext();
  const ownerKey = context ? getFinanceOwnerKey(context) : '';
  const [loaded, setLoaded] = useState<{ ownerKey: string; wallets: WhatIfWallet[] } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    getPaymentMethodOptions(context)
      .then((rows) => rows
        .filter((row) => isWhatIfWalletType(row.type))
        .map((row) => ({ id: row.id, name: row.name, type: row.type! })))
      .catch(() => [] as WhatIfWallet[])
      .then((wallets) => {
        if (!cancelled) setLoaded({ ownerKey, wallets });
      });
    return () => {
      cancelled = true;
    };
  }, [context, enabled, ownerKey]);
  // Another context's list never shows, even for the render before the refetch lands.
  return loaded?.ownerKey === ownerKey ? loaded.wallets : null;
};

export const CashPlanTab = ({
  data,
  loading,
  error,
  onReload,
  selectedMonthKey,
  scenario,
}: CashPlanTabProps) => {
  const [horizon, setHorizon] = useState<PlanHorizon>('quincena');
  const [bridgeRate, setBridgeRate] = useState('');
  const [bridgeTerm, setBridgeTerm] = useState('');
  const [bridgeFee, setBridgeFee] = useState('');
  const [consolidateRate, setConsolidateRate] = useState('');
  const [consolidateTerm, setConsolidateTerm] = useState('');
  const [consolidateFee, setConsolidateFee] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [tiePreference, setTiePreference] = useState<TiePreference | null>(null);

  const monthKey = selectedMonthKey || data?.as_of.slice(0, 7) || '';
  const wallets = useWhatIfWallets(scenario != null);
  const scenarioData = scenario?.item ? scenario.data : null;

  const computeFor = useMemo(
    () => (projection: LiquidityProjectionResponse | null) => {
      if (!projection || !monthKey) return null;
      const input = planInputFromLiquidity({
        projection,
        monthKey,
        horizon,
        asOfYmd: projection.as_of,
        bridgeSim: parseLoanSimFields(bridgeRate, bridgeTerm, bridgeFee),
        consolidateSim: parseLoanSimFields(consolidateRate, consolidateTerm, consolidateFee),
        computedAt: parseCalendarDate(projection.as_of).toISOString(),
      });
      return { input, plan: buildCashPlan(input) };
    },
    [
      bridgeFee,
      bridgeRate,
      bridgeTerm,
      consolidateFee,
      consolidateRate,
      consolidateTerm,
      horizon,
      monthKey,
    ],
  );

  const baseline = useMemo(() => computeFor(data), [computeFor, data]);
  const simulated = useMemo(() => computeFor(scenarioData), [computeFor, scenarioData]);
  // The simulation reaches this period only when one of its lines lands in it.
  const scenarioInPeriod = simulated?.input.gapLines.some(isScenarioGapLine) ?? false;
  const computed = simulated && scenarioInPeriod ? simulated : baseline;

  // A new simulation starts the route choice over.
  const [seenScenarioData, setSeenScenarioData] = useState(scenarioData);
  if (seenScenarioData !== scenarioData) {
    setSeenScenarioData(scenarioData);
    setSelectedPlanId(null);
    setChecklistOpen(false);
    setTiePreference(null);
  }

  const handleHorizonChange = (next: PlanHorizon) => {
    setHorizon(next);
    setSelectedPlanId(null);
    setChecklistOpen(false);
    setTiePreference(null);
  };

  const handleChoose = (planId: string) => {
    setSelectedPlanId(planId);
    setChecklistOpen(false);
    setTiePreference(null);
  };

  const handleToggleStep = (key: string, next: boolean) => {
    setChecked((current) => ({ ...current, [key]: next }));
  };

  if (loading && !data) {
    return <PlannerPageSkeleton />;
  }

  if (error && !data) {
    return (
      <div className="space-y-3">
        <ErrorBanner>No se pudo armar el plan.</ErrorBanner>
        <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={onReload}>
          {PLAN_COPY.retry}
        </Button>
      </div>
    );
  }

  if (!data || !computed) return null;

  const month = data.monthly_series.find((row) => row.month_key === monthKey);
  const hasMovement = (month?.total_payments_due ?? 0) > 0 || (month?.debt_items.length ?? 0) > 0;
  const hasCash = data.summary.funding_total > 0 || data.funding_wallets.length > 0;
  if (!hasMovement && !hasCash) {
    return (
      <EmptyState
        message={PLAN_COPY.emptyTitle}
        description={PLAN_COPY.emptyBody}
        action={{ label: PLAN_COPY.emptyCta, href: '/wallets' }}
      />
    );
  }

  const { input, plan } = computed;

  let heroScenario: PlanHeroScenario | null = null;
  let resultInset: string | null = null;
  if (scenario?.item && scenarioData && baseline) {
    if (scenarioInPeriod) {
      const delta = input.gapAmount - baseline.input.gapAmount;
      heroScenario = {
        kind: 'changed',
        previousGapAmount: baseline.input.gapAmount,
        previousMode: baseline.plan.mode,
        deltaNote: delta >= 0
          ? SCENARIO_COPY.gapGrew(formatCurrency(delta))
          : SCENARIO_COPY.gapShrank(formatCurrency(delta)),
      };
      const gapValue = (gap: number) => SCENARIO_COPY.gapValue(gap, formatCurrency(Math.abs(gap)));
      const routeChanged = baseline.plan.primary.id !== plan.primary.id;
      resultInset = `${SCENARIO_COPY.simulatedGap(gapValue(baseline.input.gapAmount), gapValue(input.gapAmount))} · ${
        routeChanged ? PLAN_COPY.simRouteChanges : PLAN_COPY.simRouteSame
      }`;
    } else {
      const delta = scenarioData.scenario_delta;
      const liquidity = delta
        ? `${formatWholeCurrency(delta.baseline.end_liquidity)} → ${formatWholeCurrency(delta.scenario.end_liquidity)}`
        : SCENARIO_COPY.noChange;
      heroScenario = {
        kind: 'unchanged',
        title: SCENARIO_COPY.noChangePeriod(horizon),
        body: SCENARIO_COPY.noChangeBody(horizon, formatDisplayDate(scenarioDateOf(scenario.item)), liquidity),
      };
      resultInset = `${PLAN_COPY.simLiquidityEnd} ${liquidity} · ${PLAN_COPY.simRouteSame}`;
    }
  }
  const simulating = scenario?.loading ?? false;
  const featured = resolveFeaturedPlan(plan, selectedPlanId, tiePreference);
  const routes = [plan.primary, ...plan.alternatives];
  const placeOf = (id: string) => routes.findIndex((route) => route.id === id) + 1;
  const bridgeRoute = routes.find((route) => route.strategyKey === 'bridge');
  const consolidateRoute = routes.find((route) => route.strategyKey === 'consolidate');
  const bridgeSim = input.bridgeSim && bridgeRoute
    ? simulateBridge({
      amountCents: toCents(input.bridgeSim.amount ?? Math.max(0, input.gapAmount)),
      aprAnnual: input.bridgeSim.aprAnnual,
      termMonths: input.bridgeSim.termMonths,
      feePct: input.bridgeSim.feePct,
    })
    : null;
  const bridgeResult = bridgeRoute && bridgeSim && input.bridgeSim
    ? PLAN_COPY.simBridgeResult(
      formatCurrency(bridgeSim.paymentCents / 100),
      input.bridgeSim.termMonths,
      formatCurrency(bridgeRoute.estimatedCost),
      placeOf(bridgeRoute.id),
    )
    : null;
  const consolidateResult = consolidateRoute
    ? PLAN_COPY.simConsolidateResult(formatCurrency(consolidateRoute.estimatedCost), placeOf(consolidateRoute.id))
    : null;
  const walletNames = new Map(data.funding_wallets.map((wallet) => [wallet.id, wallet.name]));
  const lowConfidence = plan.confidence === 'low';
  const balanced = plan.mode === 'balanced';

  const simulator = (
    <PlanSimulatorPanel
      mode={plan.mode}
      whatIf={scenario ? {
        wallets,
        asOf: data.as_of,
        until: data.until,
        active: scenario.item,
        loading: scenario.loading,
        error: scenario.error,
        fieldErrors: scenario.fieldErrors,
        onSimulate: scenario.simulate,
      } : null}
      resultInset={resultInset}
      bridge={{
        rate: bridgeRate,
        term: bridgeTerm,
        fee: bridgeFee,
        onRateChange: setBridgeRate,
        onTermChange: setBridgeTerm,
        onFeeChange: setBridgeFee,
        active: parseLoanSimFields(bridgeRate, bridgeTerm, bridgeFee) != null,
        result: bridgeResult,
      }}
      consolidate={{
        rate: consolidateRate,
        term: consolidateTerm,
        fee: consolidateFee,
        onRateChange: setConsolidateRate,
        onTermChange: setConsolidateTerm,
        onFeeChange: setConsolidateFee,
        active: parseLoanSimFields(consolidateRate, consolidateTerm, consolidateFee) != null,
        result: consolidateResult,
      }}
    />
  );
  const gapsPanel = <PlanDataGapsPanel gaps={plan.dataGaps} />;

  return (
    <div className="space-y-6 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-6 lg:space-y-0">
      <div className="min-w-0 space-y-6">
        {error ? (
          <div className="space-y-2">
            <ErrorBanner>No se pudo actualizar el panorama.</ErrorBanner>
            <p className="text-sm text-muted-foreground">{PLAN_COPY.errorKeepsPlan}</p>
            <Button type="button" variant="ghost" className="h-11" onClick={onReload}>
              {PLAN_COPY.retry}
            </Button>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <HorizonToggle value={horizon} onChange={handleHorizonChange} />
        </div>

        {simulating ? (
          <div className="space-y-3" aria-busy>
            <Skeleton className="h-6 w-56 rounded-lg" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ) : (
          <PlanHero
            mode={plan.mode}
            gapAmount={input.gapAmount}
            horizon={horizon}
            periodLabel={planPeriodLabel(horizon, monthKey, data.as_of)}
            todayLabel={planTodayLabel(data.as_of)}
            confidence={plan.confidence}
            gapCount={plan.dataGaps.length}
            scenario={heroScenario}
          />
        )}

        <PlanFlowPanel mode={plan.mode} input={input} dataGaps={plan.dataGaps} />

        {balanced ? (
          <p className={cn(MONTHLY_PANEL_SHELL_CLASS, 'px-4 py-3 text-sm')} data-testid="plan-balanced-note">
            {PLAN_COPY.balancedSimulate}
          </p>
        ) : simulating ? (
          <Skeleton className="h-48 w-full rounded-xl" />
        ) : (
          <>
            <PlanRoutesSection
              plan={plan}
              selectedPlanId={selectedPlanId}
              tiePreference={tiePreference}
              onChoose={handleChoose}
              onPreferTie={(preference) => {
                setTiePreference(preference);
                setSelectedPlanId(null);
                setChecklistOpen(false);
              }}
            />
            <PlanStepsPanel
              plan={featured}
              obligations={input.obligations}
              dataGaps={plan.dataGaps}
              walletNames={walletNames}
              todayYmd={data.as_of}
              monthlyPanelHref={getCurrentMonthlyPanelHref(parseCalendarDate(data.as_of))}
              onActivate={() => setChecklistOpen(true)}
              onMarkOnly={() => setChecklistOpen((open) => !open)}
            >
              {checklistOpen ? (
                <ApplyPlanChecklist
                  planId={featured.id}
                  actions={featured.actions}
                  checked={checked}
                  onToggle={handleToggleStep}
                />
              ) : null}
            </PlanStepsPanel>
          </>
        )}
      </div>

      <aside className="min-w-0 space-y-4 lg:sticky lg:top-4" aria-label={PLAN_COPY.railLabel}>
        {lowConfidence ? gapsPanel : null}
        {simulator}
        {lowConfidence ? null : gapsPanel}
        {plan.mode === 'shortfall' ? (
          <PlanUntouchablesPanel labels={plan.explainability.untouchableLabels} obligations={input.obligations} />
        ) : null}
        {balanced ? null : <PlanWeightsPanel />}
      </aside>
    </div>
  );
};
