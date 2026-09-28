'use client';

import { FilterChip } from '@/components/filter-chip';

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
import {
  ToolbarFiltersPortal,
  useRegisterToolbarActions,
  useToolbarFiltersSelectOpenChange,
} from '@/context/toolbar-actions-context';
import { Money } from '@/components/money';
import { STATUS_BADGE_CLASS, STATUS_SOFT_CLASS } from '@/lib/status-tone';
import { formatMonthPhrase } from '@/lib/calendar-dates';
import { formatDate, cn } from '@/lib/utils';
import { MobilePullToRefresh } from '@/components/motion/mobile-pull-to-refresh';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import type { TransactionRow } from '@/types/catalog';
import {
  ArrowDownRight,
  ArrowUpRight,
  Wallet,
} from 'lucide-react';

const ALL_VALUE = '__all__';

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: formatMonthPhrase(i + 1),
}));

const TYPE_FILTER_CHIPS = [
  { value: ALL_VALUE, label: 'Todos' },
  { value: 'income', label: 'Ingreso' },
  { value: 'expense', label: 'Gasto' },
] as const;

const TRANSACTION_SERVER_FILTER_KEYS = ['month', 'year', 'period', 'type'] as const;

const TransactionMobileRow = ({ transaction }: { transaction: TransactionRow }) => {
  const isExpense = transaction.type === 'expense';
  const amount = Math.abs(Number(transaction.amount));

  return (
    <div className="grid w-full min-w-0 max-w-full grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1.5 px-3 py-3">
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          isExpense ? STATUS_SOFT_CLASS.expense : STATUS_SOFT_CLASS.income,
        )}
        aria-hidden
      >
        {isExpense ? (
          <ArrowDownRight className="h-4 w-4" />
        ) : (
          <ArrowUpRight className="h-4 w-4" />
        )}
      </span>
      <div className="min-w-0">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <p className="min-w-0 flex-1 break-words text-body font-medium text-foreground">
            {transaction.description}
          </p>
          <Money
            value={isExpense ? -amount : amount}
            size="row"
            tone={isExpense ? 'negative' : 'positive'}
            className="shrink-0"
          />
        </div>
        <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted-foreground">
          <span className="whitespace-nowrap">{formatDate(transaction.date)}</span>
          <span className="inline-flex min-w-0 items-center gap-1">
            <Wallet className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{transaction.paymentMethod}</span>
          </span>
          <Badge
            variant="outline"
            className={cn(
              'whitespace-nowrap',
              isExpense ? STATUS_BADGE_CLASS.expense : STATUS_BADGE_CLASS.income,
            )}
          >
            {isExpense ? 'Gasto' : 'Ingreso'}
          </Badge>
        </div>
      </div>
    </div>
  );
};

type TransactionsDataTableProps = {
  transactions: TransactionRow[];
};

export default function TransactionsDataTable({
  transactions: serverTransactions,
}: TransactionsDataTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { context } = useFinanceContext();
  const [transactions, setTransactions] = useState(serverTransactions);
  const [syncedServerTransactions, setSyncedServerTransactions] =
    useState(serverTransactions);

  if (syncedServerTransactions !== serverTransactions) {
    setSyncedServerTransactions(serverTransactions);
    setTransactions(serverTransactions);
  }

  const handlePullRefresh = useCallback(async () => {
    const params = new URLSearchParams();
    for (const key of TRANSACTION_SERVER_FILTER_KEYS) {
      const value = searchParams.get(key);
      if (value) params.append(key, value);
    }
    params.append('is_paid', 'true');
    const rows = await clientFetchFromApi<TransactionRow[]>(
      `/api/transactions?${params.toString()}`,
      undefined,
      context,
    );
    setTransactions(rows);
  }, [context, searchParams]);

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

  const handleFiltersSelectOpenChange = useToolbarFiltersSelectOpenChange();

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
                  ? STATUS_SOFT_CLASS.expense
                  : STATUS_SOFT_CLASS.income,
              )}
            >
              {row.original.type === 'expense' ? (
                <ArrowDownRight className="h-3.5 w-3.5" data-icon="inline-start" />
              ) : (
                <ArrowUpRight className="h-3.5 w-3.5" data-icon="inline-start" />
              )}
            </span>
            <span
              className="min-w-0 whitespace-normal break-words font-medium"
              title={row.original.description}
            >
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
            <Money
              value={t.type === 'expense' ? -Math.abs(Number(t.amount)) : Math.abs(Number(t.amount))}
              size="row"
              tone={t.type === 'expense' ? 'negative' : 'positive'}
              className="block text-right"
            />
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
              variant="outline"
              className={cn(
                'whitespace-nowrap',
                isExpense ? STATUS_BADGE_CLASS.expense : STATUS_BADGE_CLASS.income,
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
    <MobilePullToRefresh onRefresh={handlePullRefresh} ariaLabel="Operaciones">
    <div className="space-y-5">
      <ToolbarFiltersPortal>
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-1.5 eyebrow text-muted-foreground">
              Tipo
            </p>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Filtrar por tipo"
            >
              {TYPE_FILTER_CHIPS.map(({ value, label }) => {
                const selected = (type || ALL_VALUE) === value;
                return (
                  <FilterChip
                    key={value}
                    selected={selected}
                    onClick={() => handleServerFilter('type', value)}
                  >
                    {label}
                  </FilterChip>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <p className="mb-1.5 eyebrow text-muted-foreground">
                Mes
              </p>
              <Select
                value={month || ALL_VALUE}
                onValueChange={(v) => handleServerFilter('month', v)}
                onOpenChange={handleFiltersSelectOpenChange}
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
              <p className="mb-1.5 eyebrow text-muted-foreground">
                Año
              </p>
              <Select
                value={year || ALL_VALUE}
                onValueChange={(v) => handleServerFilter('year', v)}
                onOpenChange={handleFiltersSelectOpenChange}
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
              <p className="mb-1.5 eyebrow text-muted-foreground">
                Quincena
              </p>
              <Select
                value={period || ALL_VALUE}
                onValueChange={(v) => handleServerFilter('period', v)}
                onOpenChange={handleFiltersSelectOpenChange}
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
              <p className="mb-1.5 eyebrow text-muted-foreground">
                Categoría
              </p>
              <Select
                value={categoryFilter}
                onValueChange={setCategoryFilter}
                onOpenChange={handleFiltersSelectOpenChange}
              >
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
              <p className="mb-1.5 eyebrow text-muted-foreground">
                Método de pago
              </p>
              <Select
                value={paymentMethodFilter}
                onValueChange={setPaymentMethodFilter}
                onOpenChange={handleFiltersSelectOpenChange}
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
              aria-label="Limpiar filtros de movimientos"
            >
              Limpiar filtros
            </Button>
          ) : null}
        </div>
      </ToolbarFiltersPortal>

      <div className="max-w-full overflow-hidden rounded-xl border border-border/60 bg-card shadow-card">
        <DataTable
          embedded
          data={filteredTransactions}
          columns={columns}
          emptyMessage={
            hasActiveFilters
              ? 'No se encontraron movimientos con los filtros seleccionados.'
              : 'No hay movimientos registrados.'
          }
          columnVisibility
          renderMobileRow={(transaction) => (
            <TransactionMobileRow transaction={transaction} />
          )}
        />
      </div>
    </div>
    </MobilePullToRefresh>
  );
}
