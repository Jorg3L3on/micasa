'use client';

import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { PLAN_COPY } from '@/components/wallets/liquidity/plan/copy';
import type { ExplainTrace } from '@/lib/finance/cash-plan/types';

type WhyPanelProps = {
  explainability: ExplainTrace;
};

export const WhyPanel = ({ explainability }: WhyPanelProps) => {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-4 text-left text-sm font-medium"
        aria-expanded={open}
        aria-controls={panelId}
      >
        {PLAN_COPY.why}
        <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent id={panelId} className="mt-2 rounded-xl border border-border/60 bg-card px-4 py-3 text-sm">
        <p>{explainability.scoreSummary}</p>
        <ul className="mt-3 space-y-2 text-muted-foreground">
          {explainability.assumptions.map((assumption) => (
            <li key={assumption}>{assumption}</li>
          ))}
        </ul>
        {explainability.untouchableLabels.length > 0 ? (
          <p className="mt-3 text-muted-foreground">
            Sin recorte en la ruta principal: {explainability.untouchableLabels.join(', ')}.
          </p>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
};
