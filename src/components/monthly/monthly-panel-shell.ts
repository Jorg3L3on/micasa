import { cn } from '@/lib/utils';

/** Glass shell for Panel financiero chrome, summary, and budget aside. */
export const MONTHLY_PANEL_SHELL_CLASS =
  'orion-panel-glass relative rounded-2xl border border-border/60 dark:border-white/[0.12] dark:backdrop-blur-2xl dark:backdrop-saturate-120';

export const MONTHLY_CHROME_PADDING_CLASS =
  'px-2.5 py-2.5 sm:px-4 sm:py-3';

/** Icon pill accent — solid electric blue, white glyph. */
export const MONTHLY_ICON_PILL_CLASS = cn(
  'flex size-8 shrink-0 items-center justify-center rounded-xl',
  'bg-primary text-white shadow-sm dark:bg-[#3a37fc]',
);

/**
 * Brand-colored labels, dates, and amounts on canvas.
 * Use instead of `text-primary` — fill blue (#3a37fc) is too dark on navy.
 */
export const MONTHLY_ACCENT_TEXT_CLASS = 'text-foreground';
