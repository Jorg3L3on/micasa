/**
 * Liquid-glass chrome for Apple-style toolbar controls.
 * Specular inset + frosted fill + hairline — matches Toggle OFF glass
 * and Orion hairlines in DESIGN.md.
 */

/**
 * Clustered icon group shell (Agregar + Filtros).
 * Matches Apple liquid-glass capsule: full pill radius, hairline border,
 * frosted translucent fill (icons stay product-specific).
 */
export const TOOLBAR_GLASS_GROUP =
  [
    'flex h-10 shrink-0 items-center overflow-hidden rounded-full px-0.5',
    'border border-black/[0.08] bg-white/80',
    'shadow-[0_1px_2px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.9)]',
    'backdrop-blur-xl backdrop-saturate-150',
    'dark:border-white/20 dark:bg-white/[0.10]',
    'dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_1px_2px_rgba(0,0,0,0.35)]',
  ].join(' ');

/** Icon slot inside TOOLBAR_GLASS_GROUP — no second glass disc. */
export const TOOLBAR_GLASS_GROUP_ITEM =
  [
    'relative size-9 shrink-0 rounded-full border-0 bg-transparent shadow-none',
    'text-foreground/90 hover:bg-black/[0.06] hover:text-foreground',
    'active:bg-black/[0.1] active:opacity-90',
    'dark:hover:bg-white/[0.12] dark:active:bg-white/[0.16]',
    "[&_svg:not([class*='size-'])]:size-[1.15rem]",
    'transition-[background-color,opacity,color] duration-200 ease-out',
    'motion-reduce:transition-none',
  ].join(' ');

export const TOOLBAR_GLASS_GROUP_DIVIDER =
  'mx-0.5 h-4 w-px shrink-0 bg-black/10 dark:bg-white/25';

export const TOOLBAR_GLASS_ICON =
  [
    'relative size-10 shrink-0 rounded-full',
    'border border-black/[0.08] bg-white/80 text-foreground/90',
    'shadow-[0_1px_2px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.9)]',
    'backdrop-blur-xl backdrop-saturate-150',
    'transition-[background-color,box-shadow,border-color,transform,opacity,color] duration-200 ease-out',
    'hover:bg-white hover:text-foreground',
    'active:scale-[0.96] active:opacity-90',
    'dark:border-white/20 dark:bg-white/[0.10] dark:text-foreground/95',
    'dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_1px_2px_rgba(0,0,0,0.35)]',
    'dark:hover:bg-white/[0.16] dark:hover:border-white/28',
    "[&_svg:not([class*='size-'])]:size-5",
    'motion-reduce:transition-none motion-reduce:active:scale-100',
  ].join(' ');

/** Filled primary (Add) with liquid-glass specular rim on the orange CTA. */
export const TOOLBAR_GLASS_PRIMARY_ICON =
  [
    'size-11 shrink-0 rounded-full',
    'border border-white/30',
    'shadow-[inset_0_1px_1px_rgba(255,255,255,0.5),0_8px_22px_-10px_rgba(255,87,51,0.65)]',
    'backdrop-blur-md backdrop-saturate-150',
    'transition-[filter,transform,opacity,box-shadow] duration-200 ease-out',
    'hover:brightness-110',
    'active:scale-[0.96] active:opacity-95',
    "[&_svg:not([class*='size-'])]:size-5",
    'motion-reduce:transition-none motion-reduce:active:scale-100',
  ].join(' ');

export const TOOLBAR_GLASS_PRIMARY_PILL =
  [
    'h-11 shrink-0 rounded-full px-4 text-[15px] font-semibold tracking-tight',
    'border border-white/30',
    'shadow-[inset_0_1px_1px_rgba(255,255,255,0.5),0_8px_22px_-10px_rgba(255,87,51,0.65)]',
    'backdrop-blur-md backdrop-saturate-150',
    'transition-[filter,transform,opacity,box-shadow] duration-200 ease-out',
    'hover:brightness-110',
    'active:scale-[0.98] active:opacity-95',
    'motion-reduce:transition-none motion-reduce:active:scale-100',
  ].join(' ');

/** Cancel / tinted text control — frosted tint, not solid fill. */
export const TOOLBAR_GLASS_CANCEL =
  [
    'h-10 shrink-0 rounded-full px-3.5 text-[15px] font-medium text-primary',
    'border border-primary/20 bg-primary/10',
    'shadow-[inset_0_1px_1px_rgba(255,255,255,0.55)]',
    'backdrop-blur-xl backdrop-saturate-150',
    'transition-[background-color,border-color,transform,opacity] duration-200 ease-out',
    'hover:bg-primary/15 hover:border-primary/30',
    'active:scale-[0.98] active:opacity-90',
    'dark:border-primary/35 dark:bg-primary/20',
    'dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]',
    'dark:hover:bg-primary/28',
    'motion-reduce:transition-none motion-reduce:active:scale-100',
  ].join(' ');

/** Search field — frosted capsule (idle pill or takeover field). */
export const TOOLBAR_GLASS_FIELD =
  [
    'h-10 w-full rounded-full border border-black/[0.08] bg-white/80',
    'pr-11 pl-11 text-[15px] shadow-[0_1px_2px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.9)]',
    'backdrop-blur-xl backdrop-saturate-150',
    'placeholder:text-muted-foreground/80',
    'focus-visible:border-primary/35 focus-visible:ring-2 focus-visible:ring-primary/20',
    'dark:border-white/20 dark:bg-white/[0.10]',
    'dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_1px_2px_rgba(0,0,0,0.35)]',
  ].join(' ');

/**
 * Idle search affordance (icon + “Buscar” label) — desktop only.
 * Mobile uses a circular glass icon button instead.
 */
export const TOOLBAR_GLASS_SEARCH_PILL =
  [
    'inline-flex h-10 w-[350px] max-w-[350px] shrink-0 items-center gap-2 rounded-full px-3.5',
    'border border-black/[0.08] bg-white/80 text-muted-foreground',
    'shadow-[0_1px_2px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.9)]',
    'backdrop-blur-xl backdrop-saturate-150',
    'transition-[background-color,border-color,box-shadow,transform,opacity,width] duration-300 ease-out',
    'hover:bg-white hover:text-foreground',
    'active:scale-[0.98]',
    'dark:border-white/20 dark:bg-white/[0.10]',
    'dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_1px_2px_rgba(0,0,0,0.35)]',
    'dark:hover:bg-white/[0.16]',
    'motion-reduce:transition-none motion-reduce:active:scale-100',
  ].join(' ');
