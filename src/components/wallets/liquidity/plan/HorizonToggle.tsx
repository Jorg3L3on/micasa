'use client';

import { MONTHLY_LIQUID_PANEL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { SegmentedControl } from '@/components/segmented-control';
import { PLAN_COPY } from '@/components/wallets/liquidity/plan/copy';
import type { PlanHorizon } from '@/lib/finance/cash-plan/types';
import { cn } from '@/lib/utils';

type HorizonToggleProps = {
  value: PlanHorizon;
  onChange: (value: PlanHorizon) => void;
};

const OPTIONS: Array<{ value: PlanHorizon; label: string }> = [
  { value: 'quincena', label: PLAN_COPY.fortnight },
  { value: 'mes', label: PLAN_COPY.month },
];

export const HorizonToggle = ({ value, onChange }: HorizonToggleProps) => (
  <SegmentedControl
    value={value}
    onValueChange={(next) => onChange(next as PlanHorizon)}
    ariaLabel={PLAN_COPY.horizonLabel}
    frameClassName={cn(MONTHLY_LIQUID_PANEL_CLASS, 'inline-flex w-fit max-w-full p-1 sm:p-1.5')}
    options={OPTIONS}
  />
);
