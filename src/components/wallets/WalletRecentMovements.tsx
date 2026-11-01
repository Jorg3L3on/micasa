'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { useFinanceContext } from '@/context/finance-context';
import {
  fetchRecentMovements,
  getCachedRecentMovements,
  recentMovementsKey,
  RECENT_MOVEMENTS_LIMIT,
} from '@/lib/ui/wallet-recent-movements';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type { WalletListItem } from '@/types/catalog';
import type { WalletMovement } from '@/types/wallet-movements';

type Loaded = { key: string; movements: WalletMovement[] | null };

type WalletRecentMovementsProps = {
  wallet: WalletListItem;
  detailHref: string;
};

/** The wallet's latest movements (three at most), or a legend when it has none. */
export const WalletRecentMovements = ({
  wallet,
  detailHref,
}: WalletRecentMovementsProps) => {
  const { context } = useFinanceContext();
  const reducedMotion = useReducedMotion() ?? false;
  const key = recentMovementsKey(context, wallet.id, Number(wallet.amount) || 0);
  const [loaded, setLoaded] = useState<Loaded>({ key: '', movements: null });

  const cached = getCachedRecentMovements(key);
  const movements = cached ?? (loaded.key === key ? loaded.movements : null);
  const failed = loaded.key === key && loaded.movements === null && cached == null;

  useEffect(() => {
    if (cached || loaded.key === key) return;
    let cancelled = false;
    fetchRecentMovements(key, wallet.id, context)
      .then((list) => {
        if (!cancelled) setLoaded({ key, movements: list });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ key, movements: null });
      });
    return () => {
      cancelled = true;
    };
  }, [cached, context, key, loaded.key, wallet.id]);

  return (
    <section aria-label="Últimos movimientos" className="mt-5 w-full">
      <div className="mb-1 flex items-baseline justify-between gap-2 px-1">
        <h3 className="text-section text-foreground">Últimos movimientos</h3>
        {movements && movements.length > 0 ? (
          <Link
            href={detailHref}
            className="text-caption text-muted-foreground hover:text-foreground"
          >
            Ver todos
          </Link>
        ) : null}
      </div>

      {movements == null && !failed ? (
        <div className="space-y-2" aria-busy="true" aria-label="Cargando movimientos">
          {Array.from({ length: RECENT_MOVEMENTS_LIMIT }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      ) : movements == null || movements.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/60 px-3 py-5 text-center text-body text-muted-foreground">
          {failed
            ? 'No se pudieron cargar los movimientos'
            : 'Sin movimientos recientes'}
        </p>
      ) : (
        <motion.ul
          key={wallet.id}
          className="divide-y divide-border/60 rounded-xl border border-border/60"
          initial={{ opacity: 0, y: reducedMotion ? 0 : 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0.12 : 0.24, ease: [0.16, 1, 0.3, 1] }}
        >
          {movements.map((movement) => {
            const isIn = movement.direction === 'in';
            return (
              <li key={`${movement.kind}-${movement.id}`}>
                <Link
                  href={detailHref}
                  className="flex min-h-12 items-center justify-between gap-3 px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {movement.description}
                    </span>
                    <span className="block truncate text-caption text-muted-foreground">
                      {[movement.category, formatDate(movement.date)]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'shrink-0 text-sm font-semibold tabular-nums',
                      isIn ? 'text-status-income' : 'text-foreground',
                    )}
                  >
                    {isIn ? '+' : '−'}
                    {formatCurrency(Math.abs(movement.amount))}
                  </span>
                </Link>
              </li>
            );
          })}
        </motion.ul>
      )}
    </section>
  );
};
