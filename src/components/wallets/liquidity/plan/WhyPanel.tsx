'use client';

import { PLAN_COPY } from '@/components/wallets/liquidity/plan/copy';
import type { ExplainTrace } from '@/lib/finance/cash-plan/types';

type WhyPanelProps = {
  explainability: ExplainTrace;
};

/** "Por qué esta ruta", always open: the score summary, assumptions and what the route leaves alone. */
export const WhyPanel = ({ explainability }: WhyPanelProps) => (
  <div className="space-y-3 text-sm" data-testid="why-panel">
    <p className="leading-relaxed">{explainability.scoreSummary}</p>
    {explainability.assumptions.length > 0 ? (
      <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
        {explainability.assumptions.map((assumption) => (
          <li key={assumption}>{assumption}</li>
        ))}
      </ul>
    ) : null}
    {explainability.untouchableLabels.length > 0 ? (
      <p className="text-muted-foreground">
        {PLAN_COPY.untouchedLead} {explainability.untouchableLabels.join(', ')}.
      </p>
    ) : null}
  </div>
);
