import { cn } from '@/lib/utils';

/** Calm KPI tile. Tone is a left border, not a gradient fill. */
export type KpiMetricTone = 'blue' | 'emerald' | 'destructive' | 'neutral';

const shellByTone: Record<KpiMetricTone, string> = {
  blue: 'border-border/60 border-l-[3px] border-l-status-info bg-card',
  emerald: 'border-border/60 border-l-[3px] border-l-status-success bg-card',
  destructive: 'border-border/60 border-l-[3px] border-l-status-expense bg-card',
  neutral: 'border-border/60 bg-card',
};

const labelByTone: Record<KpiMetricTone, string> = {
  blue: 'text-status-info',
  emerald: 'text-status-success',
  destructive: 'text-status-expense',
  neutral: 'text-muted-foreground',
};

export const kpiMetricCardShellClass = (tone: KpiMetricTone) =>
  cn('relative overflow-hidden rounded-xl border px-2 py-1.5 shadow-card', shellByTone[tone]);

export const kpiMetricLabelClass = (tone: KpiMetricTone) =>
  cn('truncate text-caption font-semibold leading-tight', labelByTone[tone]);

export const kpiMetricValueClass = (tone: KpiMetricTone) => {
  if (tone === 'destructive') return 'text-status-expense';
  if (tone === 'emerald') return 'text-status-success';
  if (tone === 'neutral') return 'text-muted-foreground';
  return 'text-foreground';
};
