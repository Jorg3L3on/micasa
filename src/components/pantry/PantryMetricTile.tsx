'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Icon pill matches dashboard `StatCard` (h-9 w-9, rounded-lg, h-4 w-4 icon).
 * Gradients align with `STAT_CARDS` in `dashboard/page.tsx` where applicable.
 */
const TILE_GRADIENT: Record<
  'violet' | 'blue' | 'emerald' | 'amber' | 'sky' | 'slate',
  string
> = {
  violet: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
  blue: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
  emerald: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
  amber: 'linear-gradient(135deg, #eab308 0%, #facc15 100%)',
  sky: 'linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)',
  slate: 'linear-gradient(135deg, #64748b 0%, #94a3b8 100%)',
};

export type PantryMetricTileProps = {
  icon: LucideIcon;
  label: string;
  /** Main figure (pre-formatted string) */
  value: string;
  accent: keyof typeof TILE_GRADIENT;
  /** Wide row for secondary metrics (e.g. average unit price). */
  layout?: 'stack' | 'inline';
  className?: string;
};

/** Same as dashboard StatCard: h-9 w-9, rounded-lg, no extra ring/shadow on the pill. */
const iconShellClass =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg';

const tileShellClass =
  'rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-shadow duration-200 hover:shadow-md';

/**
 * Reference-dashboard style metric: gradient icon capsule, large mono value, micro label.
 */
export const PantryMetricTile = ({
  icon: Icon,
  label,
  value,
  accent,
  layout = 'stack',
  className,
}: PantryMetricTileProps) => {
  const gradient = TILE_GRADIENT[accent];

  const iconBox = (
    <div className={iconShellClass} style={{ background: gradient }}>
      <Icon className="h-4 w-4 text-white" aria-hidden />
    </div>
  );

  if (layout === 'inline') {
    return (
      <div
        className={cn(
          tileShellClass,
          'flex flex-wrap items-center gap-4 sm:flex-nowrap',
          className,
        )}
      >
        {iconBox}
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold font-mono tabular-nums tracking-tight text-foreground sm:text-xl">
            {value}
          </p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(tileShellClass, 'flex flex-col gap-3', className)}
    >
      {iconBox}
      <p className="text-lg font-bold font-mono tabular-nums tracking-tight text-foreground sm:text-xl">
        {value}
      </p>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </div>
  );
};
