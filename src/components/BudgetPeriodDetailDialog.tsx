'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, BarChart3 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { CategoryLabel } from '@/components/categories/CategoryLabel';
import { formatDisplayDate, formatWallClockDateRange } from '@/lib/calendar-dates';
import {
  fetchBudgetPeriodExpenseGroups,
  type BudgetAllocationExpenseGroup,
} from '@/lib/api/budgets';
import {
  computeSharedWalletCategoryDisplays,
  formatWalletAdjustmentNote,
  groupAllocationsByWallet,
  type SharedWalletCategoryDisplay,
  type WalletPool,
} from '@/lib/finance/budget-wallet-pool';
import { formatCurrency, cn } from '@/lib/utils';
import { BUDGET_FREQUENCY_LABELS, type BudgetFrequency } from '@/schemas/budget.schema';
import type { BudgetAllocationItem, BudgetPeriodItem } from '@/types/catalog';
import type { ExpenseFeedItem } from '@/types/expenses-feed';
import type { FinanceContextType } from '@/types/finance-context';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period: BudgetPeriodItem | null;
  context: FinanceContextType;
};

function remainingToneClass(remaining: number, total: number) {
  if (remaining < 0) return 'text-destructive';
  if (total > 0 && remaining < total * 0.2) {
    return 'text-amber-600 dark:text-amber-400';
  }
  return 'text-emerald-600 dark:text-emerald-400';
}

function usageProgressClass(pct: number, overspent: boolean) {
  if (overspent || pct >= 100) return 'bg-destructive';
  if (pct >= 75) return 'bg-orange-500 dark:bg-orange-400';
  if (pct >= 50) return 'bg-amber-400 dark:bg-amber-500';
  return 'bg-emerald-500 dark:bg-emerald-400';
}

const PERIOD_PROGRESS_CLASS = 'bg-gradient-to-r from-sky-500 to-violet-500';
const WALLET_PROGRESS_CLASS = 'bg-gradient-to-r from-blue-500 to-sky-500';

function PeriodMetric({
  label,
  amount,
  toneClass,
  accent,
}: {
  label: string;
  amount: number;
  toneClass?: string;
  accent?: 'neutral' | 'spent' | 'available';
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border/60 bg-card px-3 py-2',
        accent === 'spent' && 'border-l-[3px] border-l-violet-500/50',
        accent === 'available' && 'border-l-[3px] border-l-emerald-500/50',
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          'mt-1 font-mono text-sm font-bold tabular-nums',
          accent === 'spent' && !toneClass && 'text-violet-600 dark:text-violet-400',
          accent === 'neutral' && 'text-foreground',
          !accent && 'text-foreground',
          toneClass,
        )}
      >
        {formatCurrency(amount)}
      </p>
    </div>
  );
}

function SpendProgressBar({
  spent,
  total,
  overspent = false,
  barClassName,
  className,
  label,
}: {
  spent: number;
  total: number;
  overspent?: boolean;
  barClassName?: string;
  className?: string;
  label: string;
}) {
  const pct = total > 0 ? Math.min((spent / total) * 100, 100) : 0;
  const displayPct = total > 0 ? Math.round((spent / total) * 100) : 0;

  return (
    <div className={className}>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted/50"
        role="progressbar"
        aria-valuenow={Math.min(displayPct, 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none',
            barClassName ?? usageProgressClass(displayPct, overspent),
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between gap-2 text-xs text-muted-foreground">
        <span
          className={cn(
            (overspent || displayPct >= 100) &&
              'font-medium text-destructive',
          )}
        >
          {displayPct}% usado
        </span>
        <span className="shrink-0 font-mono tabular-nums">
          {formatCurrency(spent)} / {formatCurrency(total)}
        </span>
      </div>
    </div>
  );
}

function WalletPoolHeader({ pool }: { pool: WalletPool }) {
  const overspent = pool.remaining < 0;

  return (
    <div
      className="border-b border-border/60 bg-muted/20 px-3 py-3"
      aria-label={`Saldo compartido de ${pool.wallet_name}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 dark:bg-blue-500/15">
            <BarChart3
              className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400"
              aria-hidden
            />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {pool.wallet_name}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(pool.spent)} gastado · {formatCurrency(pool.allocated)} asignado
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p
            className={cn(
              'font-mono text-sm font-bold tabular-nums',
              remainingToneClass(pool.remaining, pool.allocated),
            )}
          >
            {formatCurrency(overspent ? Math.abs(pool.remaining) : pool.remaining)}
          </p>
          <p
            className={cn(
              'text-[10px] text-muted-foreground',
              overspent && 'text-destructive',
            )}
          >
            {overspent ? 'excedido' : 'disponible'}
          </p>
        </div>
      </div>
      <SpendProgressBar
        className="mt-3"
        spent={pool.spent}
        total={pool.allocated}
        overspent={overspent}
        barClassName={overspent ? undefined : WALLET_PROGRESS_CLASS}
        label={`${pool.wallet_name}: gasto compartido del periodo`}
      />
    </div>
  );
}

function AllocationSkeleton({ nested = false }: { nested?: boolean }) {
  return (
    <div
      className={cn(
        'space-y-3 px-3 py-3',
        !nested && 'rounded-lg border border-border/60',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
    </div>
  );
}

function SharedWalletCategoryContext({
  display,
}: {
  display: SharedWalletCategoryDisplay;
}) {
  const adjustmentNote = formatWalletAdjustmentNote(display);
  if (display.walletAdjustment <= 0 || !adjustmentNote) return null;

  return (
    <div className="space-y-1.5 rounded-md border border-border/60 bg-card px-2.5 py-2">
      <p className="text-xs">
        <span className="font-mono tabular-nums text-foreground">
          {formatCurrency(display.categoryHeadroom)}
        </span>{' '}
        <span className="text-muted-foreground">del límite de categoría</span>
      </p>
      <p className="text-xs font-medium text-orange-950 dark:text-orange-500">
        {adjustmentNote}
      </p>
    </div>
  );
}

function AllocationSummary({
  allocation,
  index,
  spent,
  remaining,
  expenseCount,
  expanded,
  hideDisponible = false,
  hideWalletName = false,
  disponibleLabel = 'disponible',
  sharedWalletDisplay,
}: {
  allocation: BudgetAllocationItem;
  index: number;
  spent: number;
  remaining: number;
  expenseCount: number;
  expanded: boolean;
  hideDisponible?: boolean;
  hideWalletName?: boolean;
  disponibleLabel?: string;
  sharedWalletDisplay?: SharedWalletCategoryDisplay;
}) {
  const allocationOverspent = spent > allocation.amount;
  const hasExpenses = expenseCount > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <CategoryLabel
            name={allocation.category_name}
            icon={allocation.category_icon}
            className="text-sm font-medium"
            iconClassName="h-4 w-4"
          />
          {!hideWalletName ? (
            <p className="truncate text-xs text-muted-foreground">
              {allocation.wallet_name}
            </p>
          ) : null}
        </div>
        {!hideDisponible ? (
          <div className="flex shrink-0 items-start gap-2">
            <div className="text-right">
              <p
                className={cn(
                  'font-mono text-sm font-bold tabular-nums',
                  remainingToneClass(remaining, allocation.amount),
                )}
              >
                {formatCurrency(remaining)}
              </p>
              <p className="text-[10px] text-muted-foreground">{disponibleLabel}</p>
            </div>
          </div>
        ) : allocationOverspent ? (
          <Badge variant="destructive" className="shrink-0 text-[10px]">
            Excedido
          </Badge>
        ) : null}
      </div>

      <SpendProgressBar
        spent={spent}
        total={allocation.amount}
        overspent={allocationOverspent}
        label={`Gasto en ${allocation.category_name}`}
      />

      {sharedWalletDisplay ? (
        <SharedWalletCategoryContext display={sharedWalletDisplay} />
      ) : null}

      {hasExpenses ? (
        <p
          className={cn(
            'text-xs text-muted-foreground',
            expanded && 'text-foreground',
          )}
        >
          {expanded
            ? 'Ocultar transacciones'
            : `Ver ${expenseCount} ${expenseCount === 1 ? 'transacción' : 'transacciones'}`}
        </p>
      ) : null}
    </div>
  );
}

function AllocationExpenseList({
  expenses,
  categoryName,
}: {
  expenses: ExpenseFeedItem[];
  categoryName: string;
}) {
  return (
    <ul
      className="max-h-48 divide-y divide-border/60 overflow-y-auto border-t border-border/60"
      aria-label={`Transacciones de ${categoryName}`}
    >
      {expenses.map((expense) => (
        <li
          key={expense.id}
          className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
        >
          <div className="min-w-0">
            <p className="truncate text-foreground">{expense.description}</p>
            <p className="text-xs text-muted-foreground">
              {formatDisplayDate(expense.date)}
            </p>
          </div>
          <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-violet-600 dark:text-violet-400">
            {formatCurrency(expense.amount)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function AllocationRow({
  allocation,
  index,
  expenses,
  expanded,
  onExpandedChange,
  nested = false,
  displayRemaining,
  sharedWalletDisplay,
}: {
  allocation: BudgetAllocationItem;
  index: number;
  expenses: ExpenseFeedItem[];
  expanded: boolean;
  onExpandedChange: (open: boolean) => void;
  nested?: boolean;
  displayRemaining?: number;
  sharedWalletDisplay?: SharedWalletCategoryDisplay;
}) {
  const spent = allocation.spent_amount ?? 0;
  const categoryRemaining = allocation.amount - spent;
  const shownRemaining = displayRemaining ?? categoryRemaining;
  const hasExpenses = expenses.length > 0;
  const shellClass = cn(
    'overflow-hidden',
    nested
      ? 'border-t border-border/60'
      : 'rounded-lg border border-border/60',
  );
  const summaryProps = nested
    ? { hideWalletName: true, disponibleLabel: 'disponible' as const }
    : {};

  if (!hasExpenses) {
    return (
      <article
        className={cn(shellClass, 'px-3 py-3')}
        aria-label={`Asignación ${allocation.category_name}`}
      >
        <AllocationSummary
          allocation={allocation}
          index={index}
          spent={spent}
          remaining={shownRemaining}
          expenseCount={0}
          expanded={false}
          sharedWalletDisplay={sharedWalletDisplay}
          {...summaryProps}
        />
        <p className="mt-3 border-t border-border/60 pt-2.5 text-xs text-muted-foreground">
          Sin transacciones en este periodo
        </p>
      </article>
    );
  }

  return (
    <Collapsible open={expanded} onOpenChange={onExpandedChange}>
      <article
        className={shellClass}
        aria-label={`Asignación ${allocation.category_name}`}
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full px-3 py-3 text-left transition-colors hover:bg-muted/40"
            aria-expanded={expanded}
            aria-label={
              expanded
                ? `Ocultar transacciones de ${allocation.category_name}`
                : `Ver ${expenses.length} transacciones de ${allocation.category_name}`
            }
          >
            <AllocationSummary
              allocation={allocation}
              index={index}
              spent={spent}
              remaining={shownRemaining}
              expenseCount={expenses.length}
              expanded={expanded}
              sharedWalletDisplay={sharedWalletDisplay}
              {...summaryProps}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <AllocationExpenseList
            expenses={expenses}
            categoryName={allocation.category_name}
          />
        </CollapsibleContent>
      </article>
    </Collapsible>
  );
}

function AllocationGroups({
  allocations,
  expensesByAllocationId,
  expandedAllocationIds,
  onExpandedChange,
}: {
  allocations: BudgetAllocationItem[];
  expensesByAllocationId: Map<number, ExpenseFeedItem[]>;
  expandedAllocationIds: Set<number>;
  onExpandedChange: (allocationId: number, open: boolean) => void;
}) {
  const groups = useMemo(
    () => groupAllocationsByWallet(allocations),
    [allocations],
  );

  return (
    <>
      {groups.map((group) => {
        if (group.kind === 'solo') {
          return (
            <AllocationRow
              key={group.allocation.id}
              allocation={group.allocation}
              index={group.globalIndex}
              expenses={expensesByAllocationId.get(group.allocation.id) ?? []}
              expanded={expandedAllocationIds.has(group.allocation.id)}
              onExpandedChange={(isOpen) =>
                onExpandedChange(group.allocation.id, isOpen)
              }
            />
          );
        }

        const categoryDisplays = computeSharedWalletCategoryDisplays(group.pool);

        return (
          <div
            key={group.pool.wallet_id}
            className="overflow-hidden rounded-lg border border-border/60"
          >
            <WalletPoolHeader pool={group.pool} />
            {group.items.map(({ allocation, globalIndex }) => (
              <AllocationRow
                key={allocation.id}
                allocation={allocation}
                index={globalIndex}
                expenses={expensesByAllocationId.get(allocation.id) ?? []}
                expanded={expandedAllocationIds.has(allocation.id)}
                onExpandedChange={(isOpen) =>
                  onExpandedChange(allocation.id, isOpen)
                }
                nested
                displayRemaining={
                  categoryDisplays.get(allocation.id)?.effectiveAvailable
                }
                sharedWalletDisplay={categoryDisplays.get(allocation.id)}
              />
            ))}
          </div>
        );
      })}
    </>
  );
}

export default function BudgetPeriodDetailDialog({
  open,
  onOpenChange,
  period,
  context: periodContext,
}: Props) {
  const [expenseGroups, setExpenseGroups] = useState<BudgetAllocationExpenseGroup[]>([]);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [expensesError, setExpensesError] = useState<string | null>(null);
  const [expandedAllocationIds, setExpandedAllocationIds] = useState<Set<number>>(
    () => new Set(),
  );

  useEffect(() => {
    if (!open || !period) {
      return;
    }

    setExpandedAllocationIds(new Set());

    let cancelled = false;
    setLoadingExpenses(true);
    setExpensesError(null);

    fetchBudgetPeriodExpenseGroups(period.period_id, periodContext)
      .then((groups) => {
        if (!cancelled) setExpenseGroups(groups);
      })
      .catch((err) => {
        if (!cancelled) {
          setExpenseGroups([]);
          setExpensesError(
            err instanceof Error ? err.message : 'Error al cargar transacciones',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingExpenses(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, period, periodContext]);

  const expensesByAllocationId = useMemo(() => {
    const map = new Map<number, BudgetAllocationExpenseGroup['expenses']>();
    for (const group of expenseGroups) {
      map.set(group.allocation_id, group.expenses);
    }
    return map;
  }, [expenseGroups]);

  if (!period) return null;

  const overspent = period.remaining_amount < 0;
  const usedPercent =
    period.allocated_amount > 0
      ? Math.round((period.spent_amount / period.allocated_amount) * 100)
      : 0;
  const frequencyLabel =
    BUDGET_FREQUENCY_LABELS[period.frequency as BudgetFrequency] ?? period.frequency;

  const handleExpandedChange = (allocationId: number, isOpen: boolean) => {
    setExpandedAllocationIds((prev) => {
      const next = new Set(prev);
      if (isOpen) next.add(allocationId);
      else next.delete(allocationId);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col gap-4 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="space-y-3 px-6 pt-6">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 dark:bg-sky-500/15">
              <BarChart3
                className="h-4 w-4 text-sky-600 dark:text-sky-400"
                aria-hidden
              />
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="flex flex-wrap items-center gap-2 text-base leading-tight">
                <span className="truncate">{period.name}</span>
                {overspent ? (
                  <Badge variant="destructive" className="shrink-0 text-[10px]">
                    Excedido
                  </Badge>
                ) : null}
                <Badge variant="secondary" className="shrink-0 text-[10px] font-normal">
                  {frequencyLabel}
                </Badge>
              </DialogTitle>
              <DialogDescription className="mt-1">
                {formatWallClockDateRange(period.start_date, period.end_date)}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <section
          className="shrink-0 space-y-3 px-6"
          aria-label="Resumen del periodo"
        >
          <div className="grid grid-cols-3 gap-2">
            <PeriodMetric label="Presupuesto" amount={period.allocated_amount} accent="neutral" />
            <PeriodMetric label="Gastado" amount={period.spent_amount} accent="spent" />
            <PeriodMetric
              label={overspent ? 'Excedido' : 'Disponible'}
              amount={
                overspent
                  ? Math.abs(period.remaining_amount)
                  : period.remaining_amount
              }
              accent="available"
              toneClass={remainingToneClass(
                period.remaining_amount,
                period.allocated_amount,
              )}
            />
          </div>

          <SpendProgressBar
            spent={period.spent_amount}
            total={period.allocated_amount}
            overspent={overspent}
            barClassName={overspent ? undefined : PERIOD_PROGRESS_CLASS}
            label={`${usedPercent}% del presupuesto usado`}
          />
        </section>

        <section
          className="flex min-h-0 flex-1 flex-col gap-2 border-t border-border/60 px-6 pb-6 pt-4"
          aria-labelledby="budget-period-allocations-heading"
        >
          <div className="flex items-baseline justify-between gap-2">
            <h3
              id="budget-period-allocations-heading"
              className="text-sm font-semibold text-foreground"
            >
              Asignaciones
            </h3>
            {!loadingExpenses && period.allocations.length > 0 ? (
              <span className="text-xs text-muted-foreground">
                {period.allocations.length}{' '}
                {period.allocations.length === 1 ? 'categoría' : 'categorías'}
              </span>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {loadingExpenses ? (
              <>
                {period.allocations.map((allocation) => (
                  <AllocationSkeleton key={allocation.id} />
                ))}
              </>
            ) : expensesError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" aria-hidden />
                <AlertDescription>{expensesError}</AlertDescription>
              </Alert>
            ) : period.allocations.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Este periodo no tiene asignaciones por categoría.
              </p>
            ) : (
              <AllocationGroups
                allocations={period.allocations}
                expensesByAllocationId={expensesByAllocationId}
                expandedAllocationIds={expandedAllocationIds}
                onExpandedChange={handleExpandedChange}
              />
            )}
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}
