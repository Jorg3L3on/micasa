'use client';

import { formatCurrency } from '@/lib/utils';
import {
  monthDebtItemsTotal,
  type MonthDebtItem,
} from '@/lib/finance/liquidity-month-debt-items';

const KIND_LABEL: Record<MonthDebtItem['kind'], string> = {
  card: 'Tarjeta',
  msi: 'Compra a meses',
  loan: 'Préstamo',
};

type LiquidityMonthDebtItemsListProps = {
  items: MonthDebtItem[];
  emptyMessage: string;
};

export const LiquidityMonthDebtItemsList = ({
  items,
  emptyMessage,
}: LiquidityMonthDebtItemsListProps) => {
  const total = monthDebtItemsTotal(items);

  return (
    <div className="mt-4 space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Conceptos de este mes
      </p>
      <div className="overflow-hidden rounded-xl border border-border/50">
        <ul className="max-h-72 divide-y divide-border/40 overflow-y-auto">
          {items.length === 0 ? (
            <li className="px-3 py-3 text-sm text-muted-foreground">{emptyMessage}</li>
          ) : (
            items.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {KIND_LABEL[item.kind]}
                    {item.subtitle ? ` · ${item.subtitle}` : ''}
                  </p>
                </div>
                <p className="shrink-0 font-mono text-sm font-bold tabular-nums">
                  {formatCurrency(item.amount)}
                </p>
              </li>
            ))
          )}
        </ul>
        {items.length > 0 ? (
          <div className="flex items-center justify-between gap-3 border-t border-border/60 bg-card/80 px-3 py-2.5">
            <p className="text-sm font-semibold">Total</p>
            <p className="font-mono text-sm font-bold tabular-nums">
              {formatCurrency(total)}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
};
