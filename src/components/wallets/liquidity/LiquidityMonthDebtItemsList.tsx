'use client';

import { LenderIcon } from '@/components/loans/LenderIdentity';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';
import { AuraRowBloom } from '@/components/aura/aura-surface';
import { MONTHLY_PANEL_SHELL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { METRIC_STRIP_CLASS } from '@/components/ui/metric-strip';
import { AURA_TONE_HEX, getAuraWalletColor } from '@/lib/ui/aura-palette';
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
  card: 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  msi: 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300',
  loan: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
};

const KIND_DOT: Record<MonthDebtItem['kind'], string> = {
  card: 'bg-violet-500 dark:bg-violet-400',
  msi: 'bg-fuchsia-500 dark:bg-fuchsia-400',
  loan: 'bg-amber-500 dark:bg-amber-400',
};

const ROW_ICON_CLASS = 'h-9 w-9 rounded-lg text-[10px]';
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

const rowAuraColor = (item: MonthDebtItem): string =>
  item.kind === 'loan'
    ? AURA_TONE_HEX.amber
    : getAuraWalletColor(item.wallet_icon_key, undefined, 'violet');

const amountClass = (mode: MonthDebtListMode): string =>
  cn(
    'shrink-0 font-mono text-sm font-bold tabular-nums',
    mode === 'payment' ? 'text-foreground' : 'text-amber-700 dark:text-amber-300',
  );

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

  if (rows.length === 0) {
    return (
      <p
        className={cn(
          'rounded-xl border border-dashed border-border/40 px-3 py-8 text-center text-xs text-muted-foreground',
          className,
        )}
      >
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className={cn('flex flex-col gap-2', className)} role="list">
      {rows.map((item) => (
        <li
          key={item.id}
          className={cn(
            MONTHLY_PANEL_SHELL_CLASS,
            'isolate flex items-center gap-2.5 overflow-hidden rounded-xl px-3 py-3',
          )}
        >
          <AuraRowBloom color={rowAuraColor(item)} />
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
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight text-foreground">
              {item.title}
            </p>
            <p className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className={cn(
                  'inline-flex h-4 items-center gap-1 rounded-full border px-1.5 text-[10px] font-medium',
                  KIND_PILL[item.kind],
                )}
              >
                <span className={cn('h-1 w-1 rounded-full', KIND_DOT[item.kind])} aria-hidden />
                {KIND_LABEL[item.kind]}
              </span>
              {item.subtitle ? <span className="truncate">{item.subtitle}</span> : null}
            </p>
          </div>
          <p className={amountClass(mode)}>{formatCurrency(item.displayAmount)}</p>
        </li>
      ))}
      <li
        className={cn(
          METRIC_STRIP_CLASS,
          'mt-1 flex list-none items-center justify-between gap-2 border-l-[3px]',
          mode === 'payment' ? 'border-l-violet-500/50' : 'border-l-amber-500/50',
        )}
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {resolvedTotalLabel}
        </span>
        <span className={cn(amountClass(mode), 'text-base')}>{formatCurrency(total)}</span>
      </li>
    </ul>
  );
};
