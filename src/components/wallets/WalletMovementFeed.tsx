'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowUp,
  ArrowUpRight,
} from 'lucide-react';
import { CategoryLabel } from '@/components/categories/CategoryLabel';
import EmptyState from '@/components/EmptyState';
import { FilterChip } from '@/components/filter-chip';
import { RevealGroup, RevealItem } from '@/components/motion/reveal';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Money } from '@/components/money';
import { STATUS_SOFT_CLASS } from '@/lib/status-tone';
import { cn, formatDate } from '@/lib/utils';
import type { WalletMovement } from '@/types/wallet-movements';

type KindFilter = 'all' | 'income' | 'expense';
type SortField = 'date' | 'amount' | 'description' | 'category';
type SortDir = 'asc' | 'desc';

const sortMovements = (
  items: WalletMovement[],
  field: SortField,
  dir: SortDir,
  query: string,
  kindFilter: KindFilter,
): WalletMovement[] => {
  const q = query.trim().toLowerCase();
  let rows =
    kindFilter === 'all'
      ? [...items]
      : kindFilter === 'expense'
        ? items.filter(
            (i) =>
              i.kind === 'expense' ||
              i.kind === 'wallet_transfer_fee' ||
              ((i.kind === 'card_payment' || i.kind === 'wallet_transfer') &&
                i.direction === 'out'),
          )
        : items.filter(
            (i) =>
              i.kind === 'income' ||
              ((i.kind === 'card_payment' || i.kind === 'wallet_transfer') &&
                i.direction === 'in'),
          );
  if (q) {
    rows = rows.filter(
      (i) =>
        i.description.toLowerCase().includes(q) ||
        (i.category?.toLowerCase().includes(q) ?? false),
    );
  }
  const m = dir === 'desc' ? -1 : 1;
  rows.sort((a, b) => {
    if (field === 'amount') return m * (a.amount - b.amount);
    if (field === 'description') {
      return m * a.description.localeCompare(b.description, 'es');
    }
    if (field === 'category') {
      return m * (a.category ?? '').localeCompare(b.category ?? '', 'es');
    }
    if (a.date !== b.date) return m * a.date.localeCompare(b.date);
    return m * (a.id - b.id);
  });
  return rows;
};

const groupByDate = (items: WalletMovement[]) => {
  const map = new Map<string, WalletMovement[]>();
  for (const item of items) {
    const list = map.get(item.date) ?? [];
    list.push(item);
    map.set(item.date, list);
  }
  return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
};

const SORT_LABELS: Record<SortField, string> = {
  date: 'Fecha',
  amount: 'Monto',
  description: 'Concepto',
  category: 'Categoría',
};

type WalletMovementsFeedProps = {
  movements: WalletMovement[];
  ownerQueryString: string;
  onAddTransaction?: () => void;
  addTransactionLabel?: string;
  canRegister?: boolean;
};

export const WalletMovementsFeed = ({
  movements,
  ownerQueryString,
  onAddTransaction,
  addTransactionLabel = 'Agregar movimiento',
  canRegister = false,
}: WalletMovementsFeedProps) => {
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [field, setField] = useState<SortField>('date');
  const [dir, setDir] = useState<SortDir>('desc');

  const filtered = useMemo(
    () => sortMovements(movements, field, dir, query, kindFilter),
    [movements, field, dir, query, kindFilter],
  );
  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  const filterOptions: { value: KindFilter; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'income', label: 'Ingresos' },
    { value: 'expense', label: 'Egresos' },
  ];

  const handleSortClick = (next: SortField) => {
    if (field === next) {
      setDir((d) => (d === 'desc' ? 'asc' : 'desc'));
      return;
    }
    setField(next);
    setDir(next === 'date' || next === 'amount' ? 'desc' : 'asc');
  };

  const isEmpty = movements.length === 0;

  return (
    <div
      role="region"
      aria-label="Movimientos"
      className="flex flex-col gap-4 lg:h-full"
    >
      {!isEmpty ? (
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por descripción o categoría…"
            className="h-9 min-w-0 border-border/50 bg-muted/20 text-sm md:flex-1"
            aria-label="Buscar movimientos"
          />
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="flex items-center gap-1.5"
              role="group"
              aria-label="Filtrar por tipo"
            >
              {filterOptions.map(({ value, label }) => (
                <FilterChip
                  key={value}
                  selected={kindFilter === value}
                  onClick={() => setKindFilter(value)}
                  className={cn(
                    'px-2.5 sm:px-3',
                    // Neutral on purpose: the blue pill belongs to the page tabs above.
                    kindFilter === value &&
                      'border-foreground/25 bg-muted text-foreground',
                  )}
                >
                  {label}
                </FilterChip>
              ))}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-9 gap-1 px-2 text-xs text-muted-foreground"
                  aria-label="Ordenar movimientos"
                >
                  <span className="max-sm:hidden">Ordenar · </span>
                  {SORT_LABELS[field]}
                  {dir === 'desc' ? (
                    <ArrowDown className="h-3 w-3" data-icon="inline-start" />
                  ) : (
                    <ArrowUp className="h-3 w-3" data-icon="inline-start" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuRadioGroup
                  value={field}
                  onValueChange={(value) => handleSortClick(value as SortField)}
                >
                  {(Object.keys(SORT_LABELS) as SortField[]).map((key) => (
                    <DropdownMenuRadioItem key={key} value={key} className="text-xs">
                      {SORT_LABELS[key]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ) : null}

      {isEmpty ? (
        <EmptyState
          message="Sin movimientos en este periodo"
          description="Registra un ingreso o un gasto para verlos aquí."
          className="lg:flex-1"
          hangAction
          action={
            canRegister && onAddTransaction
              ? { label: addTransactionLabel, onClick: onAddTransaction }
              : undefined
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          message="Ningún movimiento coincide con el filtro"
          className="lg:flex-1"
        />
      ) : (
        <div
          tabIndex={0}
          role="group"
          aria-label="Lista de movimientos"
          className="outline-none focus-visible:ring-2 focus-visible:ring-primary/45 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1"
        >
          {/* Keyed on the filter and sort, not the search, so typing does not replay it. */}
          <RevealGroup key={`${kindFilter}-${field}-${dir}`} className="space-y-5">
          {grouped.map(([date, rows], groupIndex) => (
            <RevealItem key={date} index={groupIndex}>
            <section aria-label={`Movimientos del ${formatDate(date)}`}>
              <p className="mb-2 eyebrow text-muted-foreground">
                {formatDate(date)}
              </p>
              <ul className="divide-y divide-border/40 rounded-2xl border border-border/50 bg-muted/10 dark:bg-muted/5">
                {rows.length === 0 ? (
                  <li className="px-3 py-4 text-center text-sm text-muted-foreground">
                    Sin movimientos en esta fecha.
                  </li>
                ) : (
                  rows.map((m) => {
                  const isIn = m.direction === 'in';
                  const fortnightLink =
                    m.fortnightYear != null &&
                    m.fortnightMonth != null &&
                    m.fortnightPeriod
                      ? `/fortnight/${m.fortnightYear}/${String(m.fortnightMonth).padStart(2, '0')}/${m.fortnightPeriod}${ownerQueryString}`
                      : null;
                  return (
                    <li key={`${m.kind}-${m.id}`} className="flex items-start gap-3 px-3 py-3">
                      <span
                        className={cn(
                          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                          STATUS_SOFT_CLASS[isIn ? 'income' : 'expense'],
                        )}
                        aria-hidden
                      >
                        {isIn ? (
                          <ArrowDownLeft className="h-4 w-4" data-icon="inline-start" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4" data-icon="inline-start" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium" title={m.description}>
                          {m.description}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                          {m.category ? (
                            <>
                              <CategoryLabel name={m.category} icon={m.categoryIcon} />
                              <span className="text-muted-foreground/30">·</span>
                            </>
                          ) : null}
                          <span>
                            {m.kind === 'card_payment'
                              ? 'Pago tarjeta'
                              : m.kind === 'wallet_transfer'
                                ? 'Transferencia'
                                : m.kind === 'wallet_transfer_fee'
                                  ? 'Comisión'
                                  : isIn
                                    ? 'Ingreso'
                                    : 'Egreso'}
                          </span>
                        </p>
                        {fortnightLink ? (
                          <Link
                            href={fortnightLink}
                            className="mt-1 inline-block text-xs font-medium text-primary-text underline-offset-2 hover:underline"
                          >
                            Ver en quincena
                          </Link>
                        ) : null}
                      </div>
                      <Money
                        value={isIn ? m.amount : -m.amount}
                        size="row"
                        className="font-bold"
                      />
                    </li>
                  );
                })
                )}
              </ul>
            </section>
            </RevealItem>
          ))}
          </RevealGroup>
        </div>
      )}
    </div>
  );
};
