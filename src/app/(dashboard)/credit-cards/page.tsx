'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CreditCard, Store } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi } from '@/lib/api';
import {
  daysBetweenLocal,
  getNextCalendarDueDate,
} from '@/lib/finance/credit-card-calendar';
import { cn, formatCurrency } from '@/lib/utils';
import type { CreditCardListItem } from '@/types/catalog';
import LiquidityTeaserCard from '@/components/dashboard/LiquidityTeaserCard';

const DUE_SOON_DAYS = 7;

type SortMode = 'due' | 'debt';
type FilterMode = 'all' | 'active' | 'inactive';

const CreditCardHubSkeleton = () => (
  <div className="space-y-6">
    <div className="space-y-2">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-3 w-72 max-w-full" />
    </div>
    <div className="flex flex-wrap gap-2">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-9 w-44" />
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card
          key={i}
          className="overflow-hidden border-border/60"
        >
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/4 max-w-[180px]" />
                <Skeleton className="h-2.5 w-24" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-[52px] rounded-lg" />
              <Skeleton className="h-[52px] rounded-lg" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
);

const isDueSoon = (card: CreditCardListItem): boolean => {
  if (card.due_day == null || card.amount <= 0) return false;
  const next = getNextCalendarDueDate(card.due_day);
  const days = daysBetweenLocal(new Date(), next);
  return days >= 0 && days <= DUE_SOON_DAYS;
};

const CreditCardHubPage = () => {
  const { context } = useFinanceContext();
  const [cards, setCards] = useState<CreditCardListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortMode>('due');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await clientFetchFromApi<CreditCardListItem[]>(
        '/api/credit-cards',
        undefined,
        context,
      );
      setCards(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al cargar las tarjetas',
      );
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleCards = useMemo(() => {
    let list = [...cards];
    if (filterMode === 'active') {
      list = list.filter((c) => c.active);
    } else if (filterMode === 'inactive') {
      list = list.filter((c) => !c.active);
    }

    if (sortBy === 'debt') {
      list.sort((a, b) => b.amount - a.amount);
      return list;
    }

    list.sort((a, b) => {
      const ta =
        a.due_day != null
          ? getNextCalendarDueDate(a.due_day).getTime()
          : Number.MAX_SAFE_INTEGER;
      const tb =
        b.due_day != null
          ? getNextCalendarDueDate(b.due_day).getTime()
          : Number.MAX_SAFE_INTEGER;
      return ta - tb;
    });
    return list;
  }, [cards, filterMode, sortBy]);

  if (loading) {
    return <CreditCardHubSkeleton />;
  }

  if (error) {
    return (
      <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Tarjetas de crédito</h1>
        <p className="text-xs text-muted-foreground">
          Estado de cuenta, pagos y compras por tarjeta
        </p>
      </div>

      <LiquidityTeaserCard />

      {cards.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-2"
          role="toolbar"
          aria-label="Ordenar y filtrar tarjetas"
        >
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="shrink-0">Ordenar</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortMode)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              aria-label="Ordenar tarjetas"
            >
              <option value="due">Próximo vencimiento</option>
              <option value="debt">Mayor deuda</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="shrink-0">Mostrar</span>
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value as FilterMode)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              aria-label="Filtrar por estado de tarjeta"
            >
              <option value="all">Todas</option>
              <option value="active">Solo activas</option>
              <option value="inactive">Solo inactivas</option>
            </select>
          </label>
        </div>
      )}

      {cards.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay tarjetas registradas. Crea una desde{' '}
          <Link href="/wallets" className="text-primary underline">
            Billeteras
          </Link>
          .
        </p>
      ) : visibleCards.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay tarjetas con este filtro.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibleCards.map((card) => {
            const Icon =
              card.type === 'DEPARTMENT_STORE_CARD' ? Store : CreditCard;
            const available =
              card.credit_limit != null
                ? card.credit_limit - card.amount
                : null;
            const dueSoon = isDueSoon(card);
            return (
              <Link
                key={card.id}
                href={`/credit-cards/${card.id}`}
                className="block transition-shadow duration-200 hover:shadow-md"
                aria-label={`Ver estado de cuenta de ${card.name}`}
              >
                <Card
                  className={cn(
                    'overflow-hidden border-border/60 h-full',
                    !card.active && 'opacity-70',
                  )}
                >
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 dark:bg-violet-500/15">
                        <Icon className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate font-medium text-sm">
                            {card.name}
                          </p>
                          {dueSoon && (
                            <Badge
                              variant="outline"
                              className="border-amber-500/50 bg-amber-500/10 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200"
                            >
                              Vence pronto
                            </Badge>
                          )}
                          {!card.active && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] font-semibold uppercase tracking-wide"
                            >
                              Inactiva
                            </Badge>
                          )}
                        </div>
                        {card.cutoff_day != null && card.due_day != null && (
                          <p className="text-[10px] text-muted-foreground">
                            Corte {card.cutoff_day} · Pago {card.due_day}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg border border-l-[3px] border-l-violet-500/50 bg-violet-500/5 px-2.5 py-2 dark:bg-violet-500/8">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Deuda
                        </p>
                        <p className="text-sm font-bold font-mono tabular-nums">
                          {formatCurrency(card.amount)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-l-[3px] border-l-emerald-500/50 bg-emerald-500/5 px-2.5 py-2 dark:bg-emerald-500/8">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Disponible
                        </p>
                        <p
                          className={cn(
                            'text-sm font-bold font-mono tabular-nums',
                            available != null &&
                              available < 0 &&
                              'text-destructive',
                          )}
                        >
                          {available == null
                            ? '—'
                            : formatCurrency(available)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CreditCardHubPage;
