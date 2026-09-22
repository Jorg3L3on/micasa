'use client';

import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MONTHLY_PANEL_SHELL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { RISK_TAG_LABELS } from '@/lib/finance/cash-plan/catalog';
import { cn, formatCurrency } from '@/lib/utils';
import { PLAN_COPY } from '@/components/wallets/liquidity/plan/copy';
import type { RankedPlan } from '@/lib/finance/cash-plan/types';

type PlanRouteCardProps = {
  plan: RankedPlan;
  featured: boolean;
  ctaLabel: string;
  onChoose: () => void;
  children?: ReactNode;
};

export const PlanRouteCard = ({
  plan,
  featured,
  ctaLabel,
  onChoose,
  children,
}: PlanRouteCardProps) => (
  <article
    className={cn(
      MONTHLY_PANEL_SHELL_CLASS,
      'border-l-[3px] px-4 py-4 sm:px-5',
      featured ? 'border-l-primary/70' : 'border-l-border',
    )}
  >
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-base font-semibold tracking-tight">{plan.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{plan.summary}</p>
      </div>
      {plan.impact ? (
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {PLAN_COPY.interestSaved}
          </p>
          <p className="font-mono text-sm font-bold tabular-nums">
            {formatCurrency(plan.impact.interestDelta)}
          </p>
          <p className="text-xs text-muted-foreground">
            {PLAN_COPY.monthsSaved}: {plan.impact.monthsDelta}
          </p>
        </div>
      ) : null}
    </div>

    {plan.estimatedRiskTags.length > 0 ? (
      <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Riesgos">
        {plan.estimatedRiskTags.map((tag) => (
          <li key={tag}>
            <Badge variant="outline">{RISK_TAG_LABELS[tag]}</Badge>
          </li>
        ))}
      </ul>
    ) : null}

    {plan.warnings.length > 0 ? (
      <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
        {plan.warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    ) : null}

    {plan.actions.length > 0 ? (
      <ol className="mt-3 space-y-2">
        {plan.actions.map((item, index) => (
          <li key={`${plan.id}-${item.type}-${item.obligationId ?? index}`} className="text-sm">
            <span className="font-medium">{item.label}</span>
            {item.amount != null ? (
              <span className="ml-2 font-mono tabular-nums text-muted-foreground">
                {formatCurrency(item.amount)}
              </span>
            ) : null}
            {item.detail ? <span className="mt-0.5 block text-muted-foreground">{item.detail}</span> : null}
          </li>
        ))}
      </ol>
    ) : null}

    {children}

    {plan.actions.length > 0 ? (
      <div className="mt-4">
        <Button
          type="button"
          variant={featured ? 'default' : 'outline'}
          className={cn(!featured && 'rounded-xl')}
          onClick={onChoose}
          aria-pressed={featured}
        >
          {ctaLabel}
        </Button>
      </div>
    ) : null}
  </article>
);
