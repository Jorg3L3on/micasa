'use client';

import Link from 'next/link';
import { useState } from 'react';
import { MONTHLY_PANEL_SHELL_CLASS, PANEL_INSET_CLASS } from '@/components/monthly/monthly-panel-shell';
import { PLAN_COPY } from '@/components/wallets/liquidity/plan/copy';
import { gapHref, uniqueGaps } from '@/components/wallets/liquidity/plan/plan-flow';
import { SHORTFALL_WEIGHTS } from '@/lib/finance/cash-plan/score';
import type { DataGap, Obligation } from '@/lib/finance/cash-plan/types';
import { cn, formatCurrency } from '@/lib/utils';

const RAIL_CARD_CLASS = cn(MONTHLY_PANEL_SHELL_CLASS, 'space-y-3 p-4');

const RailTitle = ({ id, title, hint }: { id: string; title: string; hint?: string }) => (
  <div>
    <h3 id={id} className="text-sm font-semibold">{title}</h3>
    {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
  </div>
);

/** One row per missing datum, each with the link that completes it. Folded on phones unless confidence is low. */
export const PlanDataGapsPanel = ({ gaps, startOpen = false }: { gaps: readonly DataGap[]; startOpen?: boolean }) => {
  const [openOnPhone, setOpenOnPhone] = useState(startOpen);
  const rows = uniqueGaps(gaps);
  if (rows.length === 0) return null;
  return (
    <section className={RAIL_CARD_CLASS} aria-labelledby="plan-gaps-title" data-testid="plan-gaps-panel">
      <div className="flex items-start justify-between gap-2">
        <RailTitle id="plan-gaps-title" title={`${PLAN_COPY.gapsRailTitle} · ${rows.length}`} />
        <button
          type="button"
          className="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-border px-3 text-sm font-semibold lg:hidden"
          aria-expanded={openOnPhone}
          aria-controls="plan-gaps-body"
          onClick={() => setOpenOnPhone((open) => !open)}
        >
          {openOnPhone ? PLAN_COPY.fold : PLAN_COPY.unfold}
        </button>
      </div>
      <div id="plan-gaps-body" className={cn('space-y-3', !openOnPhone && 'max-lg:hidden')}>
        <ul className="space-y-2">
          {rows.map((gap) => {
            const href = gapHref(gap);
            return (
              <li
                key={`${gap.code}-${gap.obligationId ?? gap.message}`}
                className={cn(PANEL_INSET_CLASS, 'flex flex-wrap items-center justify-between gap-2 px-3 py-2.5')}
              >
                <span className="min-w-0 flex-1 basis-40 text-xs leading-snug">{gap.message}</span>
                {href ? (
                  <Link
                    href={href}
                    className="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-border px-3 text-sm font-semibold hover:bg-muted"
                  >
                    {PLAN_COPY.gapAdd}
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted-foreground">{PLAN_COPY.gapsRailHint}</p>
      </div>
    </section>
  );
};

/** Shortfall only: the payments the primary route leaves alone, with their amounts. */
export const PlanUntouchablesPanel = ({
  labels,
  obligations,
}: {
  labels: readonly string[];
  obligations: readonly Obligation[];
}) => {
  if (labels.length === 0) return null;
  return (
    <section className={RAIL_CARD_CLASS} aria-labelledby="plan-untouched-title">
      <RailTitle id="plan-untouched-title" title={PLAN_COPY.untouchablesTitle} hint={PLAN_COPY.untouchablesHint} />
      <ul className="space-y-1.5 text-sm">
        {labels.map((label) => {
          const amount = obligations
            .filter((item) => item.labelSynthetic === label)
            .reduce((sum, item) => sum + (item.statementDue ?? item.msiInstallment ?? 0), 0);
          return (
            <li key={label} className="flex items-start justify-between gap-3">
              <span className="min-w-0 break-words">{label}</span>
              {amount > 0 ? (
                <span className="shrink-0 whitespace-nowrap font-sans tabular-nums text-muted-foreground">
                  {formatCurrency(amount)}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

/** The five ranking weights, read from `score.ts`. */
export const PlanWeightsPanel = () => {
  const entries = Object.entries(SHORTFALL_WEIGHTS) as Array<[keyof typeof SHORTFALL_WEIGHTS, number]>;
  const max = Math.max(...entries.map(([, weight]) => weight));
  return (
    <section className={RAIL_CARD_CLASS} aria-labelledby="plan-weights-title" data-testid="plan-weights-panel">
      <RailTitle id="plan-weights-title" title={PLAN_COPY.weightsTitle} hint={PLAN_COPY.weightsHint} />
      <ul className="space-y-2.5">
        {entries.map(([key, weight]) => (
          <li key={key} className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span>{PLAN_COPY.weightLabels[key]}</span>
              <span className="tabular-nums text-muted-foreground">{Math.round(weight * 100)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
              <span className="block h-full rounded-full bg-primary" style={{ width: `${(weight / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};
