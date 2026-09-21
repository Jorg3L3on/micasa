'use client';

import { cn, formatCurrency } from '@/lib/utils';
import type { DebtAccountBreakdown, DebtWhyBlock } from '@/types/catalog';

type LiquidityAccountDebtWhyProps = {
  account: DebtAccountBreakdown;
  className?: string;
};

const moreLabel = (block: DebtWhyBlock): string => {
  if (block.moreCount <= 0) return '';
  const countLabel =
    block.key === 'cuotas'
      ? `${block.moreCount} más`
      : `${block.moreCount} más`;
  return `${countLabel} · ${formatCurrency(block.moreAmount)}`;
};

export const LiquidityAccountDebtWhy = ({
  account,
  className,
}: LiquidityAccountDebtWhyProps) => {
  if (account.blocks.length === 0) {
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>
        No hay detalle de esta deuda.
      </p>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {account.blocks.map((block) => (
        <section key={block.key} aria-label={block.title}>
          <div className="flex items-baseline justify-between gap-3">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {block.title}
            </h4>
            <p className="font-mono text-xs font-semibold tabular-nums text-foreground">
              {formatCurrency(block.total)}
            </p>
          </div>
          <ul className="mt-2 divide-y divide-border/40 overflow-hidden rounded-xl border border-border/50 dark:border-white/[0.07] dark:divide-white/[0.06]">
            {block.lines.map((line) => (
              <li
                key={line.id}
                className="flex items-start justify-between gap-3 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{line.title}</p>
                  <p
                    className={cn(
                      'text-[11px] text-muted-foreground',
                      line.status === 'overdue' && 'text-amber-300',
                    )}
                  >
                    {line.subtitle}
                  </p>
                </div>
                <p className="shrink-0 font-mono text-sm font-semibold tabular-nums">
                  {formatCurrency(line.amount)}
                </p>
              </li>
            ))}
          </ul>
          {block.moreCount > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">{moreLabel(block)}</p>
          ) : null}
        </section>
      ))}
    </div>
  );
};
