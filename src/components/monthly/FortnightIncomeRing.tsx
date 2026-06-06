'use client';

import { cn, formatCurrency } from '@/lib/utils';

type FortnightIncomeRingProps = {
  /** Porcentaje del ingreso ya comprometido (pagado + pendiente). */
  percentCommitted: number;
  /** Ingresos del periodo (base del 100 %). */
  periodIncome: number;
  className?: string;
};

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

export const FortnightIncomeRing = ({
  percentCommitted,
  periodIncome,
  className,
}: FortnightIncomeRingProps) => {
  const safePercent = clampPercent(Math.round(percentCommitted));

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (safePercent / 100) * circumference;

  return (
    <div
      className={cn(
        'flex shrink-0 flex-col items-center justify-center',
        className,
      )}
      role="img"
      aria-label={`${safePercent}% del ingreso de la quincena ya comprometido; ingresos ${formatCurrency(periodIncome)}`}
    >
      <div className="relative h-[7.25rem] w-[7.25rem] sm:h-32 sm:w-32">
        <svg
          viewBox="0 0 100 100"
          className="h-full w-full -rotate-90"
          aria-hidden
        >
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted/30"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="text-primary transition-[stroke-dashoffset] duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
          <span className="font-mono text-lg font-bold tabular-nums leading-none text-foreground sm:text-xl">
            {safePercent}%
          </span>
          <span className="mt-0.5 text-[9px] font-medium leading-tight text-muted-foreground sm:text-[10px]">
            del ingreso
          </span>
        </div>
      </div>
      <p className="mt-1 max-w-[9rem] text-center text-[10px] text-muted-foreground sm:text-xs">
        <span className="font-mono font-semibold tabular-nums text-foreground/90">
          {formatCurrency(periodIncome)}
        </span>
        <span className="block">ingresos del periodo</span>
      </p>
    </div>
  );
};
