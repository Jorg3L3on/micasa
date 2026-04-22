'use client';

import { RefreshCw } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import type { ExpenseFeedItem } from '@/types/expenses-feed';

type ExpenseCardProps = {
  expense: ExpenseFeedItem;
  pending?: boolean;
  onClick?: () => void;
};

export default function ExpenseCard({
  expense,
  pending,
  onClick,
}: ExpenseCardProps) {
  const subtitleParts = [expense.category, expense.paymentMethod].filter(
    (p): p is string => Boolean(p),
  );
  const isInstallment =
    expense.creditInstallmentCurrent != null &&
    expense.creditInstallmentTotal != null;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg border border-border/50 bg-card px-4 py-3 text-left transition active:bg-muted/40',
        'min-h-[64px]',
        pending && 'opacity-60',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-sm font-medium text-foreground">
            {expense.description}
          </span>
          <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-foreground">
            {formatCurrency(expense.amount)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {subtitleParts.length > 0 && (
            <span className="truncate">{subtitleParts.join(' · ')}</span>
          )}
          {!expense.isPaid && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400">
              Planeado
            </span>
          )}
          {expense.isRecurring && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
              <RefreshCw className="size-3" aria-hidden />
              Recurrente
            </span>
          )}
          {isInstallment && (
            <span className="shrink-0 rounded-full border border-border/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
              Cuota {expense.creditInstallmentCurrent}/
              {expense.creditInstallmentTotal}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
