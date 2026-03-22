'use client';

import { useMemo, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
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
  Wallet,
  Receipt,
  DollarSign,
  X,
} from 'lucide-react';

const ALL_VALUE = '__all__';

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

  const [categoryFilter, setCategoryFilter] = useState(ALL_VALUE);
  const [paymentMethodFilter, setPaymentMethodFilter] = useState(ALL_VALUE);

  const currentYear = new Date().getFullYear();

  const categories = useMemo(
    () =>
      [...new Set(transactions.map((t) => t.category).filter(Boolean))].sort(),
    [transactions],
  );

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
    const incomeTotal = transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const expenseTotal = transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    return {
      income: incomeTotal,
      expenses: expenseTotal,
      net: incomeTotal - expenseTotal,
      count: transactions.length,
    };
  }, [transactions]);

  const handleServerFilter = useCallback(
    (field: string, value: string) => {
      const newParams = new URLSearchParams(searchParams.toString());
      if (value && value !== ALL_VALUE) {
        newParams.set(field, value);
      } else {
        newParams.delete(field);
      }
      router.push(
        `/transactions${newParams.toString() ? `?${newParams.toString()}` : ''}`,
      );
    },
    [router, searchParams],
  );

  const hasActiveFilters =
    month || year || period || type || categoryFilter !== ALL_VALUE || paymentMethodFilter !== ALL_VALUE;

  const handleClearAllFilters = useCallback(() => {
    setCategoryFilter(ALL_VALUE);
    setPaymentMethodFilter(ALL_VALUE);
    router.push('/transactions');
  }, [router]);

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
              {row.original.category}
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
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[150px]" size="sm" aria-label="Filtrar por categoría">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Todas las categorías</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {paymentMethods.length > 0 && (
        <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
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
      {transactions.length > 0 && (
        <div
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
          role="region"
          aria-label="Resumen de transacciones"
        >
          <div className="rounded-lg border border-l-[3px] border-l-blue-500/50 bg-blue-500/5 dark:bg-blue-500/8 px-3 py-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-500/10 dark:bg-blue-500/15 shrink-0">
                <TrendingUp className="h-3 w-3 text-blue-600 dark:text-blue-400" />
              </span>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Ingresos
              </p>
            </div>
            <p className="text-lg font-bold font-mono tabular-nums text-blue-700 dark:text-blue-300">
              {formatCurrency(summary.income)}
            </p>
          </div>

          <div className="rounded-lg border border-l-[3px] border-l-violet-500/50 bg-violet-500/5 dark:bg-violet-500/8 px-3 py-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-500/10 dark:bg-violet-500/15 shrink-0">
                <TrendingDown className="h-3 w-3 text-violet-600 dark:text-violet-400" />
              </span>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Gastos
              </p>
            </div>
            <p className="text-lg font-bold font-mono tabular-nums text-violet-700 dark:text-violet-300">
              {formatCurrency(summary.expenses)}
            </p>
          </div>

          <div
            className={cn(
              'rounded-lg border border-l-[3px] px-3 py-3',
              summary.net >= 0
                ? 'border-l-emerald-500/50 bg-emerald-500/5 dark:bg-emerald-500/8'
                : 'border-l-destructive/50 bg-destructive/5 dark:bg-destructive/8',
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-md shrink-0',
                  summary.net >= 0
                    ? 'bg-emerald-500/10 dark:bg-emerald-500/15'
                    : 'bg-destructive/10 dark:bg-destructive/15',
                )}
              >
                <DollarSign
                  className={cn(
                    'h-3 w-3',
                    summary.net >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-destructive',
                  )}
                />
              </span>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Balance
              </p>
            </div>
            <p
              className={cn(
                'text-lg font-bold font-mono tabular-nums',
                summary.net >= 0
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-destructive',
              )}
            >
              {formatCurrency(summary.net)}
            </p>
          </div>

          <div className="rounded-lg border border-l-[3px] border-l-amber-500/50 bg-amber-500/5 dark:bg-amber-500/8 px-3 py-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-500/10 dark:bg-amber-500/15 shrink-0">
                <Receipt className="h-3 w-3 text-amber-600 dark:text-amber-400" />
              </span>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Transacciones
              </p>
            </div>
            <p className="text-lg font-bold font-mono tabular-nums">
              {summary.count}
            </p>
          </div>
        </div>
      )}

      <Card className="overflow-hidden border-border/60">
        <CardContent className="pt-6">
          <DataTable
            data={filteredTransactions}
            columns={columns}
            filterColumn="description"
            filterPlaceholder="Buscar por descripción..."
            emptyMessage={
              hasActiveFilters
                ? 'No se encontraron transacciones con los filtros seleccionados.'
                : 'No hay transacciones registradas.'
            }
            filterSlot={filterSlot}
            columnVisibility
          />
        </CardContent>
      </Card>
    </div>
  );
}
