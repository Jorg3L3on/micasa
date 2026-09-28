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
  emerald: 'bg-status-income/10 text-status-income ring-status-income/20 dark:text-status-income',
  amber: 'bg-status-pending/10 text-status-pending ring-status-pending/20 dark:text-status-pending',
  destructive: 'bg-destructive/10 text-destructive ring-destructive/20',
  sky: 'bg-status-info/10 text-status-info ring-status-info/20 dark:text-status-info',
  violet: 'bg-status-info/10 text-status-info ring-status-info/20 dark:text-status-info',
} as const;

const barToneClass = {
  emerald: 'bg-status-income',
  amber: 'bg-status-pending',
  destructive: 'bg-destructive',
  violet: 'bg-status-info',
  sky: 'bg-status-info',
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
            <p className="text-caption text-muted-foreground">{hint}</p>
          </div>
        </div>
        {statusLabel ? (
          <span
            className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-caption font-semibold ring-1',
              statusToneClass[statusTone],
            )}
          >
            {statusLabel}
          </span>
        ) : null}
      </div>

      <p
        className={cn(
          'mt-3 font-sans text-2xl font-bold tabular-nums tracking-tight',
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
