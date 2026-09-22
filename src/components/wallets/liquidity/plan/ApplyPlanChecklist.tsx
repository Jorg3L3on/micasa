'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { PLAN_COPY } from '@/components/wallets/liquidity/plan/copy';
import type { ActionInstance } from '@/lib/finance/cash-plan/types';

type ApplyPlanChecklistProps = {
  planId: string;
  actions: ActionInstance[];
  checked: Record<string, boolean>;
  onToggle: (key: string, next: boolean) => void;
};

export const ApplyPlanChecklist = ({
  planId,
  actions,
  checked,
  onToggle,
}: ApplyPlanChecklistProps) => {
  if (actions.length === 0) return null;

  return (
    <div className="mt-4 space-y-3 border-t border-border/50 pt-4">
      <div>
        <p className="text-sm font-medium">{PLAN_COPY.checklistTitle}</p>
        <p className="text-sm text-muted-foreground">{PLAN_COPY.checklistHint}</p>
      </div>
      <ul className="space-y-2">
        {actions.map((item, index) => {
          const key = `${planId}:${index}`;
          const checkboxId = `plan-step-${planId}-${index}`;
          return (
            <li key={key} className="flex items-start gap-3">
              <Checkbox
                id={checkboxId}
                checked={checked[key] === true}
                onCheckedChange={(value) => onToggle(key, value === true)}
                aria-label={item.label}
                className="mt-1"
              />
              <label htmlFor={checkboxId} className="text-sm leading-snug">
                {item.label}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
