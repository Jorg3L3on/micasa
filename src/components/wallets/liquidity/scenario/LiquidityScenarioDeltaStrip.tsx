'use client';

import { ArrowRight, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { METRIC_STRIP_CLASS } from '@/components/ui/metric-strip';
import { cn } from '@/lib/utils';
import type { LiquidityScenarioDelta } from '@/types/catalog';
import { SCENARIO_COPY } from '@/components/wallets/liquidity/scenario/copy';
import {
  buildScenarioDeltaRows,
  scenarioMovesNothing,
} from '@/components/wallets/liquidity/scenario/scenario-format';

type LiquidityScenarioDeltaStripProps = {
  delta: LiquidityScenarioDelta;
  until: string;
};

/**
 * Three deltas, base → scenario. Text only, no tinted fill; the soft red or
 * green goes on the change line alone. Collapses to one line when nothing moves.
 */
export const LiquidityScenarioDeltaStrip = ({ delta, until }: LiquidityScenarioDeltaStripProps) => {
  const rows = buildScenarioDeltaRows(delta, until);

  if (scenarioMovesNothing(rows)) {
    return (
      <div className={cn(METRIC_STRIP_CLASS, 'px-3 py-2.5 text-sm')}>
        <span className="font-semibold">{SCENARIO_COPY.noChange}</span>
        <span className="text-muted-foreground"> · {SCENARIO_COPY.noChangeTotal}</span>
      </div>
    );
  }

  return (
    <dl
      className={cn(METRIC_STRIP_CLASS, 'grid gap-3 px-3 py-3 sm:grid-cols-3 sm:gap-4 sm:px-4')}
      aria-label="Cambios con esta simulación"
    >
      {rows.map((row) => (
        <div key={row.id} className="min-w-0">
          <dt className="eyebrow text-muted-foreground">{row.label}</dt>
          <dd className="mt-1">
            <span className="block font-sans text-base font-semibold tabular-nums">
              {row.change == null ? row.after : `${row.before} → ${row.after}`}
              <span className="sr-only">, {row.change ?? SCENARIO_COPY.noChange}</span>
            </span>
            <span
              aria-hidden
              className={cn(
                'mt-0.5 block text-xs tabular-nums',
                row.change == null
                  ? 'text-muted-foreground'
                  : row.worse
                    ? 'text-status-overdue'
                    : 'text-status-success',
              )}
            >
              {row.change ?? SCENARIO_COPY.noChange}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
};

type LiquidityScenarioChipProps = {
  summary: string;
  actionLabel: string;
  onAction: () => void;
  /** Mobile: the assumption rides in the chip (desktop shows it in the banner). */
  assumptions?: string[];
  className?: string;
};

/** Folded scenario: "¿Y si…? · Una compra · $1,800 · 2 nov · Débito Nómina". */
export const LiquidityScenarioChip = ({
  summary,
  actionLabel,
  onAction,
  assumptions,
  className,
}: LiquidityScenarioChipProps) => (
  <div
    className={cn(
      'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-[color-mix(in_srgb,var(--chart-2)_45%,transparent)] bg-card px-3 py-2.5',
      className,
    )}
  >
    <FlaskConical className="size-4 shrink-0 text-[color-mix(in_srgb,var(--chart-2)_70%,white)]" aria-hidden />
    <div className="min-w-0 flex-1 basis-48">
      <p className="text-xs font-semibold text-muted-foreground">{SCENARIO_COPY.title}</p>
      <p className="text-sm font-medium">{summary}</p>
      {assumptions && assumptions.length > 0 ? (
        <p className="mt-0.5 text-xs text-muted-foreground sm:hidden">{assumptions.join(' ')}</p>
      ) : null}
    </div>
    <Button type="button" variant="ghost" className="ml-auto h-9 shrink-0 rounded-xl" onClick={onAction}>
      {actionLabel}
      <ArrowRight className="size-4" aria-hidden />
    </Button>
  </div>
);
