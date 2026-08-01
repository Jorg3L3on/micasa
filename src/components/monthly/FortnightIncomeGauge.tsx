'use client';

import { getIncomeCommitmentTone } from '@/components/monthly/fortnight-income-commitment';
import { cn, formatCurrency } from '@/lib/utils';

type FortnightIncomeGaugeProps = {
  /** Porcentaje del ingreso ya comprometido (pagado + pendiente). */
  percentCommitted: number;
  /** Ingresos del periodo (base del 100 %). */
  periodIncome: number;
  className?: string;
};

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

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

const GAUGE_CX = 60;
const GAUGE_CY = 54;
const GAUGE_R = 46;

/** Arco superior: 180° = izquierda, 0° = derecha, 90° = arriba. */
const pointOnArc = (degrees: number) => {
  const rad = (degrees * Math.PI) / 180;
  return {
    x: GAUGE_CX + GAUGE_R * Math.cos(rad),
    y: GAUGE_CY - GAUGE_R * Math.sin(rad),
  };
};

const describeTopArc = (startDeg: number, endDeg: number) => {
  const start = pointOnArc(startDeg);
  const end = pointOnArc(endDeg);
  const delta = Math.abs(startDeg - endDeg);
  if (delta < 0.01) return '';
  const largeArc = delta > 180 ? 1 : 0;
  const sweep = startDeg > endDeg ? 1 : 0;
  return `M ${start.x} ${start.y} A ${GAUGE_R} ${GAUGE_R} 0 ${largeArc} ${sweep} ${end.x} ${end.y}`;
};

export const FortnightIncomeGauge = ({
  percentCommitted,
  periodIncome,
  className,
}: FortnightIncomeGaugeProps) => {
  const safePercent = clampPercent(Math.round(percentCommitted));
  const tone = getIncomeCommitmentTone(safePercent);
  const freePercent = 100 - safePercent;
  /** Ángulo donde termina lo comprometido / empieza lo libre (180° → 0°). */
  const freeStartDeg = 180 - (safePercent / 100) * 180;

  const committedPath =
    safePercent > 0 ? describeTopArc(180, freeStartDeg) : '';
  const freePath =
    freePercent > 0 ? describeTopArc(freeStartDeg, 0) : '';

  return (
    <div
      className={cn('flex shrink-0 flex-col items-center', className)}
      role="img"
      aria-label={`${safePercent}% del ingreso de la quincena ya comprometido; ingresos ${formatCurrency(periodIncome)}`}
    >
      <div className="relative h-[5.5rem] w-[8.5rem] sm:h-[6rem] sm:w-[9.5rem]">
        <svg viewBox="0 0 120 60" className="h-full w-full" aria-hidden>
          {freePath ? (
            <path
              d={freePath}
              fill="none"
              stroke="currentColor"
              strokeWidth="10"
              strokeLinecap="round"
              className="text-sky-500 transition-[d] duration-500 dark:text-sky-400"
            />
          ) : null}
          {committedPath ? (
            <path
              d={committedPath}
              fill="none"
              stroke="currentColor"
              strokeWidth="10"
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
            {safePercent}%
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
    </div>
  );
};
