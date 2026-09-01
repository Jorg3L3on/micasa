import { cn } from '@/lib/utils';

/** Glass shell for Panel financiero chrome, summary, and budget aside. */
export const MONTHLY_PANEL_SHELL_CLASS =
  'orion-panel-glass relative overflow-hidden rounded-2xl border border-border/60 shadow-sm dark:backdrop-blur-xl';

export const MONTHLY_CHROME_PADDING_CLASS =
  'px-2.5 py-2.5 sm:px-4 sm:py-3';

/** Icon pill accent — electric blue via primary token. */
export const MONTHLY_ICON_PILL_CLASS = cn(
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
  'bg-primary/15 ring-1 ring-primary/25 dark:bg-primary/20 dark:ring-[#911efe]/35',
);

/**
 * Brand-colored labels, dates, and amounts on canvas.
 * Use instead of `text-primary` — fill blue (#3a37fc) is too dark on navy.
 */
export const MONTHLY_ACCENT_TEXT_CLASS = 'text-primary-text';
