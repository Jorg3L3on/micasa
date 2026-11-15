import { cn } from '@/lib/utils';

/** Calm KPI tile. Tone lives on the label and value color; no left accent, no gradient fill. */
export type KpiMetricTone = 'blue' | 'emerald' | 'income' | 'destructive' | 'neutral';

const labelByTone: Record<KpiMetricTone, string> = {
  blue: 'text-status-info',
  emerald: 'text-status-success',
  income: 'text-status-income',
  destructive: 'text-status-expense',
  neutral: 'text-muted-foreground',
};

export const KPI_METRIC_CARD_SHELL_CLASS =
  'relative overflow-hidden rounded-xl border border-border/60 bg-card px-2 py-1.5 shadow-card';

export const kpiMetricLabelClass = (tone: KpiMetricTone) =>
  cn('truncate text-caption font-semibold leading-tight', labelByTone[tone]);

export const kpiMetricValueClass = (tone: KpiMetricTone) => {
  if (tone === 'destructive') return 'text-foreground';
  if (tone === 'income') return 'text-status-income';
  if (tone === 'emerald') return 'text-status-success';
  if (tone === 'neutral') return 'text-muted-foreground';
  return 'text-foreground';
};
