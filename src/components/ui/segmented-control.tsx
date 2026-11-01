'use client';

import { useId, type KeyboardEvent, type ReactNode } from 'react';
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { SPRING_LAYOUT } from '@/components/motion/ease';
import { cn } from '@/lib/utils';

export type SegmentedControlOption = {
  value: string;
  label: string;
  /** Rendered after the label, e.g. a count badge. */
  accessory?: ReactNode;
};

type SegmentedControlProps = {
  options: SegmentedControlOption[];
  value: string;
  onValueChange: (value: string) => void;
  /** aria-label for the group. */
  label?: string;
  className?: string;
};

/**
 * A row of toggle buttons with one selection pill that slides between them
 * (API after Arc's segmented control). Only the selected segment is a tab
 * stop; arrows select and focus the previous or next segment and wrap,
 * Home and End jump to the ends. Overflowing rows scroll sideways.
 */
const SegmentedControl = ({
  options,
  value,
  onValueChange,
  label,
  className,
}: SegmentedControlProps) => {
  const groupId = useId();
  const reducedMotion = useReducedMotion() ?? false;

  const select = (index: number, event: KeyboardEvent<HTMLDivElement>) => {
    const next = options[(index + options.length) % options.length];
    if (!next) return;
    event.preventDefault();
    onValueChange(next.value);
    requestAnimationFrame(() => {
      event.currentTarget
        .querySelector<HTMLButtonElement>(`[data-segment="${CSS.escape(next.value)}"]`)
        ?.focus();
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = options.findIndex((option) => option.value === value);
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      select(current + 1, event);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      select(current - 1, event);
    } else if (event.key === 'Home') {
      select(0, event);
    } else if (event.key === 'End') {
      select(options.length - 1, event);
    }
  };

  return (
    <LayoutGroup id={groupId}>
      <div
        role="group"
        aria-label={label}
        onKeyDown={handleKeyDown}
        className={cn(
          'inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-muted p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          className,
        )}
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              data-segment={option.value}
              aria-pressed={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onValueChange(option.value)}
              className={cn(
                'relative flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
                selected
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {selected ? (
                <motion.span
                  aria-hidden
                  layoutId="segmented-control-pill"
                  className="absolute inset-0 rounded-full bg-background shadow-sm ring-1 ring-border/60"
                  transition={reducedMotion ? { duration: 0 } : SPRING_LAYOUT}
                />
              ) : null}
              <span className="relative">{option.label}</span>
              {option.accessory ? (
                <span className="relative">{option.accessory}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
};

export default SegmentedControl;
