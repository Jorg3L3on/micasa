'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  MONTHLY_ICON_PILL_CLASS,
  MONTHLY_LIQUID_PANEL_CLASS,
} from '@/components/monthly/monthly-panel-shell';

/** Liquidez hero panels: same liquid glass as Panel financiero's resumen and presupuesto. */
export const LIQUIDITY_PANEL_CLASS = cn(MONTHLY_LIQUID_PANEL_CLASS, 'p-3 sm:p-4');

type LiquidityPanelHeaderProps = {
  id?: string;
  title: string;
  subtitle?: React.ReactNode;
  icon: LucideIcon;
  actions?: React.ReactNode;
  className?: string;
};

export const LiquidityPanelHeader = ({
  id,
  title,
  subtitle,
  icon: Icon,
  actions,
  className,
}: LiquidityPanelHeaderProps) => (
  <div className={cn('flex min-w-0 items-start justify-between gap-3', className)}>
    <div className="flex min-w-0 items-start gap-2.5">
      <span className={MONTHLY_ICON_PILL_CLASS} aria-hidden>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 pt-0.5">
        <h2 id={id} className="text-sm font-semibold leading-none text-foreground">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1.5 text-caption leading-snug text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
    </div>
    {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
  </div>
);
