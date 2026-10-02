'use client';

import { useState, type FocusEvent, type PointerEvent } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { getFortnightCommitmentBar } from '@/components/monthly/fortnight-income-commitment';
import { NumberTicker } from '@/components/motion/number-ticker';
import { SPRING_LAYOUT } from '@/components/motion/ease';
import { DotPattern } from '@/components/ui/dot-pattern';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { STATUS_FILL_CLASS } from '@/lib/status-tone';
import { AURA_TONE_HEX } from '@/lib/ui/aura-palette';
import { cn, formatCurrency } from '@/lib/utils';

type SegmentKey = 'paid' | 'pending' | 'budget' | 'free';

type SegmentStyle = {
  label: string;
  dotClass: string;
  fillClass: string;
  glowClass: string;
};

const SEGMENT_STYLE: Record<SegmentKey, SegmentStyle> = {
  paid: {
    label: 'Pagado',
    dotClass: STATUS_FILL_CLASS.success,
    fillClass: 'bg-linear-to-b from-status-success to-status-success/70',
    glowClass: 'shadow-[0_0_14px_-3px_var(--status-success)]',
  },
  pending: {
    label: 'Pendiente',
    dotClass: STATUS_FILL_CLASS.pending,
    fillClass: 'bg-linear-to-b from-status-pending to-status-pending/70',
    glowClass: 'shadow-[0_0_14px_-3px_var(--status-pending)]',
  },
  budget: {
    label: 'Presupuesto',
    dotClass: STATUS_FILL_CLASS.info,
    fillClass: 'bg-linear-to-b from-status-info to-status-info/70',
    glowClass: 'shadow-[0_0_14px_-3px_var(--status-info)]',
  },
  free: {
    label: 'Libre',
    dotClass: 'bg-muted-foreground/40',
    fillClass: 'bg-muted-foreground/[0.07]',
    glowClass: '',
  },
};

const MIN_SEGMENT_PERCENT = 0.0001;
const DIMMED_OPACITY = 0.35;
const BAR_REVEAL_HIDDEN = 'inset(-10px 100% -10px -10px round 9999px)';
const BAR_REVEAL_SHOWN = 'inset(-10px -10px -10px -10px round 9999px)';

type BarSegment = { key: SegmentKey; percent: number };

type LegendEntry = {
  key: SegmentKey;
  amount: number;
  subtitle: string;
};

export type CommitmentMeterProps = {
  periodIncome: number;
  paidAmount: number;
  pendingAmount: number;
  /** Pagado + pendiente + nómina (cash part of the commitment). */
  cashCommittedAmount: number;
  /** Unspent fortnight budget. */
  leftoverAmount: number;
  paidSubtitle: string;
  pendingSubtitle: string;
  /** Show the Libre legend entry (hidden when the Entra/Te falta breakdown is visible). */
  showFree: boolean;
};

const toPercentOfIncome = (amount: number, income: number) =>
  income > 0 ? Math.round((amount / income) * 100) : 0;

const getLegendGridClass = (count: number) => {
  if (count >= 4) return 'grid-cols-2 @xl:grid-cols-4';
  if (count === 3) return 'grid-cols-3';
  return 'grid-cols-2';
};

export const CommitmentMeter = ({
  periodIncome,
  paidAmount,
  pendingAmount,
  cashCommittedAmount,
  leftoverAmount,
  paidSubtitle,
  pendingSubtitle,
  showFree,
}: CommitmentMeterProps) => {
  const prefersReducedMotion = useReducedMotion();
  const [hoveredKey, setHoveredKey] = useState<SegmentKey | null>(null);
  const [pinnedKey, setPinnedKey] = useState<SegmentKey | null>(null);
  const activeKey = hoveredKey ?? pinnedKey;

  const {
    paidPercent,
    pendingPercent,
    budgetPercent,
    freePercent,
    incomeMarkerPercent,
    totalCommittedPercent,
  } = getFortnightCommitmentBar(
    periodIncome,
    paidAmount,
    cashCommittedAmount,
    leftoverAmount,
  );

  if (periodIncome <= 0 && totalCommittedPercent === 0) {
    return null;
  }

  const freeAmount = Math.max(
    0,
    periodIncome - cashCommittedAmount - leftoverAmount,
  );
  const overIncomePercent = Math.max(0, totalCommittedPercent - 100);

  const barSegments: BarSegment[] = (
    [
      { key: 'paid', percent: paidPercent },
      { key: 'pending', percent: pendingPercent },
      { key: 'budget', percent: budgetPercent },
      { key: 'free', percent: freePercent },
    ] satisfies BarSegment[]
  ).filter((segment) => segment.percent > MIN_SEGMENT_PERCENT);

  const legendEntries: LegendEntry[] = [
    ...(paidAmount > 0
      ? [{ key: 'paid' as const, amount: paidAmount, subtitle: paidSubtitle }]
      : []),
    { key: 'pending', amount: pendingAmount, subtitle: pendingSubtitle },
    ...(leftoverAmount > 0
      ? [
          {
            key: 'budget' as const,
            amount: leftoverAmount,
            subtitle: 'Aún no gastado',
          },
        ]
      : []),
    ...(showFree && freeAmount > 0
      ? [{ key: 'free' as const, amount: freeAmount, subtitle: 'Del ingreso' }]
      : []),
  ];

  const handleMousePointerEnter =
    (key: SegmentKey) => (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType !== 'mouse') return;
      setHoveredKey(key);
    };

  const handleMousePointerLeave = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'mouse') return;
    setHoveredKey(null);
  };

  const handleLegendToggle = (key: SegmentKey) => {
    setPinnedKey((current) => (current === key ? null : key));
  };

  const handleLegendKeyboardFocus = (key: SegmentKey) => (event: FocusEvent<HTMLButtonElement>) => {
    if (!event.currentTarget.matches(':focus-visible')) return;
    setHoveredKey(key);
  };

  const handleLegendBlur = () => {
    setHoveredKey(null);
  };

  const segmentTransition = prefersReducedMotion
    ? { duration: 0 }
    : SPRING_LAYOUT;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <p className="flex min-w-0 items-baseline gap-1.5">
          <NumberTicker
            value={totalCommittedPercent}
            suffix="%"
            className="text-2xl font-black leading-none tracking-tight text-foreground"
          />
          <span className="truncate text-caption text-muted-foreground">
            comprometido
            {overIncomePercent > 0 ? (
              <span style={{ color: AURA_TONE_HEX.destructive }}>
                {' '}
                · {overIncomePercent}% arriba
              </span>
            ) : null}
          </span>
        </p>
        {periodIncome > 0 ? (
          <p className="shrink-0 text-caption text-muted-foreground">
            de{' '}
            <span className="font-sans font-semibold tabular-nums text-foreground/80">
              {formatCurrency(periodIncome)}
            </span>
          </p>
        ) : null}
      </div>

      <div className="relative">
        <div
          className="relative h-3.5 w-full rounded-full bg-muted/40 p-[2px] ring-1 ring-inset ring-white/[0.08]"
          role="progressbar"
          aria-valuenow={totalCommittedPercent}
          aria-valuemin={0}
          aria-valuemax={Math.max(100, totalCommittedPercent)}
          aria-label={`${totalCommittedPercent}% del ingreso comprometido`}
        >
          <motion.div
            className="flex h-full w-full gap-[3px]"
            initial={
              prefersReducedMotion ? false : { clipPath: BAR_REVEAL_HIDDEN }
            }
            animate={{ clipPath: BAR_REVEAL_SHOWN }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { duration: 0.32, ease: [0.16, 1, 0.3, 1] }
            }
          >
            {barSegments.map((segment) => {
              const style = SEGMENT_STYLE[segment.key];
              const isActive = activeKey === segment.key;
              const isDimmed = activeKey != null && !isActive;
              return (
                <motion.div
                  key={segment.key}
                  aria-hidden
                  className={cn(
                    'relative h-full min-w-[3px] basis-0 overflow-hidden rounded-full',
                    style.fillClass,
                    style.glowClass,
                  )}
                  initial={false}
                  animate={{
                    flexGrow: segment.percent,
                    opacity: isDimmed ? DIMMED_OPACITY : 1,
                    scaleY: isActive && !prefersReducedMotion ? 1.3 : 1,
                  }}
                  transition={segmentTransition}
                  onPointerEnter={handleMousePointerEnter(segment.key)}
                  onPointerLeave={handleMousePointerLeave}
                >
                  {segment.key === 'free' ? (
                    <DotPattern className="fill-muted-foreground/45" />
                  ) : (
                    <span className="pointer-events-none absolute inset-x-1 top-px h-px rounded-full bg-white/40" />
                  )}
                </motion.div>
              );
            })}
          </motion.div>
          <span
            className="pointer-events-none absolute inset-0 rounded-full bg-linear-to-b from-white/[0.12] to-transparent"
            aria-hidden
          />
        </div>

        {incomeMarkerPercent != null ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="absolute -top-1.5 -bottom-1 z-10 flex w-4 -translate-x-1/2 flex-col items-center"
                style={{ left: `${incomeMarkerPercent}%` }}
                aria-label="Aquí termina tu ingreso"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full bg-foreground shadow-[0_0_6px_var(--foreground)]"
                  aria-hidden
                />
                <span
                  className="w-px flex-1 bg-foreground/90"
                  aria-hidden
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>
              Aquí termina tu ingreso
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>

      <div
        className={cn(
          'grid gap-x-1.5 gap-y-1',
          getLegendGridClass(legendEntries.length),
        )}
      >
        {legendEntries.map((entry) => {
          const style = SEGMENT_STYLE[entry.key];
          const percentOfIncome = toPercentOfIncome(entry.amount, periodIncome);
          const isActive = activeKey === entry.key;
          const isDimmed = activeKey != null && !isActive;
          return (
            <button
              key={entry.key}
              type="button"
              aria-pressed={pinnedKey === entry.key}
              aria-label={`${style.label}, ${formatCurrency(entry.amount)}, ${percentOfIncome}% del ingreso`}
              className={cn(
                'flex min-w-0 flex-col items-stretch justify-start rounded-xl px-2 py-1.5 text-left transition-[background-color,opacity] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                isActive && 'bg-muted/40',
                isDimmed && 'opacity-50',
              )}
              onPointerEnter={handleMousePointerEnter(entry.key)}
              onPointerLeave={handleMousePointerLeave}
              onFocus={handleLegendKeyboardFocus(entry.key)}
              onBlur={handleLegendBlur}
              onClick={() => handleLegendToggle(entry.key)}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  className={cn(
                    'h-1.5 w-1.5 shrink-0 rounded-full',
                    style.dotClass,
                    entry.key !== 'free' && style.glowClass,
                  )}
                  aria-hidden
                />
                <span className="eyebrow min-w-0 truncate text-muted-foreground">
                  {style.label}
                </span>
              </span>
              <span className="mt-1 flex min-w-0 items-baseline gap-1.5">
                <span className="truncate font-sans text-sm font-bold tabular-nums text-foreground">
                  {formatCurrency(entry.amount)}
                </span>
                <span className="shrink-0 text-[10px] font-semibold tabular-nums text-muted-foreground">
                  {percentOfIncome}%
                </span>
              </span>
              <span className="mt-0.5 line-clamp-2 block text-caption leading-snug text-muted-foreground">
                {entry.subtitle}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
