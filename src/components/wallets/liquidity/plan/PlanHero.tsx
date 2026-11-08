'use client';

import { AlertTriangle, Check } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { CurrencyTicker } from '@/components/motion/number-ticker';
import { PLAN_COPY } from '@/components/wallets/liquidity/plan/copy';
import type { PlanConfidence, PlanHorizon, PlanMode } from '@/lib/finance/cash-plan/types';

/** With a simulation on screen: the hueco before it, and what moved. */
export type PlanHeroScenario =
  | { kind: 'changed'; previousGapAmount: number; previousMode: PlanMode; deltaNote: string }
  | { kind: 'unchanged'; title: string; body: string };

type PlanHeroProps = {
  mode: PlanMode;
  gapAmount: number;
  horizon: PlanHorizon;
  /** e.g. "Quincena 31 oct–14 nov". */
  periodLabel: string;
  /** e.g. "Hoy 7 nov". */
  todayLabel?: string;
  confidence: PlanConfidence;
  /** Number of data gaps the plan reported. */
  gapCount: number;
  scenario?: PlanHeroScenario | null;
};

const CHIP_CLASS =
  'inline-flex min-h-7 w-fit items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs font-semibold';

export const confidenceChipLabel = (confidence: PlanConfidence, gapCount: number): string => {
  if (confidence === 'high' && gapCount === 0) return PLAN_COPY.confidenceHigh;
  const level = confidence === 'low' ? PLAN_COPY.confidenceLow : confidence === 'medium' ? PLAN_COPY.confidenceMedium : PLAN_COPY.confidenceHighLevel;
  return `${level} · ${PLAN_COPY.gapsPending(gapCount)}`;
};

export const ConfidenceChip = ({ confidence, gapCount }: { confidence: PlanConfidence; gapCount: number }) => {
  const good = confidence === 'high' && gapCount === 0;
  return (
    <span
      data-testid="plan-confidence"
      data-confidence={confidence}
      className={cn(
        CHIP_CLASS,
        good
          ? 'border-status-success-border bg-status-success-soft text-status-success'
          : 'border-status-pending-border bg-status-pending-soft text-status-pending',
      )}
    >
      {good ? <Check className="size-3" aria-hidden /> : <AlertTriangle className="size-3" aria-hidden />}
      {confidenceChipLabel(confidence, gapCount)}
    </span>
  );
};

const periodWord = (horizon: PlanHorizon): string =>
  horizon === 'quincena' ? PLAN_COPY.thisFortnight : PLAN_COPY.thisMonth;

/** The hero as plain text; the heading's accessible name (the ticker splits digits). */
export const planHeroSentence = (mode: PlanMode, gapAmount: number, horizon: PlanHorizon): string => {
  if (mode === 'balanced') return PLAN_COPY.balancedTitle;
  const lead = mode === 'surplus' ? PLAN_COPY.surplusLead : PLAN_COPY.shortfallLead;
  return `${lead} ${formatCurrency(Math.abs(gapAmount))} ${periodWord(horizon)}`;
};

/**
 * The plan's number as a sentence: "Te sobran $X esta quincena",
 * "Te faltan $X esta quincena" or "Este periodo cuadra", with its confidence.
 */
export const PlanHero = ({
  mode,
  gapAmount,
  horizon,
  periodLabel,
  todayLabel,
  confidence,
  gapCount,
  scenario,
}: PlanHeroProps) => {
  const amount = Math.abs(gapAmount);
  const eyebrow = [PLAN_COPY.tabPlan, periodLabel, todayLabel].filter(Boolean).join(' · ');
  const showBefore = scenario?.kind === 'changed' && scenario.previousMode === mode;

  return (
    <section className="space-y-3" aria-labelledby="plan-hero-title">
      <p className="eyebrow text-muted-foreground">{eyebrow}</p>
      <h2 id="plan-hero-title" aria-label={planHeroSentence(mode, gapAmount, horizon)} className="text-display font-extrabold sm:text-4xl">
        {mode === 'balanced' ? (
          <>
            {PLAN_COPY.balancedLead} <span className="text-status-success">{PLAN_COPY.balancedWord}</span>
          </>
        ) : (
          <>
            {mode === 'surplus' ? PLAN_COPY.surplusLead : PLAN_COPY.shortfallLead}{' '}
            {showBefore ? (
              <>
                <span className="whitespace-nowrap font-sans tabular-nums text-muted-foreground line-through decoration-1">
                  {formatCurrency(Math.abs(scenario.previousGapAmount))}
                </span>
                <span className="mx-1.5 text-muted-foreground" aria-label="antes, después">→</span>
              </>
            ) : null}
            <span
              className={cn(
                'whitespace-nowrap font-sans tabular-nums',
                mode === 'surplus' ? 'text-status-success' : 'text-status-overdue',
              )}
            >
              <CurrencyTicker value={amount} />
            </span>{' '}
            {periodWord(horizon)}
          </>
        )}
      </h2>
      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
        {mode === 'surplus' ? PLAN_COPY.surplusBody : mode === 'shortfall' ? PLAN_COPY.shortfallBody : PLAN_COPY.balancedBody}
      </p>
      {scenario?.kind === 'changed' ? <p className="text-xs text-muted-foreground">{scenario.deltaNote}</p> : null}
      {scenario?.kind === 'unchanged' ? (
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold">{scenario.title}</span>. {scenario.body}
        </p>
      ) : null}
      <ConfidenceChip confidence={confidence} gapCount={gapCount} />
    </section>
  );
};
