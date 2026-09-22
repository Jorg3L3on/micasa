'use client';

import { AlertTriangle } from 'lucide-react';
import { PLAN_COPY } from '@/components/wallets/liquidity/plan/copy';
import type { DataGap } from '@/lib/finance/cash-plan/types';

type DataGapCalloutProps = {
  gaps: DataGap[];
  lowConfidence: boolean;
};

export const DataGapCallout = ({ gaps, lowConfidence }: DataGapCalloutProps) => {
  if (gaps.length === 0) return null;
  const unique = gaps.filter(
    (gap, index) => gaps.findIndex((item) => item.code === gap.code && item.obligationId === gap.obligationId) === index,
  );

  return (
    <div
      className="rounded-xl border border-border/60 border-l-[3px] border-l-amber-500/50 bg-card px-4 py-3"
      role="status"
    >
      {lowConfidence ? (
        <p className="flex items-start gap-2 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <span>{PLAN_COPY.lowConfidence}</span>
        </p>
      ) : null}
      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
        {unique.slice(0, 4).map((gap) => (
          <li key={`${gap.code}-${gap.obligationId ?? gap.message}`}>{gap.message}</li>
        ))}
      </ul>
    </div>
  );
};
