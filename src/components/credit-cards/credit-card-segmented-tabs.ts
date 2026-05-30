import { cn } from '@/lib/utils';

/** Matches Panel financiero (FortnightColumn) segmented tab chrome. */
export const creditCardSegmentedTabChromeClass =
  'rounded-2xl border border-border/40 bg-gradient-to-br from-muted/30 via-background to-muted/10 p-1 shadow-inner backdrop-blur-sm dark:from-muted/20 dark:via-card dark:to-muted/5 sm:p-1.5';

export const creditCardSegmentedTabListClass = cn(
  '!grid h-auto w-full grid-cols-3 gap-1 rounded-none bg-transparent p-0',
  '[&_[data-slot=tabs-trigger]]:rounded-full',
  '[&_[data-slot=tabs-trigger]]:transition-all',
  '[&_[data-slot=tabs-trigger][data-state=active]]:border-transparent',
  '[&_[data-slot=tabs-trigger][data-state=active]]:bg-gradient-to-br',
  '[&_[data-slot=tabs-trigger][data-state=active]]:from-primary/90',
  '[&_[data-slot=tabs-trigger][data-state=active]]:to-primary/75',
  '[&_[data-slot=tabs-trigger][data-state=active]]:text-primary-foreground',
  '[&_[data-slot=tabs-trigger][data-state=active]]:shadow-sm',
  '[&_[data-slot=tabs-trigger][data-state=active]]:ring-1',
  '[&_[data-slot=tabs-trigger][data-state=active]]:ring-primary/30',
  '[&_[data-slot=tabs-trigger][data-state=inactive]]:text-foreground/70',
  '[&_[data-slot=tabs-trigger][data-state=inactive]]:hover:text-foreground/90',
  '[&_[data-slot=tabs-trigger]]:after:hidden',
);

export const creditCardSegmentedFilterButtonClass = (active: boolean) =>
  cn(
    'h-9 rounded-full text-xs font-semibold transition-all sm:text-sm',
    active
      ? 'bg-gradient-to-br from-primary/90 to-primary/75 text-primary-foreground shadow-sm ring-1 ring-primary/30'
      : 'text-foreground/70 hover:text-foreground/90',
  );

export const creditCardDetailTabTriggerClass = cn(
  'group inline-flex h-9 w-full min-w-0 flex-none items-center justify-center gap-1 px-2',
  'text-xs font-semibold shadow-none sm:text-sm',
);
