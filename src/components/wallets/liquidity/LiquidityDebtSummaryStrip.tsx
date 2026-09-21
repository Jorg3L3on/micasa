'use client';

import { METRIC_STRIP_CLASS } from '@/components/ui/metric-strip';
import { Button } from '@/components/ui/button';
import { debtCompositionParts } from '@/lib/finance/liquidity-debt-breakdown';
import { cn, formatCurrency } from '@/lib/utils';
import type { LiquidityDebtBreakdown } from '@/types/catalog';

type LiquidityDebtSummaryStripProps = {
  breakdown: LiquidityDebtBreakdown;
  className?: string;
  error?: boolean;
  onRetry?: () => void;
};

export const LiquidityDebtSummaryStrip = ({
  breakdown,
  className,
  error = false,
  onRetry,
}: LiquidityDebtSummaryStripProps) => {
  if (error) {
    return (
      <div
        className={cn(
          METRIC_STRIP_CLASS,
          'border-l-[3px] border-l-amber-500/50',
          className,
        )}
        role="alert"
      >
        <p className="text-sm text-foreground">
          No se pudo cargar de qué están hechas las deudas.
        </p>
        {onRetry ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2 h-8 px-2"
            onClick={onRetry}
          >
            Reintentar
          </Button>
        ) : null}
      </div>
    );
  }

  if (breakdown.debtTotal <= 0) return null;

  const composition = debtCompositionParts(breakdown);

  return (
    <div
      className={cn(
        METRIC_STRIP_CLASS,
        'border-l-[3px] border-l-amber-500/50',
        className,
      )}
      role="region"
      aria-label="Resumen de deudas"
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Debes
      </p>
      <p className="mt-1 font-mono text-xl font-bold tabular-nums text-amber-300">
        {formatCurrency(breakdown.debtTotal)}
      </p>
      {composition.length > 0 ? (
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {composition.map((item) => (
            <span key={item.key}>
              {item.label}{' '}
              <span className="font-mono tabular-nums text-foreground">
                {formatCurrency(item.amount)}
              </span>
            </span>
          ))}
        </p>
      ) : null}
      {breakdown.topConcepts.length > 0 ? (
        <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
          {breakdown.topConcepts
            .map((concept) => `${concept.title} ${formatCurrency(concept.amount)}`)
            .join(' · ')}
        </p>
      ) : null}
    </div>
  );
};
