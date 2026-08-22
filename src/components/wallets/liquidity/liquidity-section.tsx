'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MONTHLY_ICON_PILL_CLASS } from '@/components/monthly/monthly-panel-shell';

type LiquiditySectionAccent = 'primary' | 'violet' | 'amber' | 'emerald';

const ACCENT_PILL: Record<LiquiditySectionAccent, string> = {
  primary: MONTHLY_ICON_PILL_CLASS,
  violet:
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/25',
  amber:
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/25',
  emerald:
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25',
};

type LiquiditySectionHeaderProps = {
  id?: string;
  title: string;
  description?: React.ReactNode;
  icon: LucideIcon;
  accent?: LiquiditySectionAccent;
  actions?: React.ReactNode;
  className?: string;
};

export const LiquiditySectionHeader = ({
  id,
  title,
  description,
  icon: Icon,
  accent = 'primary',
  actions,
  className,
}: LiquiditySectionHeaderProps) => {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 items-start gap-3">
        <span className={ACCENT_PILL[accent]} aria-hidden>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 id={id} className="text-base font-semibold leading-tight tracking-tight">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 max-w-prose text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
};

export const LiquiditySectionGroup = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <section className={cn('space-y-4', className)}>{children}</section>
);

export const LiquidityPanelConnector = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      'overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-b from-muted/20 to-transparent shadow-sm',
      'dark:border-white/[0.07] dark:from-white/[0.03] dark:to-transparent dark:shadow-[0_24px_80px_-56px_rgba(58,55,252,0.35)]',
      className,
    )}
  >
    {children}
  </div>
);
