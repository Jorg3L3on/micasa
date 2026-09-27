import { cn } from '@/lib/utils';

/** Glass shell for Panel financiero chrome, summary, and budget aside. */
export const MONTHLY_PANEL_SHELL_CLASS =
  'orion-panel-glass relative rounded-2xl border border-border/60 dark:border-white/[0.12] dark:backdrop-blur-2xl dark:backdrop-saturate-120';

export const MONTHLY_CHROME_PADDING_CLASS =
  'px-2.5 py-2.5 sm:px-4 sm:py-3';

/** Hero panels (chrome, resumen, presupuesto): planner glass plus a soft rim. */
export const MONTHLY_LIQUID_PANEL_CLASS = cn(MONTHLY_PANEL_SHELL_CLASS, 'liquid-glass');

/** Active tab indicator: glass pill (same recipe as the mobile dock). */
export const GLASS_TAB_INDICATOR_CLASS = 'liquid-glass liquid-glass-pill';

/** Panel financiero tab indicator: glass pill plus the electric-blue aura halo. */
export const AURA_TAB_INDICATOR_CLASS = cn(
  GLASS_TAB_INDICATOR_CLASS,
  'liquid-glass-pill-aura',
);

export const GLASS_TAB_ACTIVE_LABEL_CLASS = 'text-foreground';

/** Tab track under the glass pill: faint tint so the pill reads as the lit surface. */
export const GLASS_TAB_TRACK_CLASS = 'bg-black/[0.03] dark:bg-white/[0.03]';

/** Icon pill accent — glass pill (same recipe as the active tab), foreground glyph. */
export const MONTHLY_ICON_PILL_CLASS = cn(
  'relative flex size-8 shrink-0 items-center justify-center rounded-xl text-foreground',
  GLASS_TAB_INDICATOR_CLASS,
  '[&>svg]:relative [&>svg]:z-10',
);

/**
 * Brand-colored labels, dates, and amounts on canvas.
 * Use instead of `text-primary` — fill blue (#3a37fc) is too dark on navy.
 */
export const MONTHLY_ACCENT_TEXT_CLASS = 'text-foreground';
