'use client';

import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type PantryLayoutShellProps = {
  children: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<'div'>, 'className' | 'children'>;

/** Layout wrapper for Despensa routes (spacing / flex). Canvas matches the rest of the dashboard (`bg-background`). */
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
