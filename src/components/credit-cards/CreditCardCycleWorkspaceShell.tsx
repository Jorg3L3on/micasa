'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SheetSnap } from '@/lib/finance/credit-card-cycle-types';

const SNAP_MAX_HEIGHT: Record<SheetSnap, string> = {
  peek: 'max-h-0',
  half: 'max-h-[50vh]',
  full: 'max-h-[calc(100vh-12rem)]',
};

type CreditCardCycleWorkspaceShellProps = {
  chrome: ReactNode;
  children: ReactNode;
};

export const CreditCardCycleWorkspaceShell = ({
  chrome,
  children,
}: CreditCardCycleWorkspaceShellProps) => {
  const [snap, setSnap] = useState<SheetSnap>('peek');

  const handleCycleSnap = useCallback(() => {
    setSnap((current) => {
      if (current === 'peek') return 'half';
      if (current === 'half') return 'full';
      return 'peek';
    });
  }, []);

  return (
    <>
      {/* Mobile snap sheet */}
      <div className="lg:hidden">
        <div
          className={cn(
            'relative z-10 -mt-3',
            'shadow-[0_-10px_40px_-16px_rgba(0,0,0,0.12)] dark:shadow-[0_-10px_40px_-16px_rgba(0,0,0,0.45)]',
          )}
        >
          <div className="flex flex-col overflow-hidden rounded-t-[1.75rem] border border-border/60 bg-card">
            <button
              type="button"
              className="flex w-full shrink-0 flex-col items-center px-4 pt-3 pb-2"
              onClick={handleCycleSnap}
              aria-expanded={snap !== 'peek'}
              aria-label={
                snap === 'full'
                  ? 'Contraer panel del ciclo'
                  : 'Expandir panel del ciclo'
              }
            >
              <span
                className="mb-2 h-1 w-10 rounded-full bg-muted-foreground/25"
                aria-hidden
              />
              <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                <ChevronUp
                  className={cn(
                    'h-3 w-3 transition-transform',
                    snap === 'peek' && 'rotate-180',
                  )}
                  aria-hidden
                />
                {snap === 'peek' ? 'Vista compacta' : snap === 'half' ? 'Medio' : 'Completo'}
              </span>
            </button>

            <div className="sticky top-0 z-10 shrink-0 border-b border-border/50 bg-card px-4 pb-3">
              {chrome}
            </div>

            <div
              className={cn(
                'overflow-y-auto px-4 pb-4 transition-[max-height] duration-300 ease-out',
                SNAP_MAX_HEIGHT[snap],
              )}
            >
              {children}
            </div>
          </div>
        </div>
      </div>

      {/* Desktop inline panel */}
      <div className="relative z-10 -mt-3 hidden lg:block">
        <div className="rounded-t-[1.75rem] border border-border/60 bg-card px-4 pt-4 pb-4 shadow-sm">
          <div className="sticky top-16 z-10 -mx-4 border-b border-border/50 bg-card px-4 pb-3 group-has-data-[collapsible=icon]/sidebar-wrapper:top-12">
            {chrome}
          </div>
          <div className="pt-4">{children}</div>
        </div>
      </div>
    </>
  );
};
