/** Wallet and card detail tab bar: liquid glass with a primary pill, tabs share the width. */
export const DETAIL_TAB_BAR_PROPS = {
  embedded: true,
  stretch: true,
  frameClassName: 'liquid-tabbar flex w-full min-w-0 items-center p-1',
  wrapperClassName: 'min-w-0 flex-1',
  listClassName: 'flex w-full gap-1 rounded-none bg-transparent p-0',
  triggerClassName:
    'px-1 text-xs text-foreground/70 hover:text-foreground max-[359px]:px-0.5 max-[359px]:text-caption sm:px-3.5 sm:text-sm',
  indicatorClassName: 'liquid-tabbar-pill',
  activeLabelClassName: 'font-semibold text-primary-foreground',
} as const;
