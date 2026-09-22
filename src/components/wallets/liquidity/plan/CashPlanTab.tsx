'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
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
  const [horizon, setHorizon] = useState<PlanHorizon>('mes');
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
      computedAt: `${data.as_of}T00:00:00.000Z`,
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
    return (
      <div className="space-y-3 animate-pulse" aria-busy="true" aria-label={PLAN_COPY.loading}>
        <div className="h-11 w-56 rounded-full bg-muted/40" />
        <div className="h-28 rounded-2xl border border-border/30 bg-muted/30" />
        <div className="h-40 rounded-2xl border border-border/30 bg-muted/30" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-xl border border-l-[3px] border-l-destructive/50 px-4 py-3" role="alert">
        <p className="text-sm text-destructive">No se pudo armar el plan.</p>
        <Button type="button" variant="outline" className="mt-3 rounded-xl" onClick={onReload}>
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
      <div className="rounded-2xl border border-border/60 bg-card px-4 py-6">
        <h2 className="text-base font-semibold">{PLAN_COPY.emptyTitle}</h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">{PLAN_COPY.emptyBody}</p>
        <Button asChild className="mt-4">
          <Link href="/wallets">{PLAN_COPY.emptyCta}</Link>
        </Button>
      </div>
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
        <div className="rounded-xl border border-l-[3px] border-l-destructive/50 px-4 py-3" role="alert">
          <p className="text-sm text-destructive">No se pudo actualizar el panorama.</p>
          <Button type="button" variant="ghost" className="mt-2 h-9" onClick={onReload}>
            {PLAN_COPY.retry}
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <HorizonToggle value={horizon} onChange={handleHorizonChange} />
        {plan.mode === 'surplus' ? (
          <div role="radiogroup" aria-label={PLAN_COPY.strategyLabel} className="inline-flex rounded-full border border-border/60 bg-muted/40 p-0.5">
            {([
              ['avalanche', PLAN_COPY.avalanche],
              ['snowball', PLAN_COPY.snowball],
            ] as const).map(([id, label]) => {
              const selected = strategy === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={cn(
                    'min-h-11 rounded-full px-4 text-sm font-medium',
                    selected ? 'bg-background text-foreground shadow-sm dark:bg-input/40' : 'text-muted-foreground',
                  )}
                  onClick={() => handleStrategyChange(id)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <PlanHero mode={plan.mode} gapAmount={input.gapAmount} horizon={horizon} />
      <DataGapCallout gaps={plan.dataGaps} lowConfidence={plan.confidence === 'low'} />

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
