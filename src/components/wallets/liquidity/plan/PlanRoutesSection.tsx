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
  /** Shortfall: the bridge-loan fields, inside the bridge card (or a card of their own until it exists). */
  bridgeInputs?: ReactNode;
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
  bridgeInputs,
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
            <div
              key={route.id}
              className={cn('flex min-w-0', route.id === featured.id ? 'max-md:order-first' : 'max-md:hidden')}
            >
              <PlanRouteCard
                plan={route}
                mode={plan.mode}
                isPrimary={route.id === plan.primary.id}
                selected={route.id === featured.id}
                onChoose={() => onChoose(route.id)}
                tie={plan.tie && route.id === plan.primary.id ? { preference: tiePreference, onPrefer: onPreferTie } : null}
              >
                {route.strategyKey === 'bridge' ? bridgeInputs : null}
              </PlanRouteCard>
            </div>
          ))}
          {plan.mode === 'shortfall' && bridgeInputs && !routes.some((route) => route.strategyKey === 'bridge') ? (
            <section
              aria-labelledby="plan-bridge-draft-title"
              data-testid="bridge-draft-card"
              className={cn(MONTHLY_PANEL_SHELL_CLASS, 'flex min-w-0 flex-col gap-3 p-4 max-md:hidden sm:p-5')}
            >
              <span className="inline-flex min-h-7 w-fit items-center rounded-full border border-border px-2.5 text-xs font-semibold">
                {PLAN_COPY.badgeSimulated}
              </span>
              <h3 id="plan-bridge-draft-title" className="text-title">{PLAN_COPY.bridgeDraftTitle}</h3>
              <p className="text-sm text-muted-foreground">{PLAN_COPY.bridgeDraftBody}</p>
              {bridgeInputs}
            </section>
          ) : null}
        </div>
        {routes.length > 1 ? (
          <ul className="space-y-2 md:hidden" aria-label={PLAN_COPY.otherRoutes}>
            {routes
              .filter((route) => route.id !== featured.id)
              .map((route) => (
                <li key={route.id}>
                  <button
                    type="button"
                    onClick={() => onChoose(route.id)}
                    aria-label={`${PLAN_COPY.choose}: ${route.title}`}
                    className={cn(
                      MONTHLY_PANEL_SHELL_CLASS,
                      'flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold break-words">{route.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {route.id === plan.primary.id ? PLAN_COPY.badgePrimary : PLAN_COPY.badgeAlternative}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-muted-foreground">{PLAN_COPY.choose}</span>
                  </button>
                </li>
              ))}
          </ul>
        ) : null}
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
