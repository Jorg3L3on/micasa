'use client';

import { SegmentedControl } from '@/components/segmented-control';
import { PLAN_COPY } from '@/components/wallets/liquidity/plan/copy';
import type { PlanHorizon } from '@/lib/finance/cash-plan/types';

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
    options={OPTIONS}
  />
);
