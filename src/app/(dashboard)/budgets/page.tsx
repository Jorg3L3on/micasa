'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import EmptyState from '@/components/EmptyState';
import BudgetPeriodDetail from '@/components/BudgetPeriodDetail';
import { useFinanceContext } from '@/context/finance-context';
import { formatWallClockDateRange } from '@/lib/calendar-dates';
import { useHydrationSafeTodayYmd } from '@/hooks/use-hydration-safe-today-ymd';
import {
  fetchActivePeriods,
  fetchBudgetHistory,
  type BudgetAllocationExpenseGroup,
} from '@/lib/api/budgets';
import { formatCurrency, cn } from '@/lib/utils';
import type { BudgetPeriodItem, BudgetHistoryGroup } from '@/types/catalog';
import { BUDGET_FREQUENCY_LABELS, type BudgetFrequency } from '@/schemas/budget.schema';
import { AlertCircle, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

/** Reveal transition for an inline detail panel; respects reduced motion. */
const DETAIL_REVEAL_CLASS =
  'animate-in fade-in-0 slide-in-from-top-1 duration-200 ease-out motion-reduce:animate-none';

/** Shared column template so the history header and every period row line up.
 *  All non-`1fr` tracks are fixed so independent row grids align with the header. */
const HISTORY_GRID =
  'grid grid-cols-[minmax(0,1fr)_7rem_7rem_7rem_11rem_6rem] items-center gap-4';

/** Lazy session cache for budget-period expense groups (shared per tab). */
function useExpenseGroupCache() {
  const cacheRef = useRef(new Map<number, BudgetAllocationExpenseGroup[]>());
  const store = useCallback((periodId: number, groups: BudgetAllocationExpenseGroup[]) => {
    cacheRef.current.set(periodId, groups);
  }, []);
  const read = useCallback(
    (periodId: number) => cacheRef.current.get(periodId),
    [],
  );
  return { store, read };
}

function ProgressBar({ spent, total }: { spent: number; total: number }) {
  const displayPct = total > 0 ? Math.round((spent / total) * 100) : 0;
  const fillPct = Math.min(displayPct, 100);
  const overBudget = total > 0 && spent > total;
  const color =
    overBudget || displayPct >= 100
      ? 'bg-destructive'
      : displayPct >= 75
        ? 'bg-orange-500 dark:bg-orange-400'
        : displayPct >= 50
          ? 'bg-amber-400 dark:bg-amber-500'
          : 'bg-emerald-500 dark:bg-emerald-400';
  return (
    <div className="flex min-w-28 items-center gap-2">
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-muted/50"
        role="progressbar"
        aria-label={`${displayPct}% del presupuesto usado`}
        aria-valuenow={fillPct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none',
            color,
          )}
          style={{ width: `${fillPct}%` }}
        />
      </div>
      <span
        className={cn(
          'w-9 text-right text-xs tabular-nums text-muted-foreground',
          overBudget && 'font-medium text-destructive',
        )}
      >
        {displayPct}%
      </span>
    </div>
  );
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function MonthPicker({
  year,
  month,
  currentYear,
  currentMonth,
  onChange,
}: {
  year: number;
  month: number;
  currentYear: number;
  currentMonth: number;
  onChange: (year: number, month: number) => void;
}) {
  const isCurrentMonth = year === currentYear && month === currentMonth;

  const prev = () => {
    if (month === 1) onChange(year - 1, 12);
    else onChange(year, month - 1);
  };
  const next = () => {
    if (isCurrentMonth) return;
    if (month === 12) onChange(year + 1, 1);
    else onChange(year, month + 1);
  };

  return (
    <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
      <Button
        variant="outline"
        size="icon"
        className="size-11 sm:size-8"
        onClick={prev}
        aria-label="Mes anterior"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </Button>
      <span className="min-w-32 text-center text-sm font-medium tabular-nums" aria-live="polite">
        {MONTH_NAMES[month - 1]} {year}
      </span>
      <Button
        variant="outline"
        size="icon"
        className="size-11 sm:size-8"
        onClick={next}
        disabled={isCurrentMonth}
        aria-label="Mes siguiente"
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  );
}

function LoadError({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" aria-hidden />
      <div className="min-w-0 flex-1">
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 h-9 border-destructive/40 bg-background text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={onRetry}
        >
          Reintentar
        </Button>
      </div>
    </Alert>
  );
}

type PeriodSummaryProps = {
  period: BudgetPeriodItem | BudgetHistoryGroup['periods'][number];
  context: ReturnType<typeof useFinanceContext>['context'];
  expanded: boolean;
  onToggle: () => void;
  expenseCache: ReturnType<typeof useExpenseGroupCache>;
  showName?: boolean;
};

function PeriodSummary({
  period,
  context,
  expanded,
  onToggle,
  expenseCache,
  showName = true,
}: PeriodSummaryProps) {
  const remainingLabel = period.remaining_amount < 0 ? 'Excedido' : 'Restante';
  const frequencyLabel =
    BUDGET_FREQUENCY_LABELS[period.frequency as BudgetFrequency] ??
    period.frequency;

  return (
    <article>
      <div className="space-y-4 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {showName ? (
              <h3 className="truncate text-sm font-semibold text-foreground">
                {period.name}
              </h3>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {formatWallClockDateRange(period.start_date, period.end_date)}
            </p>
          </div>
          <Badge variant="secondary" className="shrink-0 font-normal">
            {frequencyLabel}
          </Badge>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Presupuesto</dt>
            <dd className="mt-0.5 font-mono font-semibold tabular-nums">
              {formatCurrency(period.allocated_amount)}
            </dd>
          </div>
          <div className="text-right">
            <dt className="text-xs text-muted-foreground">Gastado</dt>
            <dd className="mt-0.5 font-mono font-semibold tabular-nums">
              {formatCurrency(period.spent_amount)}
            </dd>
          </div>
          <div className="col-span-2">
            <div className="flex items-end justify-between gap-3">
              <div>
                <dt className="text-xs text-muted-foreground">{remainingLabel}</dt>
                <dd
                  className={cn(
                    'mt-0.5 font-mono font-semibold tabular-nums',
                    period.remaining_amount < 0
                      ? 'text-destructive'
                      : 'text-emerald-600 dark:text-emerald-400',
                  )}
                >
                  {formatCurrency(Math.abs(period.remaining_amount))}
                </dd>
              </div>
              <ProgressBar
                spent={period.spent_amount}
                total={period.allocated_amount}
              />
            </div>
          </div>
        </dl>

        <Button
          type="button"
          variant="outline"
          className="h-11 w-full justify-between sm:h-9"
          onClick={onToggle}
          aria-expanded={expanded}
        >
          {expanded ? 'Ocultar detalle' : 'Ver detalle'}
          <ChevronDown
            className={cn(
              'h-4 w-4 transition-transform duration-200 ease-out motion-reduce:transition-none',
              expanded && 'rotate-180',
            )}
            aria-hidden
          />
        </Button>
      </div>

      {expanded ? (
        <div className={cn('border-t border-border/60 bg-muted/20 p-4', DETAIL_REVEAL_CLASS)}>
          <BudgetPeriodDetail
            period={period}
            context={context}
            cachedGroups={expenseCache.read(period.period_id)}
            onGroupsLoaded={expenseCache.store}
          />
        </div>
      ) : null}
    </article>
  );
}

function TableLoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Cargando presupuestos">
      <Skeleton className="h-9 w-full max-w-xs" />
      <div className="overflow-hidden rounded-lg border">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border/60 px-4 py-3.5 last:border-b-0"
          >
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-2 w-28 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivePeriodsTab() {
  const { context } = useFinanceContext();
  const [periods, setPeriods] = useState<BudgetPeriodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPeriodId, setExpandedPeriodId] = useState<number | null>(null);
  const expenseCache = useExpenseGroupCache();

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchActivePeriods(context)
      .then(setPeriods)
      .catch((err) => setError(err instanceof Error ? err.message : 'Error al cargar presupuestos'))
      .finally(() => setLoading(false));
  }, [context]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load() owns this tab's async loading state.
    load();
  }, [load]);

  const columns = useMemo<ColumnDef<BudgetPeriodItem>[]>(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" />,
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: 'frequency',
        header: 'Frecuencia',
        cell: ({ row }) =>
          BUDGET_FREQUENCY_LABELS[row.original.frequency as BudgetFrequency] ?? row.original.frequency,
      },
      {
        id: 'period',
        header: 'Período',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatWallClockDateRange(row.original.start_date, row.original.end_date)}
          </span>
        ),
      },
      {
        accessorKey: 'allocated_amount',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Total" />,
        cell: ({ row }) => (
          <span className="font-mono tabular-nums">
            {formatCurrency(row.original.allocated_amount)}
          </span>
        ),
      },
      {
        accessorKey: 'spent_amount',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Gastado" />,
        cell: ({ row }) => (
          <span className="font-mono tabular-nums text-muted-foreground">
            {formatCurrency(row.original.spent_amount)}
          </span>
        ),
      },
      {
        accessorKey: 'remaining_amount',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Restante" />,
        cell: ({ row }) => {
          const r = row.original.remaining_amount;
          return (
            <span
              className={cn(
                'font-mono font-medium tabular-nums',
                r < 0 && 'text-destructive',
                r >= 0 && r < row.original.allocated_amount * 0.2 && 'text-amber-600 dark:text-amber-400',
                r >= row.original.allocated_amount * 0.2 && 'text-emerald-600 dark:text-emerald-400',
              )}
            >
              {formatCurrency(r)}
            </span>
          );
        },
      },
      {
        id: 'progress',
        header: 'Progreso',
        cell: ({ row }) => (
          <ProgressBar spent={row.original.spent_amount} total={row.original.allocated_amount} />
        ),
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Acciones</span>,
        enableHiding: false,
        cell: ({ row }) => {
          const expanded = row.getIsExpanded();
          return (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1"
              onClick={() => row.toggleExpanded()}
              aria-expanded={expanded}
              aria-label={
                expanded
                  ? `Ocultar detalle de ${row.original.name}`
                  : `Ver detalle de ${row.original.name}`
              }
            >
              Detalle
              <ChevronDown
                className={cn(
                  'h-3.5 w-3.5 transition-transform duration-200 ease-out motion-reduce:transition-none',
                  expanded && 'rotate-180',
                )}
              />
            </Button>
          );
        },
      },
    ],
    [],
  );

  if (error) {
    return (
      <LoadError
        title="No se pudieron cargar los presupuestos"
        message={error}
        onRetry={load}
      />
    );
  }

  return (
    <Card className="gap-0 py-0">
      <CardContent className="p-0">
        {loading ? (
          <div className="p-4 sm:p-6">
            <TableLoadingSkeleton />
          </div>
        ) : periods.length === 0 ? (
          <EmptyState
            message="No hay presupuestos activos hoy."
            description="Crea una plantilla para empezar a planear tus próximos periodos."
            action={{
              label: 'Crear plantilla',
              href: '/budget-templates',
              variant: 'outline',
            }}
          />
        ) : (
          <>
            <div className="divide-y divide-border/60 md:hidden">
              {periods.map((period) => (
                <PeriodSummary
                  key={period.period_id}
                  period={period}
                  context={context}
                  expanded={expandedPeriodId === period.period_id}
                  onToggle={() =>
                    setExpandedPeriodId((current) =>
                      current === period.period_id ? null : period.period_id,
                    )
                  }
                  expenseCache={expenseCache}
                />
              ))}
            </div>
            <div className="hidden p-6 md:block">
              <DataTable
                data={periods}
                columns={columns}
                filterColumn="name"
                filterPlaceholder="Filtrar por nombre…"
                emptyMessage="No se encontraron presupuestos activos."
                renderExpandedRow={(period) => (
                  <div className={cn('px-4 py-4', DETAIL_REVEAL_CLASS)}>
                    <BudgetPeriodDetail
                      period={period}
                      context={context}
                      cachedGroups={expenseCache.read(period.period_id)}
                      onGroupsLoaded={expenseCache.store}
                    />
                  </div>
                )}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function HistoryLoadingSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Cargando historial">
      {Array.from({ length: 2 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="pt-4">
            <Skeleton className="mb-3 h-5 w-40" />
            <div className="space-y-3 rounded-lg border p-4">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="flex items-center gap-4">
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-2 w-28 rounded-full" />
                  <Skeleton className="h-8 w-20 rounded-md" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function HistoryTab() {
  const { context } = useFinanceContext();
  const todayYmd = useHydrationSafeTodayYmd();
  const calendarReady = todayYmd !== '1970-01-01';
  const currentYear = Number(todayYmd.slice(0, 4));
  const currentMonth = Number(todayYmd.slice(5, 7));
  const [selectedMonth, setSelectedMonth] = useState<{
    year: number;
    month: number;
  } | null>(null);
  const year = selectedMonth?.year ?? currentYear;
  const month = selectedMonth?.month ?? currentMonth;
  const [groups, setGroups] = useState<BudgetHistoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPeriodId, setExpandedPeriodId] = useState<number | null>(null);
  const expenseCache = useExpenseGroupCache();

  const load = useCallback(() => {
    if (!calendarReady) return;
    setLoading(true);
    setError(null);
    fetchBudgetHistory(year, month, context)
      .then(setGroups)
      .catch((err) => setError(err instanceof Error ? err.message : 'Error al cargar historial'))
      .finally(() => setLoading(false));
  }, [calendarReady, year, month, context]);

  useEffect(() => {
    if (!calendarReady) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load() owns this tab's async loading state.
    load();
  }, [calendarReady, load]);

  if (!calendarReady) {
    return <HistoryLoadingSkeleton />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-3 shadow-sm sm:w-fit">
        <MonthPicker
          year={year}
          month={month}
          currentYear={currentYear}
          currentMonth={currentMonth}
          onChange={(nextYear, nextMonth) => {
            setExpandedPeriodId(null);
            setSelectedMonth({ year: nextYear, month: nextMonth });
          }}
        />
      </div>

      {error ? (
        <LoadError
          title="No se pudo cargar el historial"
          message={error}
          onRetry={load}
        />
      ) : null}

      {loading && !error ? (
        <HistoryLoadingSkeleton />
      ) : !error && groups.length === 0 ? (
        <Card className="gap-0 py-0">
          <EmptyState
            message={`No hay historial para ${MONTH_NAMES[month - 1]} ${year}.`}
            description="Prueba otro mes o crea una plantilla para generar nuevos periodos."
          />
        </Card>
      ) : (
        <div className={cn('space-y-4', error && 'hidden')}>
          {groups.map((group) => (
            <Card key={group.budget_id} className="gap-0 py-0">
              <CardContent className="p-0">
                <div className="flex items-center gap-2 px-4 py-4 sm:px-6">
                  <h3 className="min-w-0 truncate font-semibold">{group.name}</h3>
                  <Badge variant="secondary" className="shrink-0 font-normal">
                    {BUDGET_FREQUENCY_LABELS[group.frequency as BudgetFrequency] ?? group.frequency}
                  </Badge>
                </div>

                <div className="divide-y divide-border/60 border-t border-border/60 md:hidden">
                  {group.periods.map((period) => (
                    <PeriodSummary
                      key={period.period_id}
                      period={period}
                      context={context}
                      expanded={expandedPeriodId === period.period_id}
                      onToggle={() =>
                        setExpandedPeriodId((current) =>
                          current === period.period_id ? null : period.period_id,
                        )
                      }
                      expenseCache={expenseCache}
                      showName={false}
                    />
                  ))}
                </div>

                <div className="hidden overflow-x-auto border-t border-border/60 md:block">
                  <div className="min-w-[44rem] divide-y divide-border">
                    <div
                      className={cn(
                        HISTORY_GRID,
                        'bg-muted/30 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground',
                      )}
                    >
                      <span>Período</span>
                      <span className="text-right">Total</span>
                      <span className="text-right">Gastado</span>
                      <span className="text-right">Restante</span>
                      <span>Progreso</span>
                      <span className="sr-only">Acciones</span>
                    </div>
                    {group.periods.map((period) => {
                      const expanded = expandedPeriodId === period.period_id;
                      return (
                        <div key={period.period_id}>
                          <div className={cn(HISTORY_GRID, 'px-4 py-3 text-sm')}>
                            <span className="truncate text-muted-foreground">
                              {formatWallClockDateRange(period.start_date, period.end_date)}
                            </span>
                            <span className="text-right font-mono tabular-nums">
                              {formatCurrency(period.allocated_amount)}
                            </span>
                            <span className="text-right font-mono tabular-nums text-muted-foreground">
                              {formatCurrency(period.spent_amount)}
                            </span>
                            <span
                              className={cn(
                                'text-right font-mono font-medium tabular-nums',
                                period.remaining_amount < 0 && 'text-destructive',
                                period.remaining_amount >= 0 &&
                                  'text-emerald-600 dark:text-emerald-400',
                              )}
                            >
                              {formatCurrency(period.remaining_amount)}
                            </span>
                            <ProgressBar spent={period.spent_amount} total={period.allocated_amount} />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1"
                              onClick={() =>
                                setExpandedPeriodId((prev) =>
                                  prev === period.period_id ? null : period.period_id,
                                )
                              }
                              aria-expanded={expanded}
                              aria-label={
                                expanded
                                  ? `Ocultar detalle de ${period.name}`
                                  : `Ver detalle de ${period.name}`
                              }
                            >
                              Detalle
                              <ChevronDown
                                className={cn(
                                  'h-3.5 w-3.5 transition-transform duration-200 ease-out motion-reduce:transition-none',
                                  expanded && 'rotate-180',
                                )}
                              />
                            </Button>
                          </div>
                          {expanded ? (
                            <div className={cn('bg-muted/20 px-4 py-4', DETAIL_REVEAL_CLASS)}>
                              <BudgetPeriodDetail
                                period={period}
                                context={context}
                                cachedGroups={expenseCache.read(period.period_id)}
                                onGroupsLoaded={expenseCache.store}
                              />
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BudgetsPage() {
  return (
    <Tabs defaultValue="activos" className="gap-4">
      <div className="sticky top-16 z-20 flex flex-col gap-3 border-b border-border/60 bg-background py-2 shadow-sm sm:flex-row sm:items-center sm:justify-between group-has-data-[collapsible=icon]/sidebar-wrapper:top-12">
        <div>
          <h2 className="text-lg font-semibold leading-tight">Presupuestos</h2>
          <p className="text-xs text-muted-foreground">
            Revisa el gasto de cada periodo y sus asignaciones.
          </p>
        </div>
        <TabsList className="h-11 w-full sm:h-9 sm:w-auto" aria-label="Vistas de presupuestos">
          <TabsTrigger value="activos" className="min-h-10 sm:min-h-0">
            Activos
          </TabsTrigger>
          <TabsTrigger value="historial" className="min-h-10 sm:min-h-0">
            Historial
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="activos">
        <ActivePeriodsTab />
      </TabsContent>

      <TabsContent value="historial">
        <HistoryTab />
      </TabsContent>
    </Tabs>
  );
}
