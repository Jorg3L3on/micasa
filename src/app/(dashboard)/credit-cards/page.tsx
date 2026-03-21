'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CreditCard, Store } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi } from '@/lib/api';
import { cn, formatCurrency } from '@/lib/utils';
import type { CreditCardListItem } from '@/types/catalog';

const CreditCardHubPage = () => {
  const { context } = useFinanceContext();
  const [cards, setCards] = useState<CreditCardListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) {
    return (
      <div className="py-8 text-center text-muted-foreground">Cargando...</div>
    );
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

      {cards.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay tarjetas registradas. Crea una desde{' '}
          <Link href="/wallets" className="text-primary underline">
            Billeteras
          </Link>
          .
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => {
            const Icon =
              card.type === 'DEPARTMENT_STORE_CARD' ? Store : CreditCard;
            const available =
              card.credit_limit != null
                ? card.credit_limit - card.amount
                : null;
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
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 dark:bg-violet-500/15">
                        <Icon className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-sm">{card.name}</p>
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
                            available != null && available < 0 && 'text-destructive',
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
