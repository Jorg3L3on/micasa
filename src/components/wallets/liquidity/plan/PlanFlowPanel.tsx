'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { MONTHLY_PANEL_SHELL_CLASS, PANEL_INSET_CLASS } from '@/components/monthly/monthly-panel-shell';
import { SectionHeader } from '@/components/section-header';
import { PLAN_COPY } from '@/components/wallets/liquidity/plan/copy';
import { groupGapBreakdownLines } from '@/components/wallets/liquidity/plan/group-gap-lines';
import {
  buildPlanFlow,
  gapHref,
  inflowHref,
  segmentForLine,
  FLOW_SEGMENTS,
  type FlowSegmentKey,
} from '@/components/wallets/liquidity/plan/plan-flow';
import { isScenarioGapLine } from '@/lib/finance/cash-plan/from-liquidity';
import type { DataGap, GapBreakdownLine, PlanInput, PlanMode } from '@/lib/finance/cash-plan/types';
import { cn, formatCurrency } from '@/lib/utils';

type PlanFlowPanelProps = {
  mode: PlanMode;
  input: Pick<PlanInput, 'gapLines' | 'obligations' | 'gapNote'>;
  dataGaps: readonly DataGap[];
};

const SEGMENT_COLOR = new Map(FLOW_SEGMENTS.map((segment) => [segment.key, segment.color]));

const Money = ({ amount, className }: { amount: number; className?: string }) => (
  <span className={cn('shrink-0 whitespace-nowrap font-sans font-semibold tabular-nums', className)}>
    {formatCurrency(amount)}
  </span>
);

const Dot = ({ color }: { color: string }) => (
  <span aria-hidden className="inline-block size-2 shrink-0 rounded-full" style={{ background: color }} />
);

const AMBER_ROW_CLASS =
  'rounded-xl border border-dashed border-status-pending-border bg-status-pending-soft px-3 py-2.5';

/** Amber dashed row: a data gap with the link that completes it. */
const GapRow = ({ gap, children }: { gap: DataGap; children?: ReactNode }) => {
  const href = gapHref(gap);
  return (
    <li className={AMBER_ROW_CLASS} data-gap-code={gap.code}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1 basis-40 text-sm">
          {children}
          <p className={cn('text-xs leading-snug text-status-pending', children ? 'mt-1' : null)}>
            {gap.message}
          </p>
        </div>
        {href ? (
          <Link
            href={href}
            className="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-status-pending-border px-3 text-sm font-semibold text-status-pending hover:bg-status-pending-soft"
          >
            {PLAN_COPY.gapAdd}
          </Link>
        ) : null}
      </div>
    </li>
  );
};

const LineLabel = ({ line, segment }: { line: GapBreakdownLine; segment: FlowSegmentKey | null }) => (
  <span className="flex min-w-0 items-start gap-2">
    {segment ? (
      <span className="mt-1.5">
        <Dot color={SEGMENT_COLOR.get(segment) ?? 'var(--muted-foreground)'} />
      </span>
    ) : null}
    <span className="min-w-0">
      <span className="font-medium">{line.label}</span>
      {line.detail ? <span className="mt-0.5 block text-xs text-muted-foreground">{line.detail}</span> : null}
    </span>
  </span>
);

const OutflowLine = ({
  line,
  segment,
  gaps,
}: {
  line: GapBreakdownLine;
  segment: FlowSegmentKey | null;
  gaps: DataGap[] | undefined;
}) => {
  const first = gaps?.[0];
  if (first) {
    return (
      <GapRow gap={first}>
        <span className="flex items-start justify-between gap-3">
          <LineLabel line={line} segment={segment} />
          <Money amount={line.amount} />
        </span>
      </GapRow>
    );
  }
  return (
    <li
      className={cn(
        'flex items-start justify-between gap-3 text-sm',
        isScenarioGapLine(line)
          && '-mx-2 rounded-lg border border-dashed border-[color-mix(in_srgb,var(--chart-2)_55%,transparent)] px-2 py-1.5',
      )}
    >
      <LineLabel line={line} segment={segment} />
      <Money amount={line.amount} />
    </li>
  );
};

const loanCountLabel = (count: number): string => (count === 1 ? '1 préstamo' : `${count} préstamos`);

const Inset = ({
  title,
  total,
  tone,
  children,
}: {
  title: string;
  total: number;
  tone: 'neutral' | 'good' | 'bad';
  children?: ReactNode;
}) => (
  <section
    aria-label={title}
    className={cn(
      PANEL_INSET_CLASS,
      'flex min-w-0 flex-col gap-3 p-4',
      tone === 'good' && 'border-status-success-border bg-status-success-soft dark:border-status-success-border dark:bg-status-success-soft',
      tone === 'bad' && 'border-status-overdue-border bg-status-overdue-soft dark:border-status-overdue-border dark:bg-status-overdue-soft',
    )}
  >
    <p className="eyebrow text-muted-foreground">{title}</p>
    <p
      className={cn(
        'font-sans text-2xl font-bold tabular-nums',
        tone === 'good' && 'text-status-success',
        tone === 'bad' && 'text-status-overdue',
      )}
      data-testid={`flow-${title.toLowerCase()}`}
    >
      {formatCurrency(Math.abs(total))}
    </p>
    {children}
  </section>
);

/**
 * "De dónde sale": Entra, Sale and Queda or Falta, always open.
 * The three totals come from the same signed lines as the hero amount.
 */
export const PlanFlowPanel = ({ mode, input, dataGaps }: PlanFlowPanelProps) => {
  const flow = buildPlanFlow(input, dataGaps);
  const short = flow.net < 0;
  const restTitle = short ? PLAN_COPY.flowShort : PLAN_COPY.flowLeft;
  const restTone = mode === 'balanced' ? 'neutral' : short ? 'bad' : 'good';
  const rows = groupGapBreakdownLines(flow.outflow.lines);

  return (
    <section className={cn(MONTHLY_PANEL_SHELL_CLASS, 'space-y-4 p-4 sm:p-6')} aria-labelledby="plan-flow-title">
      <SectionHeader
        id="plan-flow-title"
        title={PLAN_COPY.flowTitle}
        subtitle={short ? PLAN_COPY.flowHintShort : PLAN_COPY.flowHint}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Inset title={PLAN_COPY.flowIn} total={flow.inflow.total} tone="neutral">
          {flow.inflow.lines.length > 0 ? (
            <ul className="space-y-2 border-t border-border/50 pt-3">
              {flow.inflow.lines.map((line) => {
                const href = inflowHref(line);
                return (
                  <li key={line.id} className="flex items-start justify-between gap-3 text-sm">
                    {href ? (
                      <Link href={href} className="min-w-0 font-medium hover:underline">
                        {line.label}
                      </Link>
                    ) : (
                      <span className="min-w-0 font-medium">{line.label}</span>
                    )}
                    <Money amount={line.amount} />
                  </li>
                );
              })}
            </ul>
          ) : null}
        </Inset>

        <Inset title={PLAN_COPY.flowOut} total={flow.outflow.total} tone="neutral">
          {flow.outflow.segments ? (
            <div className="space-y-2">
              <div className="flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                {flow.outflow.segments
                  .filter((segment) => segment.share > 0)
                  .map((segment) => (
                    <span key={segment.key} className="h-full" style={{ width: `${segment.share}%`, background: segment.color }} />
                  ))}
              </div>
              <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {flow.outflow.segments
                  .filter((segment) => segment.total > 0)
                  .map((segment) => (
                    <li key={segment.key} className="flex items-center gap-1.5">
                      <Dot color={segment.color} />
                      {segment.label} <span className="tabular-nums">{formatCurrency(segment.total)}</span>
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
          {rows.length > 0 || flow.orphanGaps.length > 0 ? (
            <ul className="space-y-2 border-t border-border/50 pt-3">
              {rows.map((row) =>
                row.kind === 'lender' ? (
                  <li key={row.id} className="text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex min-w-0 items-start gap-2">
                        <span className="mt-1.5">
                          <Dot color={SEGMENT_COLOR.get('loans') ?? 'var(--muted-foreground)'} />
                        </span>
                        <span className="min-w-0">
                          <span className="font-medium">{row.label}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">{loanCountLabel(row.lines.length)}</span>
                        </span>
                      </span>
                      <Money amount={row.total} />
                    </div>
                    <ul className="mt-2 space-y-1.5 border-l border-border/60 pl-3">
                      {row.lines.map((line) => (
                        <OutflowLine key={line.id} line={line} segment={null} gaps={flow.lineGaps.get(line.id)} />
                      ))}
                    </ul>
                  </li>
                ) : (
                  <OutflowLine
                    key={row.line.id}
                    line={row.line}
                    segment={segmentForLine(row.line, input.obligations)}
                    gaps={flow.lineGaps.get(row.line.id)}
                  />
                ),
              )}
              {flow.orphanGaps.map((gap) => (
                <GapRow key={`${gap.code}-${gap.obligationId}`} gap={gap} />
              ))}
            </ul>
          ) : (
            <p className="border-t border-border/50 pt-3 text-xs text-muted-foreground">{PLAN_COPY.flowNothingDue}</p>
          )}
        </Inset>

        <Inset title={restTitle} total={flow.net} tone={restTone}>
          <p className="border-t border-border/50 pt-3 text-xs leading-relaxed text-muted-foreground">
            {short ? PLAN_COPY.flowShortNote : mode === 'balanced' ? PLAN_COPY.balancedBody : PLAN_COPY.flowLeftNote}
          </p>
        </Inset>
      </div>

      {input.gapNote ? <p className="text-xs text-muted-foreground">{input.gapNote}</p> : null}

      {flow.generalGaps.length > 0 ? (
        <div className="space-y-2" role="status">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="size-4 shrink-0 text-status-pending" aria-hidden />
            {PLAN_COPY.gapsTitle}
          </p>
          <ul className="space-y-2">
            {flow.generalGaps.map((gap) => (
              <GapRow key={`${gap.code}-${gap.message}`} gap={gap} />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
};
