import { cn, formatCurrency } from '@/lib/utils';

type FortnightBudgetProgressProps = {
  totalBudget: number;
  spent: number;
  className?: string;
};

const progressFillClass = 'bg-violet-500 dark:bg-violet-400';

/**
 * Presupuesto restante for the sidebar: amount + violet progress bar + usado.
 */
export const FortnightBudgetProgress = ({
  totalBudget,
  spent,
  className,
}: FortnightBudgetProgressProps) => {
  if (totalBudget <= 0) return null;

  const rawUsedPercent = Math.round((spent / totalBudget) * 100);
  const usedPercent = Math.min(100, Math.max(0, rawUsedPercent));
  return (
    <div
      className={cn('space-y-2', className)}
      role="region"
      aria-label="Presupuesto de la quincena"
    >
      <div
        className="h-2.5 overflow-hidden rounded-full bg-muted/50"
        role="progressbar"
        aria-valuenow={usedPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${rawUsedPercent}% del presupuesto usado`}
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-500',
            progressFillClass,
          )}
          style={{ width: `${usedPercent}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          <span className="font-mono font-semibold tabular-nums text-foreground">
            {formatCurrency(spent)}
          </span>{' '}
          usado de{' '}
          <span className="font-mono font-semibold tabular-nums text-foreground">
            {formatCurrency(totalBudget)}
          </span>
        </span>
        <span className="font-mono font-semibold tabular-nums text-foreground">
          {rawUsedPercent}% usado
        </span>
      </div>
    </div>
  );
};
