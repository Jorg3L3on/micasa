'use client';

import { type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type OnboardingChipProps = Omit<ComponentPropsWithoutRef<'button'>, 'type'> & {
  selected?: boolean;
  children: ReactNode;
};

/** Toggle chip for one choice in a chip group (44px tall, pill). */
export function OnboardingChip({
  selected = false,
  className,
  children,
  ...props
}: OnboardingChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium text-foreground transition-colors',
        'focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
        selected
          ? 'border-primary/70 bg-primary/25 font-semibold'
          : 'border-border/60 bg-white/[0.04] hover:bg-white/[0.08] dark:border-white/10',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** Caption over a chip group or field, matching the canvas `.cap` text. */
export const OnboardingFieldCaption = ({
  id,
  htmlFor,
  children,
}: {
  id?: string;
  htmlFor?: string;
  children: ReactNode;
}) =>
  htmlFor ? (
    <label id={id} htmlFor={htmlFor} className="block text-xs text-muted-foreground">
      {children}
    </label>
  ) : (
    <p id={id} className="text-xs text-muted-foreground">
      {children}
    </p>
  );
