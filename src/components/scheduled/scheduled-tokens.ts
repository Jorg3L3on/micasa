import type { ScheduledPeriod } from '@/lib/ui/scheduled-items';

/**
 * Quincena colours for Gastos / Ingresos programados: 1ª = primary,
 * 2ª = chart-4. The summary dots, the split bar and the row chips share them.
 */
export const QUINCENA_DOT_CLASS: Record<ScheduledPeriod, string> = {
  FIRST: 'bg-primary',
  SECOND: 'bg-chart-4',
};

export const QUINCENA_BAR_CLASS = QUINCENA_DOT_CLASS;

export const QUINCENA_CHIP_CLASS: Record<ScheduledPeriod, string> = {
  FIRST: 'border-primary/40 bg-primary/15 text-foreground',
  SECOND: 'border-chart-4/40 bg-chart-4/15 text-foreground',
};
