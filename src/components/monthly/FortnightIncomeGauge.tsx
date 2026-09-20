'use client';

import { getFortnightIncomeGaugeSegments } from '@/components/monthly/fortnight-income-commitment';
import {
  GAUGE_STROKE_WIDTH,
  describeGaugeTopArc,
  pointOnGaugeArc,
} from '@/components/monthly/fortnight-income-gauge-geometry';
import { cn, formatCurrency } from '@/lib/utils';

type FortnightIncomeGaugeProps = {
  /** Pagado + pendiente + nómina (compromiso de efectivo). */
  cashCommitted: number;
  /** Resto del presupuesto de la quincena (segmento aparte). */
  budgetRemaining?: number;
  /** Ingresos del periodo (base del 100 %). */
  periodIncome: number;
  className?: string;
};

/** Compromiso — electric blue: cash already spoken for (same fill as panel CTAs). */
const COMMITMENT_STROKE = 'text-primary dark:text-[#5b59ff]';
const COMMITMENT_FILL = 'fill-primary dark:fill-[#5b59ff]';
const COMMITMENT_DOT = 'bg-primary dark:bg-[#5b59ff]';

/** Presupuesto — luminous violet: remaining allocation (matches budget tiles). */
const BUDGET_STROKE = 'text-violet-500 dark:text-[#c4b5fd]';
const BUDGET_FILL = 'fill-violet-500 dark:fill-[#c4b5fd]';
const BUDGET_DOT = 'bg-violet-500 dark:bg-[#c4b5fd]';

/** Libre — teal: leftover income, distinct from blue commitment and green liquidity. */
const FREE_STROKE = 'text-teal-500 dark:text-[#2dd4bf]';
const FREE_FILL = 'fill-teal-500 dark:fill-[#2dd4bf]';
const FREE_DOT = 'bg-teal-500 dark:bg-[#2dd4bf]';

const CAP_R = GAUGE_STROKE_WIDTH / 2;
/** Tiny overlap so butt joins never show a hairline gap. */
const JOIN_OVERLAP_DEG = 0.45;

const ratioToDegSpan = (ratio: number) => ratio * 180;

const LegendSwatch = ({
  dotClassName,
  label,
}: {
  dotClassName: string;
  label: string;
}) => (
  <span className="flex items-center gap-1.5">
    <span
      className={cn('inline-block size-2 shrink-0 rounded-full', dotClassName)}
      aria-hidden
    />
    <span className="text-[10px] font-medium text-foreground/70">{label}</span>
  </span>
);

export const FortnightIncomeGauge = ({
  cashCommitted,
  budgetRemaining = 0,
  periodIncome,
  className,
}: FortnightIncomeGaugeProps) => {
  const segments = getFortnightIncomeGaugeSegments(
    periodIncome,
    cashCommitted,
    budgetRemaining,
  );
  const { cashRatio, budgetRatio, freeRatio, totalCommittedPercent } = segments;

  const cashEndDeg = 180 - ratioToDegSpan(cashRatio);
  const budgetEndDeg = cashEndDeg - ratioToDegSpan(budgetRatio);

  const hasCash = cashRatio > 0.0001;
  const hasBudget = budgetRatio > 0.0001;
  const hasFree = freeRatio > 0.0001;

  const cashPath = hasCash
    ? describeGaugeTopArc(
        180,
        cashEndDeg - (hasBudget || hasFree ? JOIN_OVERLAP_DEG : 0),
      )
    : '';
  const budgetPath = hasBudget
    ? describeGaugeTopArc(
        cashEndDeg + (hasCash ? JOIN_OVERLAP_DEG : 0),
        budgetEndDeg - (hasFree ? JOIN_OVERLAP_DEG : 0),
      )
    : '';
  const freePath = hasFree
    ? describeGaugeTopArc(
        budgetEndDeg + (hasCash || hasBudget ? JOIN_OVERLAP_DEG : 0),
        0,
      )
    : '';

  const startCap = hasCash
    ? { point: pointOnGaugeArc(180), className: COMMITMENT_FILL }
    : hasBudget
      ? { point: pointOnGaugeArc(180), className: BUDGET_FILL }
      : hasFree
        ? { point: pointOnGaugeArc(180), className: FREE_FILL }
        : null;

  const endCap = hasFree
    ? { point: pointOnGaugeArc(0), className: FREE_FILL }
    : hasBudget
      ? { point: pointOnGaugeArc(0), className: BUDGET_FILL }
      : hasCash
        ? { point: pointOnGaugeArc(0), className: COMMITMENT_FILL }
        : null;

  const showBudgetLegend = budgetRatio > 0.0001;

  return (
    <div
      className={cn('flex shrink-0 flex-col items-center', className)}
      role="img"
      aria-label={
        showBudgetLegend
          ? `${totalCommittedPercent}% del ingreso comprometido (${formatCurrency(cashCommitted)} en pagado/pendiente/nómina, ${formatCurrency(budgetRemaining)} en presupuesto restante); ingresos ${formatCurrency(periodIncome)}`
          : `${totalCommittedPercent}% del ingreso de la quincena ya comprometido; ingresos ${formatCurrency(periodIncome)}`
      }
    >
      <div className="relative h-[5.5rem] w-[8.5rem] sm:h-[6rem] sm:w-[9.5rem]">
        <svg viewBox="0 0 120 60" className="h-full w-full" aria-hidden>
          <path
            d={describeGaugeTopArc(180, 0)}
            fill="none"
            stroke="currentColor"
            strokeWidth={GAUGE_STROKE_WIDTH}
            strokeLinecap="round"
            className="text-muted-foreground/25"
          />
          {freePath ? (
            <path
              d={freePath}
              fill="none"
              stroke="currentColor"
              strokeWidth={GAUGE_STROKE_WIDTH}
              strokeLinecap="butt"
              className={cn('transition-[d] duration-500', FREE_STROKE)}
            />
          ) : null}
          {budgetPath ? (
            <path
              d={budgetPath}
              fill="none"
              stroke="currentColor"
              strokeWidth={GAUGE_STROKE_WIDTH}
              strokeLinecap="butt"
              className={cn('transition-[d] duration-500', BUDGET_STROKE)}
            />
          ) : null}
          {cashPath ? (
            <path
              d={cashPath}
              fill="none"
              stroke="currentColor"
              strokeWidth={GAUGE_STROKE_WIDTH}
              strokeLinecap="butt"
              className={cn('transition-[d] duration-500', COMMITMENT_STROKE)}
            />
          ) : null}
          {startCap ? (
            <circle
              cx={startCap.point.x}
              cy={startCap.point.y}
              r={CAP_R}
              className={startCap.className}
            />
          ) : null}
          {endCap ? (
            <circle
              cx={endCap.point.x}
              cy={endCap.point.y}
              r={CAP_R}
              className={endCap.className}
            />
          ) : null}
        </svg>
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center pb-0.5 text-center">
          <span className="font-mono text-xl font-bold tabular-nums leading-none text-foreground sm:text-2xl">
            {totalCommittedPercent}%
          </span>
          <span className="mt-0.5 text-[9px] font-medium text-muted-foreground sm:text-[10px]">
            del ingreso
          </span>
        </div>
      </div>
      <p className="mt-1.5 max-w-[11rem] text-center text-muted-foreground">
        <span className="font-mono text-base font-bold tabular-nums text-foreground sm:text-lg">
          {formatCurrency(periodIncome)}
        </span>
        <span className="mt-0.5 block text-[10px] font-medium sm:text-xs">
          ingresos del periodo
        </span>
      </p>
      {showBudgetLegend ? (
        <div
          className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1"
          aria-hidden
        >
          {cashRatio > 0.0001 ? (
            <LegendSwatch dotClassName={COMMITMENT_DOT} label="Compromiso" />
          ) : null}
          <LegendSwatch dotClassName={BUDGET_DOT} label="Presupuesto" />
          {freeRatio > 0.0001 ? (
            <LegendSwatch dotClassName={FREE_DOT} label="Libre" />
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
