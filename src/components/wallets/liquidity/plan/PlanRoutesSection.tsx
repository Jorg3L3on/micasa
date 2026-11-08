'use client';

import type { ReactNode } from 'react';
import { MONTHLY_PANEL_SHELL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { SectionHeader } from '@/components/section-header';
import { PLAN_COPY } from '@/components/wallets/liquidity/plan/copy';
import { PlanCompareTable } from '@/components/wallets/liquidity/plan/PlanCompareTable';
import { PlanRouteCard } from '@/components/wallets/liquidity/plan/PlanRouteCard';
import {
  rankedRoutes,
  resolveFeaturedPlan,
  type TiePreference,
} from '@/components/wallets/liquidity/plan/route-selection';
import { WhyPanel } from '@/components/wallets/liquidity/plan/WhyPanel';
import type { PlanResult } from '@/lib/finance/cash-plan/types';
import { cn } from '@/lib/utils';

type PlanRoutesSectionProps = {
  plan: PlanResult;
  selectedPlanId: string | null;
  tiePreference: TiePreference | null;
  onChoose: (planId: string) => void;
  onPreferTie: (preference: TiePreference) => void;
  /** Rendered under the featured route's card (the step checklist until T4). */
  featuredFooter?: ReactNode;
};

/**
 * The routes as comparable cards in rank order, then the comparison table
 * and "Por qué esta ruta", both open.
 */
export const PlanRoutesSection = ({
  plan,
  selectedPlanId,
  tiePreference,
  onChoose,
  onPreferTie,
  featuredFooter,
}: PlanRoutesSectionProps) => {
  const routes = rankedRoutes(plan);
  const featured = resolveFeaturedPlan(plan, selectedPlanId, tiePreference);
  const title = plan.mode === 'shortfall' ? PLAN_COPY.routesTitleShort : PLAN_COPY.routesTitle;

  return (
    <div className="space-y-6">
      <section className="space-y-4" aria-labelledby="plan-routes-title">
        <SectionHeader id="plan-routes-title" title={title} subtitle={PLAN_COPY.routesHint} />
        {plan.primary.id === 'empty' ? (
          <p className="text-sm text-muted-foreground">{PLAN_COPY.noSafePrimary}</p>
        ) : null}
        <div
          className={cn(
            'grid gap-4',
            routes.length >= 3 ? 'md:grid-cols-2 xl:grid-cols-3' : routes.length === 2 ? 'md:grid-cols-2' : null,
          )}
        >
          {routes.map((route) => (
            <PlanRouteCard
              key={route.id}
              plan={route}
              mode={plan.mode}
              isPrimary={route.id === plan.primary.id}
              selected={route.id === featured.id}
              onChoose={() => onChoose(route.id)}
              tie={plan.tie && route.id === plan.primary.id ? { preference: tiePreference, onPrefer: onPreferTie } : null}
            />
          ))}
        </div>
        {featuredFooter}
      </section>

      <section className={cn(MONTHLY_PANEL_SHELL_CLASS, 'space-y-4 p-4 sm:p-6')} aria-labelledby="plan-why-title">
        <SectionHeader id="plan-why-title" title={PLAN_COPY.why} />
        <WhyPanel explainability={plan.explainability} />
        {routes.length > 1 ? <PlanCompareTable routes={routes} mode={plan.mode} selectedId={featured.id} /> : null}
      </section>
    </div>
  );
};
