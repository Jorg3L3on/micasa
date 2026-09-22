'use client';

import { cn } from '@/lib/utils';
import { PLAN_COPY } from '@/components/wallets/liquidity/plan/copy';
import type { PlanHorizon } from '@/lib/finance/cash-plan/types';

type HorizonToggleProps = {
  value: PlanHorizon;
  onChange: (value: PlanHorizon) => void;
};

const OPTIONS: Array<{ id: PlanHorizon; label: string }> = [
  { id: 'quincena', label: PLAN_COPY.fortnight },
  { id: 'mes', label: PLAN_COPY.month },
];

export const HorizonToggle = ({ value, onChange }: HorizonToggleProps) => (
  <div
    role="radiogroup"
    aria-label={PLAN_COPY.horizonLabel}
    className="inline-flex rounded-full border border-border/60 bg-muted/40 p-0.5"
  >
    {OPTIONS.map((option) => {
      const selected = value === option.id;
      return (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={selected}
          className={cn(
            'min-h-11 rounded-full px-4 text-sm font-medium transition-colors',
            selected
              ? 'bg-background text-foreground shadow-sm dark:bg-input/40'
              : 'text-muted-foreground hover:text-foreground',
          )}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);
