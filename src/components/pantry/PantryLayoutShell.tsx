'use client';

import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type PantryLayoutShellProps = {
  children: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<'div'>, 'className' | 'children'>;

/**
 * Spacing/flex wrapper for Despensa routes. The dashboard layout already provides
 * the container, padding and `bg-background`; consumers pass their own layout
 * classes via `className` (e.g. `space-y-5 pb-24` for the canonical dashboard rhythm).
 */
export const PantryLayoutShell = ({
  children,
  className,
  ...rest
}: PantryLayoutShellProps) => {
  return (
    <div className={cn(className)} {...rest}>
      {children}
    </div>
  );
};
