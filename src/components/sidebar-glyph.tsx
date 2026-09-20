import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

type SidebarGlyphProps = {
  icon: LucideIcon;
  active?: boolean;
  size?: 'sm' | 'md';
  className?: string;
};

/** Frosted / electric-blue icon chip used by sidebar nav and the context switcher. */
export const SidebarGlyph = ({
  icon: Icon,
  active = false,
  size = 'md',
  className,
}: SidebarGlyphProps) => (
  <span
    className={cn(
      'flex shrink-0 items-center justify-center rounded-lg transition-colors',
      size === 'sm' ? 'size-6' : 'size-7 group-data-[collapsible=icon]:size-6',
      active
        ? 'bg-primary text-white'
        : 'bg-black/[0.06] text-foreground ring-1 ring-inset ring-black/10 group-hover/menu-item:bg-black/[0.09] dark:bg-white/[0.08] dark:text-white/90 dark:ring-white/15 dark:group-hover/menu-item:bg-white/[0.14] dark:group-hover/menu-item:text-white',
      className,
    )}
  >
    <Icon
      className={cn(
        'stroke-[1.75]',
        size === 'sm' ? 'size-3.5' : 'size-4',
      )}
      aria-hidden
    />
  </span>
);
