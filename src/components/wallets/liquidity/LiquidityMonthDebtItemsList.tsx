'use client';

import { LenderIcon } from '@/components/loans/LenderIdentity';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';
import { cn, formatCurrency } from '@/lib/utils';
import {
  monthDebtItemsTotal,
  monthDebtPaymentsTotal,
  type MonthDebtItem,
} from '@/lib/finance/liquidity-month-debt-items';

const KIND_LABEL: Record<MonthDebtItem['kind'], string> = {
  card: 'Tarjeta',
  msi: 'Compra a meses',
  loan: 'Préstamo',
};

const KIND_PILL: Record<MonthDebtItem['kind'], string> = {
  card: 'bg-violet-500/10 text-violet-300 ring-violet-500/20',
  msi: 'bg-fuchsia-500/10 text-fuchsia-300 ring-fuchsia-500/20',
  loan: 'bg-amber-500/10 text-amber-300 ring-amber-500/20',
};

const ROW_ICON_CLASS = 'h-8 w-8 rounded-lg text-[10px]';
const ROW_ICON_INNER_CLASS = 'h-4 w-4';

export type MonthDebtListMode = 'remaining' | 'payment';

type DisplayRow = MonthDebtItem & { displayAmount: number };

const rowsForMode = (items: readonly MonthDebtItem[], mode: MonthDebtListMode): DisplayRow[] =>
  items
    .map((item) => {
      const displayAmount =
        mode === 'payment' ? (item.payment_amount ?? 0) : item.amount;
      return { ...item, displayAmount };
    })
    .filter((item) => item.displayAmount > 0);

type LiquidityMonthDebtItemsListProps = {
  items: MonthDebtItem[];
  emptyMessage: string;
  mode?: MonthDebtListMode;
  totalLabel?: string;
  /** When set, overrides computed total (e.g. chart `outstanding_debt_total`). */
  totalOverride?: number;
  className?: string;
};

export const LiquidityMonthDebtItemsList = ({
  items,
  emptyMessage,
  mode = 'remaining',
  totalLabel,
  totalOverride,
  className,
}: LiquidityMonthDebtItemsListProps) => {
  const rows = rowsForMode(items, mode);
  const total =
    totalOverride ??
    (mode === 'payment' ? monthDebtPaymentsTotal(items) : monthDebtItemsTotal(items));
  const resolvedTotalLabel =
    totalLabel ?? (mode === 'payment' ? 'Total del mes' : 'Total adeudo');

  return (
    <div className={className}>
      <div className="overflow-hidden rounded-xl border border-border/50 dark:border-white/[0.07]">
        <ul className="max-h-72 divide-y divide-border/40 overflow-y-auto dark:divide-white/[0.06]">
          {rows.length === 0 ? (
            <li className="px-3 py-4 text-center text-sm text-muted-foreground">{emptyMessage}</li>
          ) : (
            rows.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-muted/20"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  {item.kind === 'loan' ? (
                    <LenderIcon
                      name={item.lender_name ?? item.title}
                      providerIconKey={item.lender_icon_key}
                      className={ROW_ICON_CLASS}
                      iconClassName={ROW_ICON_INNER_CLASS}
                    />
                  ) : (
                    <WalletProviderIcon
                      providerIconKey={item.wallet_icon_key}
                      className={ROW_ICON_CLASS}
                      iconClassName={ROW_ICON_INNER_CLASS}
                    />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span
                        className={cn(
                          'rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1',
                          KIND_PILL[item.kind],
                        )}
                      >
                        {KIND_LABEL[item.kind]}
                      </span>
                      {item.subtitle ? <span>{item.subtitle}</span> : null}
                    </p>
                  </div>
                </div>
                <p className={cnAmountClass(mode)}>{formatCurrency(item.displayAmount)}</p>
              </li>
            ))
          )}
        </ul>
        {rows.length > 0 ? (
          <div className="flex items-center justify-between gap-3 border-t border-border/60 bg-muted/20 px-3 py-2.5 dark:border-white/[0.08] dark:bg-white/[0.03]">
            <p className="text-sm font-semibold">{resolvedTotalLabel}</p>
            <p className={cnAmountClass(mode)}>{formatCurrency(total)}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
};

const cnAmountClass = (mode: MonthDebtListMode): string =>
  mode === 'payment'
    ? 'shrink-0 font-mono text-sm font-bold tabular-nums text-violet-300'
    : 'shrink-0 font-mono text-sm font-bold tabular-nums text-amber-300';
