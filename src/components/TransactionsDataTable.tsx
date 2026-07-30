'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import {
  CategoryLabel,
  formatCategoryLabel,
} from '@/components/categories/CategoryLabel';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate, formatCurrencySigned, formatCurrency, cn } from '@/lib/utils';
import type { TransactionRow } from '@/types/catalog';
import {
  ArrowDownRight,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Receipt,
  DollarSign,
  Wallet,
  X,
} from 'lucide-react';
import { DASHBOARD_METRIC_STRIP_CLASS } from '@/components/dashboard/constants';

const ALL_VALUE = '__all__';

function TransactionsEmpty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Receipt className="size-7" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="text-base font-medium text-balance">{title}</p>
        <p className="text-sm text-muted-foreground text-pretty">{description}</p>
      </div>
    </div>
  );
}

type TransactionsDataTableProps = {
  transactions: TransactionRow[];
};

export default function TransactionsDataTable({
  transactions,
}: TransactionsDataTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const month = searchParams.get('month') || '';
  const year = searchParams.get('year') || '';
  const period = searchParams.get('period') || '';
  const type = searchParams.get('type') || '';
  const categoryFromQuery = searchParams.get('category') || ALL_VALUE;
  const paymentFromQuery = searchParams.get('paymentMethod') || ALL_VALUE;

  const [categoryFilter, setCategoryFilter] = useState(categoryFromQuery);
  const [paymentMethodFilter, setPaymentMethodFilter] = useState(paymentFromQuery);

  useEffect(() => {
    setCategoryFilter(categoryFromQuery);
    setPaymentMethodFilter(paymentFromQuery);
  }, [categoryFromQuery, paymentFromQuery]);

  const currentYear = new Date().getFullYear();

  const categories = useMemo(
    () =>
      [...new Set(transactions.map((t) => t.category).filter(Boolean))].sort(),
    [transactions],
  );
  const categoryIcons = useMemo(() => {
    const icons = new Map<string, string | null>();
    for (const transaction of transactions) {
      if (transaction.category && !icons.has(transaction.category)) {
        icons.set(transaction.category, transaction.categoryIcon ?? null);
      }
    }
    return icons;
  }, [transactions]);

  const paymentMethods = useMemo(
    () =>
      [...new Set(transactions.map((t) => t.paymentMethod).filter(Boolean))].sort(),
    [transactions],
  );

  const filteredTransactions = useMemo(() => {
    let result = transactions;
    if (categoryFilter !== ALL_VALUE) {
      result = result.filter((t) => t.category === categoryFilter);
    }
    if (paymentMethodFilter !== ALL_VALUE) {
      result = result.filter((t) => t.paymentMethod === paymentMethodFilter);
    }
    return result;
  }, [transactions, categoryFilter, paymentMethodFilter]);

  const summary = useMemo(() => {
    const incomeTotal = filteredTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const expenseTotal = filteredTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    return {
      income: incomeTotal,
      expenses: expenseTotal,
      net: incomeTotal - expenseTotal,
      count: filteredTransactions.length,
    };
  }, [filteredTransactions]);

  const handleServerFilter = useCallback(
    (field: string, value: string) => {
      const newParams = new URLSearchParams(searchParams.toString());
      if (value && value !== ALL_VALUE) {
        newParams.set(field, value);
      } else {
        newParams.delete(field);
      }
      router.replace(
        `/transactions${newParams.toString() ? `?${newParams.toString()}` : ''}`,
        { scroll: false },
      );
    },
    [router, searchParams],
  );

  const handleClientFilter = useCallback(
    (field: 'category' | 'paymentMethod', value: string) => {
      const newParams = new URLSearchParams(searchParams.toString());
      if (value && value !== ALL_VALUE) newParams.set(field, value);
      else newParams.delete(field);
      router.replace(
        `/transactions${newParams.toString() ? `?${newParams.toString()}` : ''}`,
        { scroll: false },
      );
      if (field === 'category') setCategoryFilter(value);
      else setPaymentMethodFilter(value);
    },
    [router, searchParams],
  );

  const hasActiveFilters =
    month || year || period || type || categoryFilter !== ALL_VALUE || paymentMethodFilter !== ALL_VALUE;

  const handleClearAllFilters = useCallback(() => {
    setCategoryFilter(ALL_VALUE);
    setPaymentMethodFilter(ALL_VALUE);
    const newParams = new URLSearchParams(searchParams.toString());
    ['month', 'year', 'period', 'type', 'category', 'paymentMethod'].forEach((key) =>
      newParams.delete(key),
    );
    router.replace(
      `/transactions${newParams.toString() ? `?${newParams.toString()}` : ''}`,
      { scroll: false },
    );
  }, [router, searchParams]);

  const columns = useMemo<ColumnDef<TransactionRow>[]>(
    () => [
      {
        accessorKey: 'date',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Fecha" />
        ),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm">
            {formatDate(row.original.date)}
          </span>
        ),
      },
      {
        accessorKey: 'description',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Descripción" />
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-md shrink-0',
                row.original.type === 'expense'
                  ? 'bg-violet-500/10 dark:bg-violet-500/15'
                  : 'bg-blue-500/10 dark:bg-blue-500/15',
              )}
            >
              {row.original.type === 'expense' ? (
                <ArrowDownRight className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
              ) : (
                <ArrowUpRight className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              )}
            </span>
            <span className="font-medium truncate">
              {row.original.description}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'amount',
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Monto"
            className="text-right"
          />
        ),
        cell: ({ row }) => {
          const t = row.original;
          return (
            <span
              className={cn(
                'font-mono tabular-nums font-medium text-right block',
                t.type === 'expense'
                  ? 'text-destructive'
                  : 'text-emerald-600 dark:text-emerald-400',
              )}
            >
              {formatCurrencySigned(
                t.amount,
                t.type === 'income' ? 'income' : 'expense',
              )}
            </span>
          );
        },
      },
      {
        accessorKey: 'category',
        header: 'Categoría',
        cell: ({ row }) => {
          if (!row.original.category) return null;
          return (
            <Badge variant="outline" className="font-normal whitespace-nowrap">
              <CategoryLabel
                name={row.original.category}
                icon={row.original.categoryIcon}
              />
            </Badge>
          );
        },
      },
      {
        accessorKey: 'paymentMethod',
        header: 'Método de pago',
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm whitespace-nowrap flex items-center gap-1.5">
            <Wallet className="h-3.5 w-3.5" />
            {row.original.paymentMethod}
          </span>
        ),
      },
      {
        accessorKey: 'type',
        header: 'Tipo',
        cell: ({ row }) => {
          const isExpense = row.original.type === 'expense';
          return (
            <Badge
              variant={isExpense ? 'destructive' : 'default'}
              className={cn(
                'whitespace-nowrap',
                !isExpense &&
                  'bg-emerald-500/10 text-emerald-700 border-emerald-200/60 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/20 hover:bg-emerald-500/20',
              )}
            >
              {isExpense ? 'Gasto' : 'Ingreso'}
            </Badge>
          );
        },
      },
    ],
    [],
  );

  const filterSlot = (
    <>
      <Select
        value={month || ALL_VALUE}
        onValueChange={(v) => handleServerFilter('month', v)}
      >
        <SelectTrigger className="w-[140px]" size="sm" aria-label="Filtrar por mes">
          <SelectValue placeholder="Mes" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>Todos los meses</SelectItem>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <SelectItem key={m} value={String(m)}>
              {new Date(2000, m - 1).toLocaleString('es-MX', { month: 'long' })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={year || ALL_VALUE}
        onValueChange={(v) => handleServerFilter('year', v)}
      >
        <SelectTrigger className="w-[100px]" size="sm" aria-label="Filtrar por año">
          <SelectValue placeholder="Año" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>Todos</SelectItem>
          {Array.from({ length: 5 }, (_, i) => currentYear - 2 + i).map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {month && year && (
        <Select
          value={period || ALL_VALUE}
          onValueChange={(v) => handleServerFilter('period', v)}
        >
          <SelectTrigger className="w-[160px]" size="sm" aria-label="Filtrar por quincena">
            <SelectValue placeholder="Quincena" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Ambas quincenas</SelectItem>
            <SelectItem value="FIRST">Primera quincena</SelectItem>
            <SelectItem value="SECOND">Segunda quincena</SelectItem>
          </SelectContent>
        </Select>
      )}

      <Select
        value={type || ALL_VALUE}
        onValueChange={(v) => handleServerFilter('type', v)}
      >
        <SelectTrigger className="w-[120px]" size="sm" aria-label="Filtrar por tipo">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>Todos</SelectItem>
          <SelectItem value="income">Ingreso</SelectItem>
          <SelectItem value="expense">Gasto</SelectItem>
        </SelectContent>
      </Select>

      {categories.length > 0 && (
        <Select value={categoryFilter} onValueChange={(value) => handleClientFilter('category', value)}>
          <SelectTrigger className="w-[150px]" size="sm" aria-label="Filtrar por categoría">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Todas las categorías</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {formatCategoryLabel(cat, categoryIcons.get(cat))}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {paymentMethods.length > 0 && (
        <Select value={paymentMethodFilter} onValueChange={(value) => handleClientFilter('paymentMethod', value)}>
          <SelectTrigger className="w-[160px]" size="sm" aria-label="Filtrar por método de pago">
            <SelectValue placeholder="Método de pago" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Todos los métodos</SelectItem>
            {paymentMethods.map((pm) => (
              <SelectItem key={pm} value={pm}>
                {pm}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearAllFilters}
          className="h-8 px-2 text-muted-foreground hover:text-foreground"
          aria-label="Limpiar todos los filtros"
        >
          <X className="h-4 w-4 mr-1" />
          Limpiar
        </Button>
      )}
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <header className="min-w-0">
          <h2 className="mb-0.5 text-base font-medium leading-tight">
            Transacciones
          </h2>
          <p className="text-sm text-muted-foreground">
            Ingresos y gastos pagados en tu contexto actual.
          </p>
        </header>
      </div>

      {transactions.length > 0 ? (
        <div
          className="grid grid-cols-2 gap-4 lg:grid-cols-4"
          role="region"
          aria-label="Resumen de transacciones"
        >
          <div
            className={cn(
              DASHBOARD_METRIC_STRIP_CLASS,
              'border-l-[3px] border-l-blue-500/50 px-3 py-3',
            )}
          >
            <div className="mb-1 flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-muted">
                <TrendingUp className="h-3 w-3 text-muted-foreground" aria-hidden />
              </span>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Ingresos
              </p>
            </div>
            <p className="font-mono text-lg font-bold tabular-nums text-foreground">
              {formatCurrency(summary.income)}
            </p>
          </div>

          <div
            className={cn(
              DASHBOARD_METRIC_STRIP_CLASS,
              'border-l-[3px] border-l-violet-500/50 px-3 py-3',
            )}
          >
            <div className="mb-1 flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-muted">
                <TrendingDown
                  className="h-3 w-3 text-muted-foreground"
                  aria-hidden
                />
              </span>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Gastos
              </p>
            </div>
            <p className="font-mono text-lg font-bold tabular-nums text-foreground">
              {formatCurrency(summary.expenses)}
            </p>
          </div>

          <div
            className={cn(
              DASHBOARD_METRIC_STRIP_CLASS,
              'border-l-[3px] px-3 py-3',
              summary.net >= 0
                ? 'border-l-emerald-500/50'
                : 'border-l-destructive/50',
            )}
          >
            <div className="mb-1 flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-muted">
                <DollarSign
                  className="h-3 w-3 text-muted-foreground"
                  aria-hidden
                />
              </span>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Balance
              </p>
            </div>
            <p className="font-mono text-lg font-bold tabular-nums text-foreground">
              {formatCurrency(summary.net)}
            </p>
          </div>

          <div
            className={cn(
              DASHBOARD_METRIC_STRIP_CLASS,
              'border-l-[3px] border-l-amber-500/50 px-3 py-3',
            )}
          >
            <div className="mb-1 flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-muted">
                <Receipt className="h-3 w-3 text-muted-foreground" aria-hidden />
              </span>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Transacciones
              </p>
            </div>
            <p className="font-mono text-lg font-bold tabular-nums text-foreground">
              {summary.count}
            </p>
          </div>
        </div>
      ) : null}

      <Card className="overflow-hidden border-border/60">
        <CardContent className="py-4">
          <DataTable
            data={filteredTransactions}
            columns={columns}
            filterColumn="description"
            filterPlaceholder="Buscar por descripción..."
            emptyMessage={
              <TransactionsEmpty
                title={
                  hasActiveFilters
                    ? 'No hay coincidencias'
                    : 'Aún no hay transacciones'
                }
                description={
                  hasActiveFilters
                    ? 'Prueba otros filtros.'
                    : 'Registra gastos o ingresos para verlos aquí.'
                }
              />
            }
            filterSlot={filterSlot}
            columnVisibility
          />
        </CardContent>
      </Card>
    </div>
  );
}
