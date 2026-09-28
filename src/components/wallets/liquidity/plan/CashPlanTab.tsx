'use client';

import { ErrorBanner } from '@/components/error-banner';
import EmptyState from '@/components/EmptyState';
import { PlannerPageSkeleton } from '@/components/loading/page-skeletons';
import { useMemo, useState } from 'react';
import { SegmentedControl } from '@/components/segmented-control';
import { Button } from '@/components/ui/button';
import { parseCalendarDate } from '@/lib/calendar-dates';
import { cn } from '@/lib/utils';
import { buildCashPlan, planInputFromLiquidity } from '@/lib/finance/cash-plan';
import type { PlanHorizon, RankedPlan } from '@/lib/finance/cash-plan/types';
import type { LiquidityProjectionResponse } from '@/types/catalog';
import { ApplyPlanChecklist } from '@/components/wallets/liquidity/plan/ApplyPlanChecklist';
import { DataGapCallout } from '@/components/wallets/liquidity/plan/DataGapCallout';
import { HorizonToggle } from '@/components/wallets/liquidity/plan/HorizonToggle';
import { parseLoanSimFields } from '@/components/wallets/liquidity/plan/loan-sim-fields';
import { PlanHero } from '@/components/wallets/liquidity/plan/PlanHero';
import { PlanRouteCard } from '@/components/wallets/liquidity/plan/PlanRouteCard';
import { SimulateLoanControl } from '@/components/wallets/liquidity/plan/SimulateLoanControl';
import { WhyPanel } from '@/components/wallets/liquidity/plan/WhyPanel';
import { PLAN_COPY } from '@/components/wallets/liquidity/plan/copy';

type CashPlanTabProps = {
  data: LiquidityProjectionResponse | null;
  loading: boolean;
  error: string | null;
  onReload: () => void;
  selectedMonthKey: string;
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

  const computed = useMemo(() => {
    if (!data || !monthKey) return null;
    const input = planInputFromLiquidity({
      projection: data,
      monthKey,
      horizon,
      asOfYmd: data.as_of,
      bridgeSim: parseLoanSimFields(bridgeRate, bridgeTerm, bridgeFee),
      consolidateSim: parseLoanSimFields(consolidateRate, consolidateTerm, consolidateFee),
      computedAt: parseCalendarDate(data.as_of).toISOString(),
    });
    return { input, plan: buildCashPlan(input) };
  }, [
    bridgeFee,
    bridgeRate,
    bridgeTerm,
    consolidateFee,
    consolidateRate,
    consolidateTerm,
    data,
    horizon,
    monthKey,
  ]);

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
    <div className="space-y-6">
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
            options={[
              { value: 'avalanche', label: PLAN_COPY.avalanche },
              { value: 'snowball', label: PLAN_COPY.snowball },
            ]}
          />
        ) : null}
      </div>

      <PlanHero
        mode={plan.mode}
        gapAmount={input.gapAmount}
        horizon={horizon}
        lines={input.gapLines}
        note={input.gapNote}
      />
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
  );
};
