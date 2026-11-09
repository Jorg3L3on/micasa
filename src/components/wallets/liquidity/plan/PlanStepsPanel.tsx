'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { MONTHLY_PANEL_SHELL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { SectionHeader } from '@/components/section-header';
import { Button } from '@/components/ui/button';
import { PLAN_COPY } from '@/components/wallets/liquidity/plan/copy';
import { gapHref } from '@/components/wallets/liquidity/plan/plan-flow';
import {
  stepButton,
  stepDateLabel,
  stepSortDate,
  type StepButton,
  type StepIncome,
} from '@/components/wallets/liquidity/plan/step-format';
import type { DataGap, Obligation, RankedPlan } from '@/lib/finance/cash-plan/types';
import { cn, formatCurrency } from '@/lib/utils';

/** A payment the period already has in the Panel and the route leaves as is. */
export type PanelBill = { obligationId: string; label: string; amount: number; dueDate: string };

/** A card whose statement payment is missing: a step to add it. */
export type MissingStatement = { walletId: number; name: string; dueDate: string };

type PlanStepsPanelProps = {
  plan: RankedPlan;
  obligations: readonly Obligation[];
  dataGaps: readonly DataGap[];
  /** Funding wallet names by id, for "origen → destino". */
  walletNames: ReadonlyMap<number, string>;
  todayYmd: string;
  /** Expected incomes inside the plan's period, by date. */
  incomes?: readonly StepIncome[];
  panelBills?: readonly PanelBill[];
  missingStatements?: readonly MissingStatement[];
  /** Route steps marked in the checklist. */
  doneCount?: number;
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

/** Steps shown before "N pasos más · Ver todos". */
const VISIBLE_STEPS = 4;

type TimelineItem = {
  key: string;
  sortDate: string;
  date: string;
  title: string;
  from?: string;
  to?: string;
  amount?: number;
  button: StepButton | null;
  /** Amber: depends on missing data. */
  gapMessage?: string;
  note?: string;
  stepType: string;
};

/**
 * "Tus pasos con esta ruta": one dated timeline with the route's steps, the
 * payments already in the Panel and the statement payments still missing.
 */
export const PlanStepsPanel = ({
  plan,
  obligations,
  dataGaps,
  walletNames,
  todayYmd,
  incomes = [],
  panelBills = [],
  missingStatements = [],
  doneCount = 0,
  monthlyPanelHref,
  onActivate,
  onMarkOnly,
  activateBlockedReason,
  children,
}: PlanStepsPanelProps) => {
  const [showAll, setShowAll] = useState(false);
  if (plan.actions.length === 0) return null;

  const routeItems: TimelineItem[] = plan.actions.map((step, index) => {
    const obligation = step.obligationId ? obligations.find((item) => item.id === step.obligationId) : undefined;
    const gap = step.obligationId ? dataGaps.find((item) => item.obligationId === step.obligationId) : undefined;
    return {
      key: `${step.type}-${step.obligationId ?? index}`,
      sortDate: stepSortDate(step.dueDate, todayYmd, incomes, step.type),
      date: stepDateLabel(step.dueDate, todayYmd, incomes, step.type) ?? PLAN_COPY.stepNoDate,
      title: step.label,
      from: step.fromWalletId != null ? walletNames.get(step.fromWalletId) : undefined,
      to: obligation?.labelSynthetic,
      amount: step.amount,
      button: gap
        ? { label: PLAN_COPY.stepAddPayment, href: gapHref(gap) ?? monthlyPanelHref }
        : stepButton(step, monthlyPanelHref),
      gapMessage: gap?.message,
      stepType: step.type,
    };
  });
  const panelItems: TimelineItem[] = panelBills.map((bill) => ({
    key: `panel-${bill.obligationId}`,
    sortDate: bill.dueDate,
    date: stepDateLabel(bill.dueDate, todayYmd, incomes) ?? PLAN_COPY.stepNoDate,
    title: PLAN_COPY.stepPanelBill(bill.label),
    amount: bill.amount,
    button: null,
    note: PLAN_COPY.stepInPanel,
    stepType: 'in_panel',
  }));
  const missingItems: TimelineItem[] = missingStatements.map((card) => ({
    key: `missing-${card.walletId}`,
    sortDate: card.dueDate,
    date: stepDateLabel(card.dueDate, todayYmd, incomes) ?? PLAN_COPY.stepNoDate,
    title: PLAN_COPY.stepConfirmStatement(card.name),
    button: { label: PLAN_COPY.stepAddPayment, href: `/credit-cards/${card.walletId}` },
    gapMessage: PLAN_COPY.stepMissingStatement,
    stepType: 'missing_statement',
  }));
  // Dated first, by day; steps without a day keep their order at the end.
  const items = [...routeItems, ...panelItems, ...missingItems]
    .map((item, order) => ({ item, order }))
    .sort((a, b) => a.item.sortDate.localeCompare(b.item.sortDate) || a.order - b.order)
    .map(({ item }) => item);
  const hidden = Math.max(0, items.length - VISIBLE_STEPS);
  const visible = showAll ? items : items.slice(0, VISIBLE_STEPS);

  return (
    <section className={cn(MONTHLY_PANEL_SHELL_CLASS, 'space-y-5 p-4 sm:p-6')} aria-labelledby="plan-steps-title">
      <SectionHeader
        id="plan-steps-title"
        title={PLAN_COPY.stepsTitle}
        subtitle={`${plan.title} · ${PLAN_COPY.stepsDone(doneCount, plan.actions.length)}`}
      />

      <ol className="space-y-4" id="plan-steps-list">
        {visible.map((item, index) => (
          <li
            key={item.key}
            data-step-type={item.stepType}
            data-gap={item.gapMessage ? 'true' : undefined}
            className={cn(
              'flex gap-3',
              item.gapMessage && 'rounded-xl border border-dashed border-status-pending-border bg-status-pending-soft p-3',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-bold tabular-nums',
                item.gapMessage ? 'border-status-pending-border text-status-pending' : 'border-border',
              )}
            >
              {index + 1}
            </span>
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="min-w-0 flex-1 basis-56 space-y-0.5">
                <p className="eyebrow text-muted-foreground" data-testid="step-date">{item.date}</p>
                <p className="text-sm font-semibold leading-snug break-words">{item.title}</p>
                {item.from || item.to ? (
                  <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground" data-testid="step-route">
                    {item.from ? <span>{item.from}</span> : null}
                    {item.from && item.to ? <ArrowRight className="size-3 shrink-0" aria-label="a" /> : null}
                    {item.to ? <span>{item.to}</span> : null}
                  </p>
                ) : null}
                {item.note ? <p className="text-xs text-muted-foreground">{item.note}</p> : null}
                {item.gapMessage ? <p className="text-xs text-status-pending">{item.gapMessage}</p> : null}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {item.amount != null ? (
                  <span className="whitespace-nowrap font-sans font-semibold tabular-nums">{formatCurrency(item.amount)}</span>
                ) : null}
                {item.button ? (
                  <Link
                    href={item.button.href}
                    className={cn(
                      LINK_BUTTON_CLASS,
                      item.gapMessage
                        ? 'border-status-pending-border text-status-pending hover:bg-status-pending-soft'
                        : 'border-border hover:bg-muted',
                    )}
                  >
                    {item.button.label}
                  </Link>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ol>

      {hidden > 0 ? (
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-xl px-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
          aria-expanded={showAll}
          aria-controls="plan-steps-list"
          onClick={() => setShowAll((open) => !open)}
        >
          {showAll ? PLAN_COPY.stepsShowLess : PLAN_COPY.stepsShowMore(hidden)}
        </button>
      ) : null}

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
