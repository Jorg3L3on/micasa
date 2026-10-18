import { cn, formatCurrency } from '@/lib/utils';
import { AURA_TONE_HEX, getAuraBarStyle } from '@/lib/ui/aura-palette';

type FortnightBudgetProgressProps = {
  totalBudget: number;
  spent: number;
  className?: string;
};

const progressFillStyle = getAuraBarStyle(AURA_TONE_HEX.violet);

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
        className="h-2 rounded-full bg-muted/40 dark:bg-white/[0.08]"
        role="progressbar"
        aria-valuenow={usedPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${rawUsedPercent}% del presupuesto usado`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${usedPercent}%`, ...progressFillStyle }}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        <span className="font-sans font-semibold tabular-nums text-foreground">
          {formatCurrency(spent)}
        </span>{' '}
        usado de{' '}
        <span className="font-sans font-semibold tabular-nums text-foreground">
          {formatCurrency(totalBudget)}
        </span>
      </p>
    </div>
  );
};
