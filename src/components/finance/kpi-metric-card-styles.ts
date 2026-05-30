import { cn } from '@/lib/utils';

/** Matches Resumen de la quincena KPI tiles in SummaryBlock / Panel financiero. */
export type KpiMetricTone = 'blue' | 'emerald' | 'destructive' | 'neutral';

const shellByTone: Record<KpiMetricTone, string> = {
  blue: cn(
    'border-blue-500/25',
    'bg-gradient-to-br from-blue-500/10 via-background to-blue-500/3 dark:from-blue-500/18 dark:via-card dark:to-blue-500/5',
  ),
  emerald: cn(
    'border-emerald-500/30',
    'bg-gradient-to-br from-emerald-500/10 via-background to-emerald-500/3 dark:from-emerald-500/16 dark:via-card dark:to-emerald-500/5',
  ),
  destructive: cn(
    'border-destructive/35',
    'bg-gradient-to-br from-destructive/12 via-background to-destructive/3 dark:from-destructive/20 dark:via-card dark:to-destructive/5',
  ),
  neutral: cn(
    'border-border/50',
    'bg-gradient-to-br from-muted/30 via-background to-muted/10 dark:from-muted/20 dark:via-card dark:to-muted/5',
  ),
};

const labelByTone: Record<KpiMetricTone, string> = {
  blue: 'text-blue-700/80 dark:text-blue-300/80',
  emerald: 'text-emerald-700/85 dark:text-emerald-300/85',
  destructive: 'text-destructive/85',
  neutral: 'text-muted-foreground',
};

export const kpiMetricCardShellClass = (tone: KpiMetricTone) =>
  cn(
    'relative overflow-hidden rounded-lg border px-2 py-1.5 shadow-sm',
    shellByTone[tone],
    'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/12 before:to-transparent dark:before:via-white/8',
  );

export const kpiMetricLabelClass = (tone: KpiMetricTone) =>
  cn(
    'truncate text-[10px] font-semibold leading-tight sm:text-[11px]',
    labelByTone[tone],
  );

export const kpiMetricValueClass = (tone: KpiMetricTone) => {
  if (tone === 'destructive') return 'text-destructive';
  if (tone === 'emerald') return 'text-emerald-700 dark:text-emerald-300';
  if (tone === 'neutral') return 'text-muted-foreground';
  return 'text-foreground/90';
};
