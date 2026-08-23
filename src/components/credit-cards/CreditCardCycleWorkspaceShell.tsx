'use client';

import { type ReactNode } from 'react';
import { MONTHLY_PANEL_SHELL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { cn } from '@/lib/utils';

type CreditCardCycleWorkspaceShellProps = {
  chrome: ReactNode;
  children: ReactNode;
};

/** Cycle summary + tabs — calm card like wallet detail (no mobile snap drawer). */
export const CreditCardCycleWorkspaceShell = ({
  chrome,
  children,
}: CreditCardCycleWorkspaceShellProps) => (
  <div className="relative z-10 -mt-3">
    <div
      className={cn(
        MONTHLY_PANEL_SHELL_CLASS,
        'px-3 py-3 sm:px-4 sm:py-4',
        'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px',
        'before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent dark:before:via-white/5',
      )}
    >
      <div className="relative space-y-4">
        <div className="sticky top-16 z-10 -mx-3 border-b border-border/50 bg-card px-3 pb-3 sm:-mx-4 sm:px-4 group-has-data-[collapsible=icon]/sidebar-wrapper:top-12">
          {chrome}
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  </div>
);
