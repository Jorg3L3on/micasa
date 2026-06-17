'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, BarChart3, ChevronDown, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { CategoryLabel } from '@/components/categories/CategoryLabel';
import { formatDisplayDate } from '@/lib/calendar-dates';
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
import type { BudgetAllocationItem } from '@/types/catalog';
import type { ExpenseFeedItem } from '@/types/expenses-feed';
import type { FinanceContextType } from '@/types/finance-context';

/** Minimal period shape needed to render the detail panel. */
export type BudgetPeriodDetailData = {
  period_id: number;
  name: string;
  frequency: string;
  start_date: string;
  end_date: string;
  allocated_amount: number;
  spent_amount: number;
  remaining_amount: number;
  allocations: BudgetAllocationItem[];
};

type Props = {
  period: BudgetPeriodDetailData;
  context: FinanceContextType;
  /** Whether the panel is currently shown and should load its expenses. */
  active?: boolean;
  /** Previously loaded expense groups for this period (session cache). */
  cachedGroups?: BudgetAllocationExpenseGroup[];
  /** Called when expenses finish loading so the parent can cache them. */
  onGroupsLoaded?: (periodId: number, groups: BudgetAllocationExpenseGroup[]) => void;
  className?: string;
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

const PERIOD_PROGRESS_CLASS = 'bg-sky-500 dark:bg-sky-400';
const WALLET_PROGRESS_CLASS = 'bg-blue-500 dark:bg-blue-400';

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
        'rounded-lg border border-border/60 bg-card px-3 py-2.5',
        accent === 'spent' && 'bg-violet-500/[0.04]',
        accent === 'available' && 'bg-emerald-500/[0.04]',
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
      <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
        {adjustmentNote}
      </p>
    </div>
  );
}

function AllocationSummary({
  allocation,
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
        <div
          className={cn(
            'flex items-center justify-between gap-2 text-xs text-muted-foreground',
            expanded && 'text-foreground',
          )}
        >
          <span>
            {expanded
              ? 'Ocultar transacciones'
              : `Ver ${expenseCount} ${expenseCount === 1 ? 'transacción' : 'transacciones'}`}
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 transition-transform duration-200 ease-out motion-reduce:transition-none',
              expanded && 'rotate-180',
            )}
            aria-hidden
          />
        </div>
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
  expenses,
  expanded,
  onExpandedChange,
  nested = false,
  displayRemaining,
  sharedWalletDisplay,
}: {
  allocation: BudgetAllocationItem;
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
            className="w-full px-3 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset motion-reduce:transition-none"
            aria-expanded={expanded}
            aria-label={
              expanded
                ? `Ocultar transacciones de ${allocation.category_name}`
                : `Ver ${expenses.length} transacciones de ${allocation.category_name}`
            }
          >
            <AllocationSummary
              allocation={allocation}
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
            {group.items.map(({ allocation }) => (
              <AllocationRow
                key={allocation.id}
                allocation={allocation}
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

export default function BudgetPeriodDetail({
  period,
  context,
  active = true,
  cachedGroups,
  onGroupsLoaded,
  className,
}: Props) {
  const [expenseGroups, setExpenseGroups] = useState<BudgetAllocationExpenseGroup[]>(
    () => cachedGroups ?? [],
  );
  const [loadingExpenses, setLoadingExpenses] = useState(!cachedGroups);
  const [expensesError, setExpensesError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [expandedAllocationIds, setExpandedAllocationIds] = useState<Set<number>>(
    () => new Set(),
  );

  useEffect(() => {
    if (!active) return;

    if (cachedGroups) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Sync cached groups when they become available.
      setExpenseGroups(cachedGroups);
      setLoadingExpenses(false);
      setExpensesError(null);
      return;
    }

    let cancelled = false;
    setLoadingExpenses(true);
    setExpensesError(null);

    fetchBudgetPeriodExpenseGroups(period.period_id, context)
      .then((groups) => {
        if (cancelled) return;
        setExpenseGroups(groups);
        onGroupsLoaded?.(period.period_id, groups);
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
  }, [
    active,
    cachedGroups,
    period.period_id,
    context,
    onGroupsLoaded,
    reloadKey,
  ]);

  const expensesByAllocationId = useMemo(() => {
    const map = new Map<number, BudgetAllocationExpenseGroup['expenses']>();
    for (const group of expenseGroups) {
      map.set(group.allocation_id, group.expenses);
    }
    return map;
  }, [expenseGroups]);

  const overspent = period.remaining_amount < 0;
  const usedPercent =
    period.allocated_amount > 0
      ? Math.round((period.spent_amount / period.allocated_amount) * 100)
      : 0;

  const handleExpandedChange = (allocationId: number, isOpen: boolean) => {
    setExpandedAllocationIds((prev) => {
      const next = new Set(prev);
      if (isOpen) next.add(allocationId);
      else next.delete(allocationId);
      return next;
    });
  };

  return (
    <div className={cn('space-y-4', className)}>
      <section className="space-y-3" aria-label="Resumen del periodo">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
        className="space-y-2 border-t border-border/60 pt-4"
        aria-labelledby={`budget-period-allocations-heading-${period.period_id}`}
      >
        <div className="flex items-baseline justify-between gap-2">
          <h3
            id={`budget-period-allocations-heading-${period.period_id}`}
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

        <div className="space-y-3">
          {loadingExpenses ? (
            <>
              {(period.allocations.length > 0
                ? period.allocations
                : Array.from({ length: 3 }, (_, index) => ({ id: -index - 1 }))
              ).map((allocation) => (
                <AllocationSkeleton key={allocation.id} />
              ))}
            </>
          ) : expensesError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" aria-hidden />
              <div className="min-w-0 flex-1">
                <AlertDescription>{expensesError}</AlertDescription>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 h-9 border-destructive/40 bg-background text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setReloadKey((current) => current + 1)}
                >
                  <RefreshCw className="h-4 w-4" aria-hidden />
                  Reintentar
                </Button>
              </div>
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
    </div>
  );
}
