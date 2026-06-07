'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import EmptyState from '@/components/EmptyState';
import { useFinanceContext } from '@/context/finance-context';
import { formatWallClockDateRange } from '@/lib/calendar-dates';
import { fetchActivePeriods, fetchBudgetHistory } from '@/lib/api/budgets';
import { formatCurrency, cn } from '@/lib/utils';
import type { BudgetPeriodItem, BudgetHistoryGroup } from '@/types/catalog';
import { BUDGET_FREQUENCY_LABELS, type BudgetFrequency } from '@/schemas/budget.schema';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

function ProgressBar({ spent, total }: { spent: number; total: number }) {
  const pct = total > 0 ? Math.min((spent / total) * 100, 100) : 0;
  const color =
    pct >= 75
      ? 'bg-destructive'
      : pct >= 50
        ? 'bg-orange-500'
        : pct >= 25
          ? 'bg-yellow-400'
          : 'bg-green-500';
  return (
    <div className="flex min-w-27.5 items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 text-right text-xs text-muted-foreground">{pct.toFixed(0)}%</span>
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
  onChange,
}: {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
}) {
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

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
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={prev}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-32.5 text-center text-sm font-medium">
        {MONTH_NAMES[month - 1]} {year}
      </span>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={next}
        disabled={isCurrentMonth}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function ActivePeriodsTab() {
  const { context } = useFinanceContext();
  const [periods, setPeriods] = useState<BudgetPeriodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Refresh loading state when owner context changes.
    setLoading(true);
    fetchActivePeriods(context)
      .then(setPeriods)
      .catch((err) => setError(err instanceof Error ? err.message : 'Error al cargar presupuestos'))
      .finally(() => setLoading(false));
  }, [context]);

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
        cell: ({ row }) => formatCurrency(row.original.allocated_amount),
      },
      {
        accessorKey: 'spent_amount',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Gastado" />,
        cell: ({ row }) => formatCurrency(row.original.spent_amount),
      },
      {
        accessorKey: 'remaining_amount',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Restante" />,
        cell: ({ row }) => {
          const r = row.original.remaining_amount;
          return (
            <span
              className={cn(
                'font-medium',
                r < 0 && 'text-destructive',
                r >= 0 && r < row.original.allocated_amount * 0.2 && 'text-amber-600 dark:text-amber-400',
                r >= row.original.allocated_amount * 0.2 && 'text-green-700 dark:text-green-400',
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
    ],
    [],
  );

  if (error) {
    return (
      <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Cargando…</div>
        ) : periods.length === 0 ? (
          <EmptyState message="No hay presupuestos activos hoy. Crea plantillas en Catálogos → Plantillas de presupuestos." />
        ) : (
          <DataTable
            data={periods}
            columns={columns}
            filterColumn="name"
            filterPlaceholder="Filtrar por nombre…"
            emptyMessage="No se encontraron presupuestos activos."
          />
        )}
      </CardContent>
    </Card>
  );
}

function HistoryTab() {
  const { context } = useFinanceContext();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [groups, setGroups] = useState<BudgetHistoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchBudgetHistory(year, month, context)
      .then(setGroups)
      .catch((err) => setError(err instanceof Error ? err.message : 'Error al cargar historial'))
      .finally(() => setLoading(false));
  }, [year, month, context]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load() owns this tab's async loading state.
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <MonthPicker year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
      </div>

      {error && (
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>
      )}

      {loading ? (
        <div className="py-8 text-center text-muted-foreground">Cargando…</div>
      ) : groups.length === 0 ? (
        <EmptyState message={`No hay historial para ${MONTH_NAMES[month - 1]} ${year}.`} />
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <Card key={group.budget_id}>
              <CardContent className="pt-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="font-semibold">{group.name}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {BUDGET_FREQUENCY_LABELS[group.frequency as BudgetFrequency] ?? group.frequency}
                  </span>
                </div>
                <div className="divide-y divide-border rounded-lg border">
                  {group.periods.map((period) => {
                    return (
                      <div
                        key={period.period_id}
                        className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 px-4 py-3 text-sm"
                      >
                        <span className="text-muted-foreground">
                          {formatWallClockDateRange(period.start_date, period.end_date)}
                        </span>
                        <span>{formatCurrency(period.allocated_amount)}</span>
                        <span className="text-muted-foreground">{formatCurrency(period.spent_amount)}</span>
                        <span
                          className={cn(
                            'font-medium',
                            period.remaining_amount < 0 && 'text-destructive',
                            period.remaining_amount >= 0 && 'text-green-700 dark:text-green-400',
                          )}
                        >
                          {formatCurrency(period.remaining_amount)}
                        </span>
                        <ProgressBar spent={period.spent_amount} total={period.allocated_amount} />
                      </div>
                    );
                  })}
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
    <Tabs defaultValue="activos">
      <div className="sticky top-16 z-20 mb-4 flex items-center justify-between border-b border-border/60 bg-background py-2 shadow-sm group-has-data-[collapsible=icon]/sidebar-wrapper:top-12">
        <TabsList>
          <TabsTrigger value="activos">Activos</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
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
