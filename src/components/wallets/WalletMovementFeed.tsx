'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowUp,
  ArrowUpRight,
  Inbox,
} from 'lucide-react';
import { CategoryLabel } from '@/components/categories/CategoryLabel';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  creditCardSegmentedFilterButtonClass,
  creditCardSegmentedTabChromeClass,
} from '@/components/credit-cards/credit-card-segmented-tabs';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
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
            (i) => i.kind === 'expense' || (i.kind === 'card_payment' && i.direction === 'out'),
          )
        : items.filter(
            (i) => i.kind === 'income' || (i.kind === 'card_payment' && i.direction === 'in'),
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
  onRegisterExpense?: () => void;
  onRegisterIncome?: () => void;
  canRegister?: boolean;
};

export const WalletMovementsFeed = ({
  movements,
  ownerQueryString,
  onRegisterExpense,
  onRegisterIncome,
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
    <div role="region" aria-label="Movimientos" className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Movimientos</h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1 px-2 text-xs text-muted-foreground"
              aria-label="Ordenar movimientos"
            >
              Ordenar · {SORT_LABELS[field]}
              {dir === 'desc' ? (
                <ArrowDown className="h-3 w-3" />
              ) : (
                <ArrowUp className="h-3 w-3" />
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

      <div className={creditCardSegmentedTabChromeClass}>
        <div className="grid w-full grid-cols-3 gap-1" role="tablist" aria-label="Filtrar movimientos">
          {filterOptions.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={kindFilter === value}
              onClick={() => setKindFilter(value)}
              className={creditCardSegmentedFilterButtonClass(kindFilter === value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {!isEmpty ? (
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por descripción o categoría…"
          className="h-9 border-border/50 bg-muted/20 text-sm"
          aria-label="Filtrar movimientos"
        />
      ) : null}

      {isEmpty ? (
        <WalletFeedEmpty
          canRegister={canRegister}
          onRegisterExpense={onRegisterExpense}
          onRegisterIncome={onRegisterIncome}
        />
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Ningún movimiento coincide con el filtro.
        </p>
      ) : (
        <div className="space-y-5">
          {grouped.map(([date, rows]) => (
            <section key={date} aria-label={`Movimientos del ${formatDate(date)}`}>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {formatDate(date)}
              </p>
              <ul className="divide-y divide-border/40 rounded-2xl border border-border/50 bg-muted/10 dark:bg-muted/5">
                {rows.map((m) => {
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
                          isIn
                            ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
                            : 'bg-rose-500/12 text-rose-600 dark:text-rose-400',
                        )}
                        aria-hidden
                      >
                        {isIn ? (
                          <ArrowDownLeft className="h-4 w-4" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{m.description}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                          {m.category ? (
                            <>
                              <CategoryLabel name={m.category} icon={m.categoryIcon} />
                              <span className="text-muted-foreground/30">·</span>
                            </>
                          ) : null}
                          <span>
                            {m.kind === 'card_payment'
                              ? 'Pago tarjeta'
                              : isIn
                                ? 'Ingreso'
                                : 'Egreso'}
                          </span>
                        </p>
                        {fortnightLink ? (
                          <Link
                            href={fortnightLink}
                            className="mt-1 inline-block text-[10px] font-medium text-primary underline-offset-2 hover:underline"
                          >
                            Ver en quincena
                          </Link>
                        ) : null}
                      </div>
                      <span
                        className={cn(
                          'shrink-0 font-mono text-sm font-bold tabular-nums',
                          isIn && 'text-emerald-600 dark:text-emerald-400',
                        )}
                      >
                        {isIn ? '+' : '−'} {formatCurrency(m.amount)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

const WalletFeedEmpty = ({
  canRegister,
  onRegisterExpense,
  onRegisterIncome,
}: {
  canRegister: boolean;
  onRegisterExpense?: () => void;
  onRegisterIncome?: () => void;
}) => (
  <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 px-4 py-10 text-center">
    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/40">
      <Inbox className="h-5 w-5 text-muted-foreground" aria-hidden />
    </span>
    <div>
      <p className="text-sm font-medium">Sin movimientos en este periodo</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Registra un ingreso o un gasto para verlos aquí.
      </p>
    </div>
    {canRegister ? (
      <div className="flex flex-wrap justify-center gap-2">
        {onRegisterExpense ? (
          <Button type="button" size="sm" variant="outline" onClick={onRegisterExpense}>
            Registrar gasto
          </Button>
        ) : null}
        {onRegisterIncome ? (
          <Button type="button" size="sm" onClick={onRegisterIncome}>
            Registrar ingreso
          </Button>
        ) : null}
      </div>
    ) : null}
  </div>
);
