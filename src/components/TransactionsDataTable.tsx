'use client';

import { useMemo, useState, useCallback } from 'react';
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
import {
  ToolbarFiltersPortal,
  useRegisterToolbarActions,
} from '@/context/toolbar-actions-context';
import { formatDate, formatCurrencySigned, cn } from '@/lib/utils';
import type { TransactionRow } from '@/types/catalog';
import {
  ArrowDownRight,
  ArrowUpRight,
  Wallet,
} from 'lucide-react';

const ALL_VALUE = '__all__';

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: new Date(2000, i).toLocaleString('es-MX', { month: 'long' }),
}));

const TYPE_FILTER_CHIPS = [
  { value: ALL_VALUE, label: 'Todos' },
  { value: 'income', label: 'Ingreso' },
  { value: 'expense', label: 'Gasto' },
] as const;

const FILTER_CHIP_CLASS =
  'h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(
    () => Array.from({ length: 5 }, (_, i) => currentYear - 2 + i),
    [currentYear],
  );

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
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter((t) =>
        t.description.toLowerCase().includes(query),
      );
    }
    if (categoryFilter !== ALL_VALUE) {
      result = result.filter((t) => t.category === categoryFilter);
    }
    if (paymentMethodFilter !== ALL_VALUE) {
      result = result.filter((t) => t.paymentMethod === paymentMethodFilter);
    }
    return result;
  }, [transactions, searchQuery, categoryFilter, paymentMethodFilter]);

  const handleServerFilter = useCallback(
    (field: string, value: string) => {
      const newParams = new URLSearchParams(searchParams.toString());
      if (value && value !== ALL_VALUE) {
        newParams.set(field, value);
      } else {
        newParams.delete(field);
        if (field === 'month' || field === 'year') {
          newParams.delete('period');
        }
      }
      router.push(
        `/transactions${newParams.toString() ? `?${newParams.toString()}` : ''}`,
      );
    },
    [router, searchParams],
  );

  const activeFilterDimensionCount = useMemo(() => {
    let n = 0;
    if (searchQuery.trim()) n += 1;
    if (month) n += 1;
    if (year) n += 1;
    if (period) n += 1;
    if (type) n += 1;
    if (categoryFilter !== ALL_VALUE) n += 1;
    if (paymentMethodFilter !== ALL_VALUE) n += 1;
    return n;
  }, [
    searchQuery,
    month,
    year,
    period,
    type,
    categoryFilter,
    paymentMethodFilter,
  ]);

  const hasActiveFilters = activeFilterDimensionCount > 0;

  const handleClearAllFilters = useCallback(() => {
    setSearchQuery('');
    setCategoryFilter(ALL_VALUE);
    setPaymentMethodFilter(ALL_VALUE);
    const next = new URLSearchParams();
    const ownerType = searchParams.get('ownerType');
    const ownerId = searchParams.get('ownerId');
    if (ownerType) next.set('ownerType', ownerType);
    if (ownerId) next.set('ownerId', ownerId);
    router.push(
      `/transactions${next.toString() ? `?${next.toString()}` : ''}`,
    );
  }, [router, searchParams]);

  useRegisterToolbarActions({
    search: {
      value: searchQuery,
      onChange: setSearchQuery,
      placeholder: 'Buscar por descripción',
    },
    filters: {
      open: filtersOpen,
      onOpenChange: setFiltersOpen,
      activeCount: activeFilterDimensionCount,
    },
  });

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
                <ArrowDownRight className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" data-icon="inline-start" />
              ) : (
                <ArrowUpRight className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" data-icon="inline-start" />
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
            <Wallet className="h-3.5 w-3.5" data-icon="inline-start" />
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

  return (
    <div className="space-y-6">
      <ToolbarFiltersPortal>
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Tipo
            </p>
            <div
              className="flex flex-wrap gap-2"
              role="tablist"
              aria-label="Filtrar por tipo"
            >
              {TYPE_FILTER_CHIPS.map(({ value, label }) => {
                const selected = (type || ALL_VALUE) === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => handleServerFilter('type', value)}
                    className={cn(
                      FILTER_CHIP_CLASS,
                      selected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border/60 bg-card text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Mes
              </p>
              <Select
                value={month || ALL_VALUE}
                onValueChange={(v) => handleServerFilter('month', v)}
              >
                <SelectTrigger className="w-full" aria-label="Filtrar por mes">
                  <SelectValue placeholder="Mes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>Todos los meses</SelectItem>
                  {MONTH_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 flex-1">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Año
              </p>
              <Select
                value={year || ALL_VALUE}
                onValueChange={(v) => handleServerFilter('year', v)}
              >
                <SelectTrigger className="w-full" aria-label="Filtrar por año">
                  <SelectValue placeholder="Año" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>Todos</SelectItem>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {month && year ? (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Quincena
              </p>
              <Select
                value={period || ALL_VALUE}
                onValueChange={(v) => handleServerFilter('period', v)}
              >
                <SelectTrigger className="w-full" aria-label="Filtrar por quincena">
                  <SelectValue placeholder="Quincena" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>Ambas quincenas</SelectItem>
                  <SelectItem value="FIRST">Primera quincena</SelectItem>
                  <SelectItem value="SECOND">Segunda quincena</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {categories.length > 0 ? (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Categoría
              </p>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full" aria-label="Filtrar por categoría">
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
            </div>
          ) : null}

          {paymentMethods.length > 0 ? (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Método de pago
              </p>
              <Select
                value={paymentMethodFilter}
                onValueChange={setPaymentMethodFilter}
              >
                <SelectTrigger
                  className="w-full"
                  aria-label="Filtrar por método de pago"
                >
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
            </div>
          ) : null}

          {hasActiveFilters ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 shrink-0 self-start text-muted-foreground"
              onClick={handleClearAllFilters}
              aria-label="Limpiar filtros de transacciones"
            >
              Limpiar filtros
            </Button>
          ) : null}
        </div>
      </ToolbarFiltersPortal>

      <Card className="overflow-hidden border-border/60">
        <CardContent className="pt-6">
          <DataTable
            data={filteredTransactions}
            columns={columns}
            emptyMessage={
              hasActiveFilters
                ? 'No se encontraron transacciones con los filtros seleccionados.'
                : 'No hay transacciones registradas.'
            }
            columnVisibility
          />
        </CardContent>
      </Card>
    </div>
  );
}
