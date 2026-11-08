'use client';

import { PLAN_COPY } from '@/components/wallets/liquidity/plan/copy';
import { cushionAfter, riskLevel } from '@/components/wallets/liquidity/plan/route-selection';
import type { PlanMode, RankedPlan } from '@/lib/finance/cash-plan/types';
import { cn, formatCurrency } from '@/lib/utils';

type PlanCompareTableProps = {
  routes: RankedPlan[];
  mode: PlanMode;
  selectedId: string;
};

const RISK_COPY = { low: PLAN_COPY.riskLow, medium: PLAN_COPY.riskMedium, high: PLAN_COPY.riskHigh } as const;

const RISK_BAR = {
  low: 'bg-status-success',
  medium: 'bg-status-pending',
  high: 'bg-status-overdue',
} as const;

const monthsLabel = (months: number): string => (months === 1 ? '1 mes' : `${months} meses`);

/** Routes side by side: cost, risk, cushion and what each one closes. */
export const PlanCompareTable = ({ routes, mode, selectedId }: PlanCompareTableProps) => {
  const lastHeader = mode === 'shortfall' ? PLAN_COPY.compareGapClosed : PLAN_COPY.statMonths;
  return (
    <div className="overflow-x-auto rounded-xl border border-border/50">
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <caption className="sr-only">{PLAN_COPY.compareCaption}</caption>
        <thead>
          <tr className="text-left">
            {[PLAN_COPY.compareRoute, PLAN_COPY.statCost, PLAN_COPY.compareRisk, PLAN_COPY.statCushion, lastHeader].map((label) => (
              <th key={label} scope="col" className="eyebrow px-3 py-2 font-semibold text-muted-foreground">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {routes.map((route) => {
            const level = riskLevel(route.scores.risk);
            const chosen = route.id === selectedId;
            return (
              <tr
                key={route.id}
                data-route-id={route.id}
                data-chosen={chosen}
                aria-current={chosen ? 'true' : undefined}
                className={cn('border-t border-border/50', chosen && 'bg-primary/10 dark:bg-primary/15')}
              >
                <th scope="row" className="px-3 py-2.5 text-left font-medium">
                  {route.title}
                </th>
                <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{formatCurrency(route.estimatedCost)}</td>
                <td className="px-3 py-2.5">
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-12 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <span
                        className={cn('block h-full rounded-full', RISK_BAR[level])}
                        style={{ width: `${Math.max(6, Math.round(route.scores.risk * 100))}%` }}
                      />
                    </span>
                    {RISK_COPY[level]}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{formatCurrency(cushionAfter(route))}</td>
                <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">
                  {mode === 'shortfall'
                    ? `${Math.round(route.scores.gapClosed * 100)}%`
                    : monthsLabel(route.impact?.monthsDelta ?? 0)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
