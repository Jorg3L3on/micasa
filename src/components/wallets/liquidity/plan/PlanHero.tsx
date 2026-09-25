'use client';

import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn, formatCurrency } from '@/lib/utils';
import { METRIC_STRIP_CLASS } from '@/components/ui/metric-strip';
import { PLAN_COPY } from '@/components/wallets/liquidity/plan/copy';
import { groupGapBreakdownLines } from '@/components/wallets/liquidity/plan/group-gap-lines';
import type { GapBreakdownLine, PlanHorizon, PlanMode } from '@/lib/finance/cash-plan/types';

type PlanHeroProps = {
  mode: PlanMode;
  gapAmount: number;
  horizon: PlanHorizon;
  lines: GapBreakdownLine[];
  note?: string;
};

const titleFor = (mode: PlanMode): string => {
  if (mode === 'shortfall') return PLAN_COPY.shortfallTitle;
  if (mode === 'surplus') return PLAN_COPY.surplusTitle;
  return PLAN_COPY.balancedTitle;
};

const loanCountLabel = (count: number): string =>
  count === 1 ? '1 préstamo' : `${count} préstamos`;

const Amount = ({ amount }: { amount: number }) => (
  <span className={cn('shrink-0 font-mono tabular-nums', amount < 0 && 'text-emerald-600 dark:text-emerald-400')}>
    {formatCurrency(amount)}
  </span>
);

const BreakdownLine = ({ line }: { line: GapBreakdownLine }) => (
  <li className="flex items-start justify-between gap-3 text-sm">
    <span>
      <span className="font-medium">{line.label}</span>
      {line.detail ? (
        <span className="mt-0.5 block text-xs text-muted-foreground">{line.detail}</span>
      ) : null}
    </span>
    <Amount amount={line.amount} />
  </li>
);

const LenderGroup = ({
  label,
  total,
  lines,
}: {
  label: string;
  total: number;
  lines: GapBreakdownLine[];
}) => {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const countLabel = loanCountLabel(lines.length);

  return (
    <li>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger
          className="flex w-full items-start justify-between gap-3 text-left text-sm"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={`${open ? 'Ocultar' : 'Mostrar'} préstamos de ${label}`}
        >
          <span>
            <span className="font-medium">{label}</span>
            <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <ChevronDown className={cn('size-3 shrink-0 transition-transform', open && 'rotate-180')} aria-hidden />
              {countLabel}
            </span>
          </span>
          <Amount amount={total} />
        </CollapsibleTrigger>
        <CollapsibleContent id={panelId}>
          <ul className="mt-2 space-y-2 border-l border-border/60 pl-3">
            {lines.map((line) => (
              <li key={line.id} className="flex items-start justify-between gap-3 text-sm">
                <span className="font-medium">{line.label}</span>
                <Amount amount={line.amount} />
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
};

export const PlanHero = ({ mode, gapAmount, horizon, lines, note }: PlanHeroProps) => {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const amount = Math.abs(gapAmount);
  const label = mode === 'surplus' ? PLAN_COPY.extraLabel : mode === 'shortfall' ? PLAN_COPY.gapLabel : PLAN_COPY.month;
  const accent = mode === 'shortfall' ? 'border-l-amber-500/50' : mode === 'surplus' ? 'border-l-emerald-500/50' : 'border-l-primary/40';
  const showBreakdown = mode !== 'balanced' && lines.length > 0;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {horizon === 'quincena' ? PLAN_COPY.fortnight : PLAN_COPY.month}
        </p>
        <h2 className="text-xl font-semibold tracking-tight">{titleFor(mode)}</h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">{PLAN_COPY.heroHint}</p>
      </div>
      {mode === 'balanced' ? (
        <p className="text-sm text-muted-foreground">{PLAN_COPY.balancedBody}</p>
      ) : (
        <div className="space-y-2">
          <div className={cn(METRIC_STRIP_CLASS, 'border-l-[3px]', accent)}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums">{formatCurrency(amount)}</p>
          </div>
          {showBreakdown ? (
            <Collapsible open={open} onOpenChange={setOpen}>
              <CollapsibleTrigger
                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-4 text-left text-sm font-medium"
                aria-expanded={open}
                aria-controls={panelId}
              >
                {PLAN_COPY.gapHow}
                <ChevronDown className={cn('size-4 shrink-0 transition-transform', open && 'rotate-180')} aria-hidden />
              </CollapsibleTrigger>
              <CollapsibleContent id={panelId} className="mt-2 rounded-xl border border-border/60 bg-card px-4 py-3">
                <ul className="space-y-2">
                  {groupGapBreakdownLines(lines).map((row) =>
                    row.kind === 'lender' ? (
                      <LenderGroup key={row.id} label={row.label} total={row.total} lines={row.lines} />
                    ) : (
                      <BreakdownLine key={row.line.id} line={row.line} />
                    ),
                  )}
                </ul>
                {note ? <p className="mt-3 text-xs text-muted-foreground">{note}</p> : null}
              </CollapsibleContent>
            </Collapsible>
          ) : null}
        </div>
      )}
    </div>
  );
};
