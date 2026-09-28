'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MONTHLY_LIQUID_PANEL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { SectionHeader } from '@/components/section-header';

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
  <SectionHeader
    id={id}
    title={title}
    subtitle={subtitle}
    icon={Icon}
    actions={actions}
    className={className}
  />
);
