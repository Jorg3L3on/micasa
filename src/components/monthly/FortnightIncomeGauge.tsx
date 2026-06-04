'use client';

import { cn, formatCurrency } from '@/lib/utils';

type FortnightIncomeGaugeProps = {
  /** Porcentaje del ingreso ya comprometido (pagado + pendiente). */
  percentCommitted: number;
  /** Ingresos del periodo (base del 100 %). */
  periodIncome: number;
  className?: string;
};

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

const polar = (cx: number, cy: number, r: number, angleDeg: number) => {
  const rad = ((angleDeg - 180) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
};

const describeSemiArc = (
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
) => {
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);
  const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
};

export const FortnightIncomeGauge = ({
  percentCommitted,
  periodIncome,
  className,
}: FortnightIncomeGaugeProps) => {
  const safePercent = clampPercent(Math.round(percentCommitted));
  const cx = 60;
  const cy = 58;
  const radius = 44;
  const startAngle = 0;
  const endAngle = 180;
  const progressAngle = startAngle + (safePercent / 100) * (endAngle - startAngle);

  const trackPath = describeSemiArc(cx, cy, radius, startAngle, endAngle);
  const progressPath =
    safePercent > 0
      ? describeSemiArc(cx, cy, radius, startAngle, progressAngle)
      : '';

  return (
    <div
      className={cn('flex shrink-0 flex-col items-center', className)}
      role="img"
      aria-label={`${safePercent}% del ingreso de la quincena ya comprometido; ingresos ${formatCurrency(periodIncome)}`}
    >
      <div className="relative h-[4.5rem] w-[7.5rem] sm:h-[5rem] sm:w-[8.5rem]">
        <svg viewBox="0 0 120 64" className="h-full w-full" aria-hidden>
          <defs>
            <linearGradient id="fortnight-gauge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--primary))" />
              <stop offset="100%" stopColor="rgb(139 92 246)" />
            </linearGradient>
          </defs>
          <path
            d={trackPath}
            fill="none"
            stroke="currentColor"
            strokeWidth="9"
            strokeLinecap="round"
            className="text-muted/35"
          />
          {progressPath ? (
            <path
              d={progressPath}
              fill="none"
              stroke="url(#fortnight-gauge-gradient)"
              strokeWidth="9"
              strokeLinecap="round"
              className="transition-[d] duration-500"
            />
          ) : null}
        </svg>
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center text-center">
          <span className="font-mono text-xl font-bold tabular-nums leading-none text-foreground sm:text-2xl">
            {safePercent}%
          </span>
          <span className="mt-0.5 text-[9px] font-medium text-muted-foreground sm:text-[10px]">
            del ingreso
          </span>
        </div>
      </div>
      <p className="mt-0.5 max-w-[9rem] text-center text-[10px] text-muted-foreground">
        <span className="font-mono font-semibold tabular-nums text-foreground/90">
          {formatCurrency(periodIncome)}
        </span>
        <span className="block">ingresos del periodo</span>
      </p>
    </div>
  );
};
