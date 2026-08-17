import { cn } from '@/lib/utils';

/** Glass shell for Panel financiero chrome, summary, and budget aside. */
export const MONTHLY_PANEL_SHELL_CLASS =
  'relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm dark:border-white/[0.08] dark:bg-[#0d1327]/80 dark:shadow-[0_24px_80px_-48px_rgba(58,55,252,0.45)] dark:backdrop-blur-xl';

export const MONTHLY_CHROME_PADDING_CLASS =
  'px-2.5 py-2.5 sm:px-4 sm:py-3';

/** Icon pill accent — electric blue via primary token. */
export const MONTHLY_ICON_PILL_CLASS = cn(
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
  'bg-primary/15 ring-1 ring-primary/25 dark:bg-primary/20 dark:ring-[#911efe]/35',
);
