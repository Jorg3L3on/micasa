'use client';

import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent,
} from 'react';
import { RefreshCw } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import type { ExpenseFeedItem } from '@/types/expenses-feed';

const DOUBLE_CLICK_MS = 280;

type ExpenseCardProps = {
  expense: ExpenseFeedItem;
  pending?: boolean;
  /** If the row was swiped open, one tap closes without editing. */
  onSingleActivate?: () => void;
  /** Double-click / double-tap opens edit (and parent may close swipe first). */
  onDoubleActivate?: () => void;
};

export default function ExpenseCard({
  expense,
  pending,
  onSingleActivate,
  onDoubleActivate,
}: ExpenseCardProps) {
  const subtitleParts = [expense.category, expense.paymentMethod].filter(
    (p): p is string => Boolean(p),
  );
  const isInstallment =
    expense.creditInstallmentCurrent != null &&
    expense.creditInstallmentTotal != null;

  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearClickTimer = useCallback(() => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearClickTimer(), [clearClickTimer]);

  const handleClick = useCallback(() => {
    if (pending) return;
    if (!onDoubleActivate && !onSingleActivate) return;
    if (clickTimerRef.current) {
      clearClickTimer();
      onDoubleActivate?.();
      return;
    }
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      onSingleActivate?.();
    }, DOUBLE_CLICK_MS);
  }, [
    pending,
    onDoubleActivate,
    onSingleActivate,
    clearClickTimer,
  ]);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (pending || !onDoubleActivate) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      clearClickTimer();
      onDoubleActivate();
    }
  };

  const interactive = Boolean(
    !pending && (onSingleActivate || onDoubleActivate),
  );

  return (
    <div
      role="button"
      tabIndex={interactive ? 0 : -1}
      aria-disabled={pending || !interactive}
      onClick={interactive ? handleClick : undefined}
      onKeyDown={handleKeyDown}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg border border-border/50 bg-card px-4 py-3 text-left transition active:bg-muted/40',
        'min-h-[64px]',
        pending && 'pointer-events-none opacity-60',
        interactive &&
          'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      {onDoubleActivate ? (
        <span className="sr-only">Doble clic para editar.</span>
      ) : null}
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
    </div>
  );
}
