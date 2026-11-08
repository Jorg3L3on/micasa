'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { MONTHLY_PANEL_SHELL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { SectionHeader } from '@/components/section-header';
import { Button } from '@/components/ui/button';
import { PLAN_COPY } from '@/components/wallets/liquidity/plan/copy';
import { gapHref } from '@/components/wallets/liquidity/plan/plan-flow';
import { stepButton, stepDateLabel } from '@/components/wallets/liquidity/plan/step-format';
import type { DataGap, Obligation, RankedPlan } from '@/lib/finance/cash-plan/types';
import { cn, formatCurrency } from '@/lib/utils';

type PlanStepsPanelProps = {
  plan: RankedPlan;
  obligations: readonly Obligation[];
  dataGaps: readonly DataGap[];
  /** Funding wallet names by id, for "origen → destino". */
  walletNames: ReadonlyMap<number, string>;
  todayYmd: string;
  monthlyPanelHref: string;
  onActivate: () => void;
  onMarkOnly: () => void;
  /** Why "Activar este plan" is off right now (a simulation on screen). */
  activateBlockedReason?: string | null;
  /** The step checklist, when open. */
  children?: ReactNode;
};

const LINK_BUTTON_CLASS =
  'inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border px-3.5 text-sm font-semibold transition-colors';

/**
 * "Tus pasos con esta ruta": one numbered step per action of the chosen route,
 * with its date, where the money goes, the amount and one button.
 */
export const PlanStepsPanel = ({
  plan,
  obligations,
  dataGaps,
  walletNames,
  todayYmd,
  monthlyPanelHref,
  onActivate,
  onMarkOnly,
  activateBlockedReason,
  children,
}: PlanStepsPanelProps) => {
  if (plan.actions.length === 0) return null;

  return (
    <section className={cn(MONTHLY_PANEL_SHELL_CLASS, 'space-y-5 p-4 sm:p-6')} aria-labelledby="plan-steps-title">
      <SectionHeader id="plan-steps-title" title={PLAN_COPY.stepsTitle} subtitle={plan.title} />

      <ol className="space-y-4">
        {plan.actions.map((step, index) => {
          const obligation = step.obligationId ? obligations.find((item) => item.id === step.obligationId) : undefined;
          const gap = step.obligationId ? dataGaps.find((item) => item.obligationId === step.obligationId) : undefined;
          const date = stepDateLabel(step.dueDate, todayYmd);
          const from = step.fromWalletId != null ? walletNames.get(step.fromWalletId) : undefined;
          const to = obligation?.labelSynthetic;
          const button = gap
            ? { label: PLAN_COPY.stepAddPayment, href: gapHref(gap) ?? monthlyPanelHref }
            : stepButton(step, monthlyPanelHref);
          return (
            <li
              key={`${step.type}-${step.obligationId ?? index}`}
              data-step-type={step.type}
              data-gap={gap ? 'true' : undefined}
              className={cn(
                'flex gap-3',
                gap && 'rounded-xl border border-dashed border-status-pending-border bg-status-pending-soft p-3',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-bold tabular-nums',
                  gap ? 'border-status-pending-border text-status-pending' : 'border-border',
                )}
              >
                {index + 1}
              </span>
              <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="min-w-0 flex-1 basis-56 space-y-0.5">
                  <p className="eyebrow text-muted-foreground" data-testid="step-date">
                    {date ?? PLAN_COPY.stepNoDate}
                  </p>
                  <p className="text-sm font-semibold leading-snug break-words">{step.label}</p>
                  {from || to ? (
                    <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground" data-testid="step-route">
                      {from ? <span>{from}</span> : null}
                      {from && to ? <ArrowRight className="size-3 shrink-0" aria-label="a" /> : null}
                      {to ? <span>{to}</span> : null}
                    </p>
                  ) : null}
                  {gap ? <p className="text-xs text-status-pending">{gap.message}</p> : null}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {step.amount != null ? (
                    <span className="whitespace-nowrap font-sans font-semibold tabular-nums">{formatCurrency(step.amount)}</span>
                  ) : null}
                  {button ? (
                    <Link
                      href={button.href}
                      className={cn(
                        LINK_BUTTON_CLASS,
                        gap
                          ? 'border-status-pending-border text-status-pending hover:bg-status-pending-soft'
                          : 'border-border hover:bg-muted',
                      )}
                    >
                      {button.label}
                    </Link>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <p className="border-t border-border/50 pt-4 text-sm text-muted-foreground">{plan.summary}</p>

      {children}

      <div className="sticky bottom-24 z-10 -mx-2 flex flex-col gap-2 rounded-2xl bg-background/90 p-2 backdrop-blur md:static md:mx-0 md:flex-row md:items-center md:bg-transparent md:p-0 md:backdrop-blur-none">
        <Button
          type="button"
          className="h-11 rounded-xl shadow-lg md:shadow-none"
          onClick={onActivate}
          disabled={Boolean(activateBlockedReason)}
          aria-describedby={activateBlockedReason ? 'plan-activate-blocked' : undefined}
        >
          {PLAN_COPY.activate}
        </Button>
        <Button type="button" variant="ghost" className="h-11 rounded-xl" onClick={onMarkOnly}>
          {PLAN_COPY.markOnly}
        </Button>
      </div>
      {activateBlockedReason ? (
        <p id="plan-activate-blocked" className="text-xs text-status-pending">{activateBlockedReason}</p>
      ) : null}
      <p className="text-xs text-muted-foreground">{PLAN_COPY.activateHint}</p>
    </section>
  );
};
