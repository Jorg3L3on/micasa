'use client';

import { useId } from 'react';
import { cn, formatCurrency } from '@/lib/utils';

type FortnightIncomeGaugeProps = {
  /** Porcentaje del ingreso ya comprometido (pagado + pendiente). */
  percentCommitted: number;
  /** Ingresos del periodo (base del 100 %). */
  periodIncome: number;
  className?: string;
};

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

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
  const largeArc = delta > 180 ? 1 : 0;
  const sweep = startDeg > endDeg ? 1 : 0;
  return `M ${start.x} ${start.y} A ${GAUGE_R} ${GAUGE_R} 0 ${largeArc} ${sweep} ${end.x} ${end.y}`;
};

export const FortnightIncomeGauge = ({
  percentCommitted,
  periodIncome,
  className,
}: FortnightIncomeGaugeProps) => {
  const gradientId = useId().replace(/:/g, '');
  const safePercent = clampPercent(Math.round(percentCommitted));
  const trackPath = describeTopArc(180, 0);
  const progressEnd = 180 - (safePercent / 100) * 180;
  const progressPath =
    safePercent > 0 ? describeTopArc(180, progressEnd) : '';

  return (
    <div
      className={cn('flex shrink-0 flex-col items-center', className)}
      role="img"
      aria-label={`${safePercent}% del ingreso de la quincena ya comprometido; ingresos ${formatCurrency(periodIncome)}`}
    >
      <div className="relative h-[5.5rem] w-[8.5rem] sm:h-[6rem] sm:w-[9.5rem]">
        <svg viewBox="0 0 120 60" className="h-full w-full" aria-hidden>
          <defs>
            <linearGradient
              id={gradientId}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="0%"
            >
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
          <path
            d={trackPath}
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            strokeLinecap="round"
            className="text-muted-foreground/30"
          />
          {progressPath ? (
            <path
              d={progressPath}
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth="10"
              strokeLinecap="round"
              className="transition-[d] duration-500"
            />
          ) : null}
        </svg>
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center pb-0.5 text-center">
          <span className="font-mono text-xl font-bold tabular-nums leading-none text-foreground sm:text-2xl">
            {safePercent}%
          </span>
          <span className="mt-0.5 text-[9px] font-medium text-muted-foreground sm:text-[10px]">
            del ingreso
          </span>
        </div>
      </div>
      <p className="mt-1 max-w-[9rem] text-center text-[10px] text-muted-foreground">
        <span className="font-mono font-semibold tabular-nums text-foreground/90">
          {formatCurrency(periodIncome)}
        </span>
        <span className="block">ingresos del periodo</span>
      </p>
    </div>
  );
};
