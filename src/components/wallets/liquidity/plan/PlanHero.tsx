'use client';

import { cn, formatCurrency } from '@/lib/utils';
import { METRIC_STRIP_CLASS } from '@/components/ui/metric-strip';
import { PLAN_COPY } from '@/components/wallets/liquidity/plan/copy';
import type { PlanHorizon, PlanMode } from '@/lib/finance/cash-plan/types';

type PlanHeroProps = {
  mode: PlanMode;
  gapAmount: number;
  horizon: PlanHorizon;
};

const titleFor = (mode: PlanMode): string => {
  if (mode === 'shortfall') return PLAN_COPY.shortfallTitle;
  if (mode === 'surplus') return PLAN_COPY.surplusTitle;
  return PLAN_COPY.balancedTitle;
};

export const PlanHero = ({ mode, gapAmount, horizon }: PlanHeroProps) => {
  const amount = Math.abs(gapAmount);
  const label = mode === 'surplus' ? PLAN_COPY.extraLabel : mode === 'shortfall' ? PLAN_COPY.gapLabel : PLAN_COPY.month;
  const accent = mode === 'shortfall' ? 'border-l-amber-500/50' : mode === 'surplus' ? 'border-l-emerald-500/50' : 'border-l-primary/40';

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {horizon === 'quincena' ? PLAN_COPY.fortnight : PLAN_COPY.month}
        </p>
        <h2 className="text-xl font-semibold tracking-tight">{titleFor(mode)}</h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">{PLAN_COPY.heroHint}</p>
      </div>
      {mode === 'balanced' ? (
        <p className="text-sm text-muted-foreground">{PLAN_COPY.balancedBody}</p>
      ) : (
        <div className={cn(METRIC_STRIP_CLASS, 'border-l-[3px]', accent)}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums">{formatCurrency(amount)}</p>
        </div>
      )}
    </div>
  );
};
