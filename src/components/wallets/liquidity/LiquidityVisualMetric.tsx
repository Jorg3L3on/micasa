'use client';

import type { ReactNode } from 'react';
import { cn, formatCurrency } from '@/lib/utils';
import { METRIC_STRIP_CLASS } from '@/components/ui/metric-strip';

type LiquidityVisualMetricProps = {
  label: string;
  hint: string;
  amount: number;
  icon: ReactNode;
  borderClass: string;
  amountClassName?: string;
  statusLabel?: string;
  statusTone?: 'emerald' | 'amber' | 'destructive' | 'sky' | 'violet';
  barPercent?: number;
  barTone?: 'emerald' | 'amber' | 'destructive' | 'violet' | 'sky';
};

const statusToneClass = {
  emerald: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300',
  amber: 'bg-amber-500/10 text-amber-800 ring-amber-500/20 dark:text-amber-300',
  destructive: 'bg-destructive/10 text-destructive ring-destructive/20',
  sky: 'bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-300',
  violet: 'bg-violet-500/10 text-violet-700 ring-violet-500/20 dark:text-violet-300',
} as const;

const barToneClass = {
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  destructive: 'bg-destructive',
  violet: 'bg-violet-500',
  sky: 'bg-sky-500',
} as const;

export const LiquidityVisualMetric = ({
  label,
  hint,
  amount,
  icon,
  borderClass,
  amountClassName,
  statusLabel,
  statusTone = 'emerald',
  barPercent,
  barTone = 'emerald',
}: LiquidityVisualMetricProps) => {
  return (
    <div
      className={cn(METRIC_STRIP_CLASS, 'border-l-[3px]', borderClass)}
      role="region"
      aria-label={label}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <p className="text-sm font-medium text-foreground">{label}</p>
            <p className="text-[11px] text-muted-foreground">{hint}</p>
          </div>
        </div>
        {statusLabel ? (
          <span
            className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1',
              statusToneClass[statusTone],
            )}
          >
            {statusLabel}
          </span>
        ) : null}
      </div>

      <p
        className={cn(
          'mt-3 font-mono text-2xl font-bold tabular-nums tracking-tight',
          amountClassName,
        )}
      >
        {formatCurrency(amount)}
      </p>

      {barPercent != null ? (
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted/40">
          <div
            className={cn('h-full rounded-full transition-all', barToneClass[barTone])}
            style={{ width: `${Math.min(100, Math.max(0, barPercent))}%` }}
          />
        </div>
      ) : null}
    </div>
  );
};
