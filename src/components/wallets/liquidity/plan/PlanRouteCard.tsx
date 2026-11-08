'use client';

import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MONTHLY_PANEL_SHELL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { RISK_TAG_LABELS } from '@/lib/finance/cash-plan/catalog';
import { cn, formatCurrency } from '@/lib/utils';
import { PLAN_COPY } from '@/components/wallets/liquidity/plan/copy';
import {
  cushionAfter,
  isSimulatedRoute,
  METHOD_LABELS,
  topRiskTag,
  type TiePreference,
} from '@/components/wallets/liquidity/plan/route-selection';
import type { PlanMode, RankedPlan } from '@/lib/finance/cash-plan/types';

type PlanRouteCardProps = {
  plan: RankedPlan;
  mode: PlanMode;
  /** The engine's primary route. */
  isPrimary: boolean;
  /** The route the screen features now. */
  selected: boolean;
  onChoose: () => void;
  /** Tie between the primary and its runner-up: the primary shows the chip pair. */
  tie?: { preference: TiePreference | null; onPrefer: (preference: TiePreference) => void } | null;
  children?: ReactNode;
};

const CHIP_CLASS =
  'inline-flex min-h-7 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 text-xs font-semibold';

/** Allocation colors in order; the route's actions take them one by one. */
const ALLOCATION_COLORS = ['var(--chart-2)', 'var(--chart-4)', 'var(--primary)', 'var(--muted-foreground)'];

const Stat = ({ value, label, tone }: { value: string; label: string; tone?: 'good' | 'bad' | 'muted' }) => (
  <div className="flex min-w-0 flex-col gap-0.5">
    <span
      className={cn(
        'whitespace-nowrap font-sans text-base font-bold tabular-nums',
        tone === 'good' && 'text-status-success',
        tone === 'bad' && 'text-status-overdue',
        tone === 'muted' && 'text-muted-foreground',
      )}
    >
      {value}
    </span>
    <span className="text-xs text-muted-foreground">{label}</span>
  </div>
);

const monthsLabel = (months: number): string => (months === 1 ? '1 mes' : `${months} meses`);

const RouteStats = ({ plan, mode }: { plan: RankedPlan; mode: PlanMode }) => {
  if (mode === 'shortfall') {
    const lateFee = plan.estimatedRiskTags.includes('late_fee');
    const newDebt = plan.estimatedRiskTags.includes('new_debt');
    return (
      <>
        <Stat value={formatCurrency(plan.estimatedCost)} label={PLAN_COPY.statCost} />
        <Stat value={lateFee ? PLAN_COPY.statYes : PLAN_COPY.statNone} label={PLAN_COPY.statLate} tone={lateFee ? 'bad' : 'muted'} />
        <Stat value={newDebt ? PLAN_COPY.statYes : PLAN_COPY.statNone} label={PLAN_COPY.statNewDebt} tone={newDebt ? 'bad' : 'muted'} />
      </>
    );
  }
  const interest = plan.impact?.interestDelta ?? 0;
  const months = plan.impact?.monthsDelta ?? 0;
  const cushion = cushionAfter(plan);
  return (
    <>
      <Stat value={formatCurrency(interest)} label={PLAN_COPY.statInterest} tone={interest > 0 ? 'good' : 'muted'} />
      <Stat value={monthsLabel(months)} label={PLAN_COPY.statMonths} tone={months > 0 ? undefined : 'muted'} />
      <Stat value={formatCurrency(cushion)} label={PLAN_COPY.statCushion} tone={cushion > 0 ? undefined : 'muted'} />
    </>
  );
};

/**
 * One anatomy for every route: badge and method, title, summary, where the
 * money goes, three stats, one risk chip and the choose button.
 */
export const PlanRouteCard = ({ plan, mode, isPrimary, selected, onChoose, tie, children }: PlanRouteCardProps) => {
  const method = METHOD_LABELS[plan.strategyKey];
  const risk = topRiskTag(plan.estimatedRiskTags);
  const allocations = plan.actions.filter((action) => (action.amount ?? 0) > 0);
  const allocationTotal = allocations.reduce((sum, action) => sum + (action.amount ?? 0), 0);
  const titleId = `route-${plan.id}-title`;
  const badge = isPrimary
    ? PLAN_COPY.badgePrimary
    : isSimulatedRoute(plan)
      ? PLAN_COPY.badgeSimulated
      : PLAN_COPY.badgeAlternative;

  return (
    <article
      aria-labelledby={titleId}
      data-route-id={plan.id}
      data-selected={selected}
      className={cn(
        MONTHLY_PANEL_SHELL_CLASS,
        'flex w-full min-w-0 flex-col gap-4 p-4 sm:p-5',
        selected && 'border-primary ring-1 ring-primary dark:border-primary',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {isPrimary && tie ? (
          <div role="group" aria-label={PLAN_COPY.tieTitle} className="flex flex-wrap gap-2">
            {(['cost', 'risk'] as const).map((preference) => (
              <button
                key={preference}
                type="button"
                aria-pressed={tie.preference === preference}
                onClick={() => tie.onPrefer(preference)}
                className={cn(
                  CHIP_CLASS,
                  'min-h-11 cursor-pointer border-border px-3.5',
                  tie.preference === preference && 'border-primary bg-primary text-primary-foreground',
                )}
              >
                {preference === 'cost' ? PLAN_COPY.preferCost : PLAN_COPY.preferRisk}
              </button>
            ))}
          </div>
        ) : (
          <span
            data-testid="route-badge"
            className={cn(
              CHIP_CLASS,
              isPrimary ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground',
            )}
          >
            {badge}
          </span>
        )}
        {method ? <span className={cn(CHIP_CLASS, 'border-border text-muted-foreground')}>{method}</span> : null}
      </div>

      {isPrimary && tie ? <p className="-mt-2 text-xs text-muted-foreground">{PLAN_COPY.tieBody}</p> : null}

      <div className="space-y-1.5">
        <h3 id={titleId} className="text-title break-words">{plan.title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{plan.summary}</p>
      </div>

      {allocations.length > 0 ? (
        <div className="space-y-2">
          <ul className="space-y-1.5">
            {allocations.map((action, index) => (
              <li
                key={`${action.type}-${action.obligationId ?? index}`}
                className="flex items-start justify-between gap-3 text-sm"
              >
                <span className="flex min-w-0 items-start gap-2">
                  <span
                    aria-hidden
                    className="mt-1.5 inline-block size-2 shrink-0 rounded-full"
                    style={{ background: ALLOCATION_COLORS[index % ALLOCATION_COLORS.length] }}
                  />
                  <span className="min-w-0 break-words">{action.label}</span>
                </span>
                <span className="shrink-0 whitespace-nowrap font-sans font-semibold tabular-nums">
                  {formatCurrency(action.amount ?? 0)}
                </span>
              </li>
            ))}
          </ul>
          {allocationTotal > 0 ? (
            <div className="flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
              {allocations.map((action, index) => (
                <span
                  key={`${action.type}-${action.obligationId ?? index}`}
                  className="h-full"
                  style={{
                    width: `${((action.amount ?? 0) / allocationTotal) * 100}%`,
                    background: ALLOCATION_COLORS[index % ALLOCATION_COLORS.length],
                  }}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(6.5rem,1fr))] gap-x-3 gap-y-2 border-t border-border/50 pt-3">
        <RouteStats plan={plan} mode={mode} />
      </div>

      {risk ? (
        <span className={cn(CHIP_CLASS, 'w-fit border-status-pending-border bg-status-pending-soft text-status-pending')}>
          {RISK_TAG_LABELS[risk]}
        </span>
      ) : null}

      {plan.warnings.length > 0 ? (
        <ul className="space-y-1 text-sm text-muted-foreground">
          {plan.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}

      {children}

      {plan.id !== 'empty' ? (
        <Button
          type="button"
          variant={selected ? 'default' : 'outline'}
          className="mt-auto h-11 rounded-xl"
          onClick={onChoose}
          aria-pressed={selected}
        >
          {selected ? (
            <>
              <Check className="size-4" aria-hidden />
              {PLAN_COPY.chosen}
            </>
          ) : (
            PLAN_COPY.choose
          )}
        </Button>
      ) : null}
    </article>
  );
};
