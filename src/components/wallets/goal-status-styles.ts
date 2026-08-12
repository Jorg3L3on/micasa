import type { CSSProperties } from 'react';
import type { GoalStatus } from '@/lib/finance/goal-metrics';

/** Vencida / Archivada accent — cool slate (user-chosen). */
export const GOAL_OVERDUE_OKLCH = 'oklch(37.3% 0.034 259.733)';
/** Hex equivalent for brand CSS vars / rgba helpers. */
export const GOAL_OVERDUE_ACCENT = '#364153';

/** Activas accent — royal blue (option D). */
export const GOAL_ACTIVE_ACCENT = '#2563eb';

/** Visual chrome for goal cards (independent of tab placement). */
export type GoalVisualStyle = 'finished' | 'muted' | 'active';

const overdueOklch = (alpha: number) =>
  `oklch(37.3% 0.034 259.733 / ${alpha})`;

const activeRgba = (alpha: number) => `rgba(37, 99, 235, ${alpha})`;

const OVERDUE_BADGE_CLASS = [
  'border-[oklch(37.3%_0.034_259.733_/_.45)]',
  'bg-[oklch(37.3%_0.034_259.733_/_.20)]',
  'font-medium text-[oklch(37.3%_0.034_259.733)]',
  'dark:border-[oklch(37.3%_0.034_259.733_/_.55)]',
  'dark:bg-[oklch(37.3%_0.034_259.733_/_.35)]',
  'dark:text-[oklch(82%_0.02_259.733)]',
].join(' ');

/**
 * Finished (funded) → Completadas green chrome, even while still in Activas.
 * Vencida + Archivada → shared muted slate chrome.
 */
export function resolveGoalVisualStyle(
  status: GoalStatus,
  funded: boolean,
): GoalVisualStyle {
  if (status === 'overdue' || status === 'archived') return 'muted';
  if (status === 'achieved' || funded) return 'finished';
  return 'active';
}

/** Shared calm fill for every goal card surface. */
export const GOAL_CARD_SURFACE_BG = 'oklch(96.8% 0.007 247.896)';

const GOAL_CARD_SURFACE_CLASS =
  'bg-[oklch(96.8%_0.007_247.896)] shadow-sm dark:bg-card';

/** Royal blue border for Activas (fill comes from shell class). */
export const getGoalActiveCardStyle = (): CSSProperties => ({
  borderColor: activeRgba(0.45),
});

/** Vencida / Archivada border accents (fill comes from shell class). */
export const getGoalOverdueCardStyle = (): CSSProperties => ({
  borderColor: overdueOklch(0.28),
  borderLeftWidth: '3px',
  borderLeftColor: overdueOklch(0.5),
});

export const goalCardShellClass = (visual: GoalVisualStyle): string => {
  switch (visual) {
    case 'finished':
      return cnShell(
        'border-emerald-500/40 dark:border-emerald-500/45',
        GOAL_CARD_SURFACE_CLASS,
      );
    case 'muted':
      return cnShell('border', GOAL_CARD_SURFACE_CLASS);
    default:
      return cnShell(
        'border dark:border-blue-500/45',
        GOAL_CARD_SURFACE_CLASS,
      );
  }
};

function cnShell(...parts: string[]): string {
  return parts.filter(Boolean).join(' ');
}

export const goalStatusBadgeClass = (visual: GoalVisualStyle): string => {
  switch (visual) {
    case 'finished':
      return 'border-transparent bg-emerald-500/15 font-medium text-emerald-800 dark:text-emerald-100';
    case 'muted':
      return OVERDUE_BADGE_CLASS;
    default:
      return '';
  }
};

/** Soft inner panel — Completadas structure, per-status tint. */
export const goalMetricPanelClass = (visual: GoalVisualStyle): string => {
  switch (visual) {
    case 'finished':
      return 'rounded-2xl bg-emerald-500/[0.08] px-4 py-4 dark:bg-emerald-500/15';
    case 'muted':
      return 'rounded-2xl bg-[oklch(37.3%_0.034_259.733_/_.08)] px-4 py-4 dark:bg-[oklch(37.3%_0.034_259.733_/_.16)]';
    default:
      return 'rounded-2xl bg-blue-600/[0.06] px-4 py-4 dark:bg-blue-500/12';
  }
};

export const goalMetricInkClass = (visual: GoalVisualStyle): string => {
  switch (visual) {
    case 'finished':
      return 'text-emerald-800 dark:text-emerald-100';
    case 'muted':
      return 'text-[oklch(37.3%_0.034_259.733)] dark:text-[oklch(82%_0.02_259.733)]';
    default:
      return 'text-blue-600 dark:text-blue-400';
  }
};

export const goalProgressTrackClass = (visual: GoalVisualStyle): string => {
  switch (visual) {
    case 'finished':
      return 'bg-emerald-500/15';
    case 'muted':
      return 'bg-[oklch(37.3%_0.034_259.733_/_.15)]';
    default:
      return 'bg-blue-600/10 dark:bg-blue-500/20';
  }
};

export const goalProgressFillClass = (visual: GoalVisualStyle): string => {
  switch (visual) {
    case 'finished':
      return 'bg-emerald-600 dark:bg-emerald-500';
    case 'muted':
      return 'bg-[oklch(37.3%_0.034_259.733)]';
    default:
      return 'bg-blue-600 dark:bg-blue-500';
  }
};

/** Filled brand circle + white glyph (header / primary action). */
export const goalSolidIconClass = (visual: GoalVisualStyle): string => {
  switch (visual) {
    case 'finished':
      return 'bg-emerald-600 text-white dark:bg-emerald-500';
    case 'muted':
      return 'bg-[oklch(37.3%_0.034_259.733)] text-white';
    default:
      return 'bg-blue-600 text-white dark:bg-blue-500';
  }
};

export const goalActionIconClass = (visual: GoalVisualStyle): string => {
  switch (visual) {
    case 'finished':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
    case 'muted':
      return 'bg-[oklch(37.3%_0.034_259.733_/_.15)] text-[oklch(37.3%_0.034_259.733)] dark:text-[oklch(82%_0.02_259.733)]';
    default:
      return goalSolidIconClass('active');
  }
};

export const goalTipStripClass = (visual: GoalVisualStyle): string => {
  switch (visual) {
    case 'finished':
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100';
    case 'muted':
      return [
        'border border-[oklch(37.3%_0.034_259.733_/_.25)] bg-[oklch(37.3%_0.034_259.733_/_.10)]',
        'border-l-[3px] border-l-[oklch(37.3%_0.034_259.733)]',
        'text-foreground',
        'dark:border-[oklch(37.3%_0.034_259.733_/_.35)] dark:bg-[oklch(37.3%_0.034_259.733_/_.18)]',
      ].join(' ');
    default:
      return 'border border-blue-600/20 bg-blue-600/10 text-blue-950 dark:text-blue-100';
  }
};
