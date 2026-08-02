'use client';

import type { CSSProperties, MouseEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Trailing inset + action column — keep in sync with dragConstraints. */
export const SWIPE_DELETE_ACTION_WIDTH = 88;

type SwipeDeleteActionProps = {
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  /** Visible label under the icon (Spanish). */
  label?: string;
  ariaLabel: string;
  className?: string;
};

/**
 * iOS-style trailing delete control revealed by swipe-left.
 * Full-height rounded destructive tile: icon + "Eliminar".
 */
export function SwipeDeleteAction({
  onClick,
  label = 'Eliminar',
  ariaLabel,
  className,
}: SwipeDeleteActionProps) {
  return (
    <div
      className={cn(
        'flex h-full w-[var(--swipe-delete-width,5.5rem)] shrink-0 items-stretch justify-end p-1 pl-0',
        className,
      )}
      style={
        {
          '--swipe-delete-width': `${SWIPE_DELETE_ACTION_WIDTH}px`,
        } as CSSProperties
      }
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90 flex w-full flex-col items-center justify-center gap-1 rounded-2xl px-1.5 py-2 shadow-sm transition focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <Trash2
          className="size-5 shrink-0"
          strokeWidth={2}
          aria-hidden
          data-icon="inline-start"
        />
        <span className="text-xs leading-tight font-medium tracking-tight">
          {label}
        </span>
      </button>
    </div>
  );
}
