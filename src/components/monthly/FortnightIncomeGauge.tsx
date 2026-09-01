'use client';

import { useId } from 'react';
import {
  getFortnightIncomeGaugeSegments,
  getIncomeCommitmentTone,
} from '@/components/monthly/fortnight-income-commitment';
import {
  GAUGE_STROKE_WIDTH,
  describeGaugeTopArc,
  gaugeJoinInsetDeg,
  insetArcJoins,
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

const commitmentStrokeClass = (tone: 'ok' | 'warning' | 'danger') => {
  if (tone === 'danger') return 'text-destructive';
  if (tone === 'warning') return 'text-amber-500 dark:text-amber-400';
  return 'text-emerald-500 dark:text-emerald-400';
};

const commitmentLabelClass = (tone: 'ok' | 'warning' | 'danger') => {
  if (tone === 'danger') return 'text-destructive';
  if (tone === 'warning') return 'text-amber-600 dark:text-amber-400';
  return 'text-emerald-700 dark:text-emerald-300';
};

/** Presupuesto restante: violet (sky ya es “libre” en este gauge). */
const BUDGET_STROKE_CLASS = 'text-violet-500 dark:text-violet-400';

const ratioToDegSpan = (ratio: number) => ratio * 180;

export const FortnightIncomeGauge = ({
  cashCommitted,
  budgetRemaining = 0,
  periodIncome,
  className,
}: FortnightIncomeGaugeProps) => {
  const uid = useId().replace(/:/g, '');
  const freeGradientId = `fortnightFree-${uid}`;
  const segments = getFortnightIncomeGaugeSegments(
    periodIncome,
    cashCommitted,
    budgetRemaining,
  );
  const { cashRatio, budgetRatio, freeRatio, totalCommittedPercent } = segments;
  const tone = getIncomeCommitmentTone(totalCommittedPercent);
  const joinInset = gaugeJoinInsetDeg();

  const cashEndDeg = 180 - ratioToDegSpan(cashRatio);
  const budgetEndDeg = cashEndDeg - ratioToDegSpan(budgetRatio);

  const hasCash = cashRatio > 0.0001;
  const hasBudget = budgetRatio > 0.0001;
  const hasFree = freeRatio > 0.0001;

  const cashArc = hasCash
    ? insetArcJoins(180, cashEndDeg, false, hasBudget || hasFree, joinInset)
    : null;
  const budgetArc = hasBudget
    ? insetArcJoins(cashEndDeg, budgetEndDeg, hasCash, hasFree, joinInset)
    : null;
  const freeArc = hasFree
    ? insetArcJoins(budgetEndDeg, 0, hasCash || hasBudget, false, joinInset)
    : null;

  const cashPath = cashArc
    ? describeGaugeTopArc(cashArc.startDeg, cashArc.endDeg)
    : '';
  const budgetPath = budgetArc
    ? describeGaugeTopArc(budgetArc.startDeg, budgetArc.endDeg)
    : '';
  const freePath = freeArc
    ? describeGaugeTopArc(freeArc.startDeg, freeArc.endDeg)
    : '';

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
          <defs>
            <linearGradient id={freeGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3a37fc" />
              <stop offset="50%" stopColor="#911efe" />
              <stop offset="100%" stopColor="#ee477a" />
            </linearGradient>
          </defs>
          {freePath ? (
            <path
              d={freePath}
              fill="none"
              stroke={`url(#${freeGradientId})`}
              strokeWidth={GAUGE_STROKE_WIDTH}
              strokeLinecap="round"
              className="transition-[d] duration-500"
            />
          ) : null}
          {budgetPath ? (
            <path
              d={budgetPath}
              fill="none"
              stroke="currentColor"
              strokeWidth={GAUGE_STROKE_WIDTH}
              strokeLinecap="round"
              className={cn('transition-[d] duration-500', BUDGET_STROKE_CLASS)}
            />
          ) : null}
          {cashPath ? (
            <path
              d={cashPath}
              fill="none"
              stroke="currentColor"
              strokeWidth={GAUGE_STROKE_WIDTH}
              strokeLinecap="round"
              className={cn(
                'transition-[d] duration-500',
                commitmentStrokeClass(tone),
              )}
            />
          ) : null}
        </svg>
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center pb-0.5 text-center">
          <span
            className={cn(
              'font-mono text-xl font-bold tabular-nums leading-none sm:text-2xl',
              commitmentLabelClass(tone),
            )}
          >
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
            <span className="flex items-center gap-1">
              <span
                className={cn(
                  'inline-block h-1.5 w-1.5 rounded-full',
                  tone === 'danger'
                    ? 'bg-destructive'
                    : tone === 'warning'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500',
                )}
              />
              <span className="text-[9px] text-muted-foreground">Compromiso</span>
            </span>
          ) : null}
          <span className="flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-violet-500" />
            <span className="text-[9px] text-muted-foreground">Presupuesto</span>
          </span>
          {freeRatio > 0.0001 ? (
            <span className="flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-linear-to-r from-[#3a37fc] via-[#911efe] to-[#ee477a]" />
              <span className="text-[9px] text-muted-foreground">Libre</span>
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
