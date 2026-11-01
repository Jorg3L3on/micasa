'use client';

import { FlaskConical, Info, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SCENARIO_COPY } from '@/components/wallets/liquidity/scenario/copy';

type LiquidityScenarioBannerProps = {
  /** Sentences from the response (`scenario_assumptions`). */
  assumptions: string[];
  onRemove: () => void;
};

/**
 * Chrome above the Análisis tabs while a scenario is on screen, in every tab.
 * Short on phones; on desktop it carries the scenario assumption.
 */
export const LiquidityScenarioBanner = ({ assumptions, onRemove }: LiquidityScenarioBannerProps) => (
  <div
    role="status"
    className="flex flex-col gap-2 rounded-xl border border-[color-mix(in_srgb,var(--chart-2)_45%,transparent)] bg-card px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3 sm:px-4"
  >
    <div className="flex min-w-0 flex-1 items-start gap-2">
      <FlaskConical className="mt-0.5 size-4 shrink-0 text-[color-mix(in_srgb,var(--chart-2)_70%,white)]" aria-hidden />
      <p className="min-w-0 text-sm">
        <span className="font-semibold">{SCENARIO_COPY.bannerTitle}</span>
        <span className="text-muted-foreground sm:hidden"> · {SCENARIO_COPY.bannerShort}</span>
        <span className="hidden text-muted-foreground sm:inline">
          {' '}
          {[...assumptions, SCENARIO_COPY.bannerTail].join(' ')}
        </span>
      </p>
    </div>
    <Button
      type="button"
      variant="outline"
      className="h-9 shrink-0 self-start rounded-xl sm:self-auto"
      onClick={onRemove}
    >
      <X className="size-4" aria-hidden />
      {SCENARIO_COPY.remove}
    </Button>
  </div>
);

type LiquidityScenarioNoticeProps = {
  message: string;
  onDismiss: () => void;
};

/** One-time line after a context switch dropped the scenario. */
export const LiquidityScenarioNotice = ({ message, onDismiss }: LiquidityScenarioNoticeProps) => (
  <div
    role="status"
    className="flex items-start gap-2 rounded-xl border border-border/60 bg-card px-3 py-2.5 text-sm"
  >
    <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
    <p className="min-w-0 flex-1">{message}</p>
    <button
      type="button"
      onClick={onDismiss}
      className="-m-1 rounded-md p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
      aria-label="Cerrar aviso"
    >
      <X className="size-4" aria-hidden />
    </button>
  </div>
);
