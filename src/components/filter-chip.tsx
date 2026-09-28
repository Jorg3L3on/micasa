import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type FilterChipProps = {
  selected: boolean;
  children: ReactNode;
  count?: number;
  onClick?: () => void;
  href?: string;
  className?: string;
  ariaLabel?: string;
};

const chipClass = (selected: boolean, className?: string) =>
  cn(
    'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors sm:min-h-9',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    selected
      ? 'border-primary bg-primary text-primary-foreground'
      : 'border-border/60 bg-card text-muted-foreground hover:text-foreground',
    className,
  );

const ChipBody = ({ children, count }: { children: ReactNode; count?: number }) => (
  <>
    {children}
    {count != null ? (
      <span className="tabular-nums opacity-80">({count})</span>
    ) : null}
  </>
);

/** Filter or settings chip. Active state, optional count, visible focus. */
export const FilterChip = ({
  selected,
  children,
  count,
  onClick,
  href,
  className,
  ariaLabel,
}: FilterChipProps) => {
  if (href) {
    return (
      <Link
        href={href}
        aria-current={selected ? 'page' : undefined}
        aria-label={ariaLabel}
        className={chipClass(selected, className)}
      >
        <ChipBody count={count}>{children}</ChipBody>
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={ariaLabel}
      onClick={onClick}
      className={chipClass(selected, className)}
    >
      <ChipBody count={count}>{children}</ChipBody>
    </button>
  );
};
