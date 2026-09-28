'use client';

import { Money } from '@/components/money';
import { MoneyInText } from '@/components/wallets/liquidity/money-in-text';
import { cn, formatCurrency } from '@/lib/utils';
import { roundMoney } from '@/lib/finance/liquidity-debt-breakdown';
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

const moreLabel = (
  block: DebtWhyBlock,
  accountKind: DebtAccountBreakdown['kind'],
) => {
  if (block.moreCount <= 0) return null;
  const suffix =
    accountKind === 'loan'
      ? ' · ver préstamo'
      : block.key === 'plazos'
        ? ' · ver tarjeta'
        : '';
  return (
    <>
      {block.moreCount} más ·{' '}
      <Money value={block.moreAmount} size="caption" tone="neutral" />
      {suffix}
    </>
  );
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
          block.key === 'plazos' && block.beyondBalance > 0
            ? {
                inSaldo: block.total,
                remaining: roundMoney(block.total + block.beyondBalance),
              }
            : null;
        const more = moreLabel(block, account.kind);
        return (
          <section key={block.key} aria-label={block.title}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="eyebrow text-muted-foreground">
                {block.title}
              </p>
              <p className="font-sans text-xs font-semibold tabular-nums text-foreground">
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
                        'text-caption text-muted-foreground',
                        line.status === 'overdue' && 'text-status-pending',
                      )}
                    >
                      <MoneyInText text={line.subtitle} />
                    </p>
                    {line.amountKind === 'monthly' && (line.remainingAmount ?? 0) > 0 ? (
                      <p className="text-caption text-muted-foreground">
                        quedan{' '}
                        <Money
                          value={line.remainingAmount ?? 0}
                          size="caption"
                          tone="neutral"
                        />{' '}
                        a meses
                      </p>
                    ) : null}
                  </div>
                  <p className="shrink-0 font-sans text-sm font-semibold tabular-nums">
                    {lineRightLabel(line)}
                  </p>
                </li>
              ))}
            </ul>
            {footnote ? (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                En el saldo de hoy{' '}
                <Money value={footnote.inSaldo} size="caption" tone="neutral" />.
                {' '}A meses quedan{' '}
                <Money value={footnote.remaining} size="caption" tone="neutral" />.
              </p>
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
