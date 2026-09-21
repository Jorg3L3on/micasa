'use client';

import { cn, formatCurrency } from '@/lib/utils';
import { formatPlazosFootnote } from '@/lib/finance/liquidity-debt-breakdown';
import type { DebtAccountBreakdown, DebtWhyBlock, DebtWhyLine } from '@/types/catalog';

type LiquidityAccountDebtWhyProps = {
  account: DebtAccountBreakdown;
  className?: string;
  onMore?: () => void;
};

const lineRightLabel = (line: DebtWhyLine): string => {
  if (line.amountKind === 'monthly') {
    return `${formatCurrency(line.monthlyAmount ?? line.amount)}/mes`;
  }
  return formatCurrency(line.amount);
};

const moreLabel = (block: DebtWhyBlock, accountKind: DebtAccountBreakdown['kind']): string => {
  if (block.moreCount <= 0) return '';
  const count = `${block.moreCount} más · ${formatCurrency(block.moreAmount)}`;
  if (accountKind === 'loan') return `${count} · ver préstamo`;
  if (block.key === 'plazos') return `${count} · ver tarjeta`;
  return count;
};

export const LiquidityAccountDebtWhy = ({
  account,
  className,
  onMore,
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
      {account.blocks.map((block) => {
        const footnote =
          block.key === 'plazos'
            ? formatPlazosFootnote(block.total, block.beyondBalance)
            : null;
        const more = moreLabel(block, account.kind);
        return (
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
                    {line.amountKind === 'monthly' && (line.remainingAmount ?? 0) > 0 ? (
                      <p className="text-[11px] text-muted-foreground">
                        quedan {formatCurrency(line.remainingAmount ?? 0)} a meses
                      </p>
                    ) : null}
                  </div>
                  <p className="shrink-0 font-mono text-sm font-semibold tabular-nums">
                    {lineRightLabel(line)}
                  </p>
                </li>
              ))}
            </ul>
            {footnote ? (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{footnote}</p>
            ) : null}
            {more ? (
              onMore ? (
                <button
                  type="button"
                  onClick={onMore}
                  className="mt-2 text-left text-xs text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {more}
                </button>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">{more}</p>
              )
            ) : null}
          </section>
        );
      })}
    </div>
  );
};
