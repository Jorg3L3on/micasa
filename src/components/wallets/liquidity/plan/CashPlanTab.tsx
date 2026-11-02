'use client';

import { ErrorBanner } from '@/components/error-banner';
import EmptyState from '@/components/EmptyState';
import { PlannerPageSkeleton } from '@/components/loading/page-skeletons';
import { useEffect, useMemo, useState } from 'react';
import { useFinanceContext } from '@/context/finance-context';
import { getFinanceOwnerKey } from '@/lib/api/client-fetch';
import { getPaymentMethodOptions } from '@/lib/api/wallets';
import { Skeleton } from '@/components/ui/skeleton';
import { MONTHLY_LIQUID_PANEL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { SegmentedControl } from '@/components/segmented-control';
import { Button } from '@/components/ui/button';
import { formatDisplayDate, parseCalendarDate } from '@/lib/calendar-dates';
import { cn, formatCurrency } from '@/lib/utils';
import { buildCashPlan, planInputFromLiquidity } from '@/lib/finance/cash-plan';
import { isScenarioGapLine } from '@/lib/finance/cash-plan/from-liquidity';
import type { PlanHorizon, RankedPlan } from '@/lib/finance/cash-plan/types';
import type { LiquidityProjectionResponse } from '@/types/catalog';
import { ApplyPlanChecklist } from '@/components/wallets/liquidity/plan/ApplyPlanChecklist';
import { DataGapCallout } from '@/components/wallets/liquidity/plan/DataGapCallout';
import { HorizonToggle } from '@/components/wallets/liquidity/plan/HorizonToggle';
import { parseLoanSimFields } from '@/components/wallets/liquidity/plan/loan-sim-fields';
import { PlanHero, type PlanHeroScenario } from '@/components/wallets/liquidity/plan/PlanHero';
import { PlanRouteCard } from '@/components/wallets/liquidity/plan/PlanRouteCard';
import { SimulateLoanControl } from '@/components/wallets/liquidity/plan/SimulateLoanControl';
import { WhyPanel } from '@/components/wallets/liquidity/plan/WhyPanel';
import { PLAN_COPY } from '@/components/wallets/liquidity/plan/copy';
import {
  isWhatIfWalletType,
  WhatIfPanel,
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

type SurplusStrategy = 'avalanche' | 'snowball';

const pickTiePlan = (
  primary: RankedPlan,
  other: RankedPlan | undefined,
  preference: 'cost' | 'risk',
): RankedPlan => {
  if (!other) return primary;
  const pair = [primary, other];
  if (preference === 'cost') {
    return [...pair].sort((left, right) => left.scores.cost - right.scores.cost || left.id.localeCompare(right.id))[0] ?? primary;
  }
  return [...pair].sort((left, right) => left.scores.risk - right.scores.risk || left.id.localeCompare(right.id))[0] ?? primary;
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
  const [strategy, setStrategy] = useState<SurplusStrategy>('avalanche');
  const [bridgeRate, setBridgeRate] = useState('');
  const [bridgeTerm, setBridgeTerm] = useState('');
  const [bridgeFee, setBridgeFee] = useState('');
  const [consolidateRate, setConsolidateRate] = useState('');
  const [consolidateTerm, setConsolidateTerm] = useState('');
  const [consolidateFee, setConsolidateFee] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [tiePreference, setTiePreference] = useState<'cost' | 'risk' | null>(null);

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

  const handleStrategyChange = (next: SurplusStrategy) => {
    setStrategy(next);
    setSelectedPlanId(null);
    setChecklistOpen(false);
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
  let resultNote: string | null = null;
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
      resultNote = SCENARIO_COPY.simulatedGap(
        gapValue(baseline.input.gapAmount),
        gapValue(input.gapAmount),
      );
    } else {
      const delta = scenarioData.scenario_delta;
      heroScenario = {
        kind: 'unchanged',
        title: SCENARIO_COPY.noChangePeriod(horizon),
        body: SCENARIO_COPY.noChangeBody(
          horizon,
          formatDisplayDate(scenarioDateOf(scenario.item)),
          delta
            ? `${formatWholeCurrency(delta.baseline.end_liquidity)} → ${formatWholeCurrency(delta.scenario.end_liquidity)}`
            : SCENARIO_COPY.noChange,
        ),
      };
    }
  }
  const simulating = scenario?.loading ?? false;
  const whatIf = scenario ? (
    <WhatIfPanel
      wallets={wallets}
      asOf={data.as_of}
      until={data.until}
      active={scenario.item}
      loading={scenario.loading}
      error={scenario.error}
      fieldErrors={scenario.fieldErrors}
      resultNote={resultNote}
      onSimulate={scenario.simulate}
    />
  ) : null;
  const plans = [plan.primary, ...plan.alternatives];
  const tieOther = plan.tiePlanId ? plans.find((item) => item.id === plan.tiePlanId) : undefined;
  const surplusFeatured = plan.mode === 'surplus'
    ? plans.find((item) => item.strategyKey === strategy) ?? plan.primary
    : plan.primary;
  const tieFeatured = plan.tie && tiePreference
    ? pickTiePlan(plan.primary, tieOther, tiePreference)
    : surplusFeatured;
  const featured = selectedPlanId
    ? plans.find((item) => item.id === selectedPlanId) ?? tieFeatured
    : tieFeatured;
  const alternatives = plans.filter((item) => item.id !== featured.id);

  return (
    <div
      className={cn(
        'space-y-6',
        whatIf && 'lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-6 lg:space-y-0',
      )}
    >
      <div className="space-y-6 lg:col-start-1">
        {error ? (
          <div className="space-y-2">
            <ErrorBanner>No se pudo actualizar el panorama.</ErrorBanner>
            <Button type="button" variant="ghost" className="h-9" onClick={onReload}>
              {PLAN_COPY.retry}
            </Button>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <HorizonToggle value={horizon} onChange={handleHorizonChange} />
          {plan.mode === 'surplus' ? (
            <SegmentedControl
              value={strategy}
              onValueChange={(next) => handleStrategyChange(next as 'avalanche' | 'snowball')}
              ariaLabel={PLAN_COPY.strategyLabel}
              frameClassName={cn(MONTHLY_LIQUID_PANEL_CLASS, 'inline-flex w-fit max-w-full p-1 sm:p-1.5')}
              options={[
                { value: 'avalanche', label: PLAN_COPY.avalanche },
                { value: 'snowball', label: PLAN_COPY.snowball },
              ]}
            />
          ) : null}
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
            lines={input.gapLines}
            note={input.gapNote}
            scenario={heroScenario}
          />
        )}
      </div>

      {whatIf ? (
        <div className="lg:sticky lg:top-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">{whatIf}</div>
      ) : null}

      <div className="space-y-6 lg:col-start-1">
        <DataGapCallout gaps={plan.dataGaps} lowConfidence={plan.confidence === 'low'} />

        {plan.primary.id === 'empty' ? (
          <p className="text-sm text-muted-foreground">{PLAN_COPY.noSafePrimary}</p>
        ) : null}

        {plan.tie ? (
          <div className="rounded-xl border border-border/60 px-4 py-3">
            <p className="text-sm font-medium">{PLAN_COPY.tieTitle}</p>
            <p className="mt-1 text-sm text-muted-foreground">{PLAN_COPY.tieBody}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className={cn('rounded-xl', tiePreference === 'cost' && 'bg-muted')}
                aria-pressed={tiePreference === 'cost'}
                onClick={() => setTiePreference('cost')}
              >
                {PLAN_COPY.preferCost}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className={cn('h-9', tiePreference === 'risk' && 'bg-muted')}
                aria-pressed={tiePreference === 'risk'}
                onClick={() => setTiePreference('risk')}
              >
                {PLAN_COPY.preferRisk}
              </Button>
            </div>
          </div>
        ) : null}

        {simulating ? (
          <Skeleton className="h-48 w-full rounded-xl" />
        ) : (
          <PlanRouteCard
            plan={featured}
            featured
            ctaLabel={PLAN_COPY.apply}
            onChoose={() => setChecklistOpen(true)}
          >
            {checklistOpen ? (
              <ApplyPlanChecklist
                planId={featured.id}
                actions={featured.actions}
                checked={checked}
                onToggle={handleToggleStep}
              />
            ) : null}
          </PlanRouteCard>
        )}

        {alternatives.length > 0 ? (
          <div className="space-y-3">
            {alternatives.map((item) => (
              <PlanRouteCard
                key={item.id}
                plan={item}
                featured={false}
                ctaLabel={PLAN_COPY.choose}
                onChoose={() => handleChoose(item.id)}
              />
            ))}
          </div>
        ) : null}

        <WhyPanel explainability={plan.explainability} />

        <SimulateLoanControl
          idPrefix="bridge"
          title={PLAN_COPY.bridgeTitle}
          rate={bridgeRate}
          term={bridgeTerm}
          fee={bridgeFee}
          onRateChange={setBridgeRate}
          onTermChange={setBridgeTerm}
          onFeeChange={setBridgeFee}
          active={parseLoanSimFields(bridgeRate, bridgeTerm, bridgeFee) != null}
        />
        <SimulateLoanControl
          idPrefix="consolidate"
          title={PLAN_COPY.consolidateTitle}
          rate={consolidateRate}
          term={consolidateTerm}
          fee={consolidateFee}
          onRateChange={setConsolidateRate}
          onTermChange={setConsolidateTerm}
          onFeeChange={setConsolidateFee}
          active={parseLoanSimFields(consolidateRate, consolidateTerm, consolidateFee) != null}
        />
      </div>
    </div>
  );
};
