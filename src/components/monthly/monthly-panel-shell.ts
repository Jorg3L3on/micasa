import { cn } from '@/lib/utils';

/** Calm elevated shell for Panel financiero chrome and budget aside. */
export const MONTHLY_PANEL_SHELL_CLASS =
  'relative overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm';

export const MONTHLY_CHROME_PADDING_CLASS =
  'px-2.5 py-2.5 sm:px-4 sm:py-3';

/** Icon pill accent — Quincena Blue via primary token. */
export const MONTHLY_ICON_PILL_CLASS = cn(
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
  'bg-primary/15 ring-1 ring-primary/25 dark:bg-primary/20',
);
