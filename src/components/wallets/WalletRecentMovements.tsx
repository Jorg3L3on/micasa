'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CreditCard, Plus } from 'lucide-react';
import { CategoryIcon } from '@/components/categories/CategoryIcon';
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
    <section
      aria-label="Últimos movimientos"
      className="mt-5 w-full rounded-2xl border border-border/60 bg-card/60 p-2 shadow-sm"
    >
      <h3 className="px-2 pb-1 pt-1.5 text-section text-foreground">
        Últimos movimientos
      </h3>

      {movements == null && !failed ? (
        <div className="space-y-1" aria-busy="true" aria-label="Cargando movimientos">
          {Array.from({ length: RECENT_MOVEMENTS_LIMIT }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : movements == null || movements.length === 0 ? (
        <p className="px-3 py-5 text-center text-body text-muted-foreground">
          {failed
            ? 'No se pudieron cargar los movimientos'
            : 'Sin movimientos recientes'}
        </p>
      ) : (
        <motion.div
          key={wallet.id}
          initial={{ opacity: 0, y: reducedMotion ? 0 : 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0.12 : 0.24, ease: [0.16, 1, 0.3, 1] }}
        >
          <ul>
            {movements.map((movement, rowIndex) => {
              const isIn = movement.direction === 'in';
              return (
                <motion.li
                  key={`${movement.kind}-${movement.id}`}
                  initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: reducedMotion ? 0.12 : 0.32,
                    delay: reducedMotion ? 0 : rowIndex * 0.06,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <Link
                    href={detailHref}
                    className="flex min-h-14 items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-muted/70">
                      {movement.categoryIcon ? (
                        <CategoryIcon
                          icon={movement.categoryIcon}
                          iconClassName="h-5 w-5"
                          className="text-foreground"
                        />
                      ) : (
                        <CreditCard className="h-5 w-5 text-foreground" aria-hidden />
                      )}
                      <span
                        aria-hidden
                        className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-foreground text-background ring-2 ring-card"
                      >
                        {isIn ? (
                          <Plus className="h-2.5 w-2.5" strokeWidth={3} />
                        ) : (
                          <ArrowRight className="h-2.5 w-2.5" strokeWidth={3} />
                        )}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
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
                </motion.li>
              );
            })}
          </ul>
          <Link
            href={detailHref}
            className="mt-1 block rounded-xl py-2.5 text-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            Ver todos
          </Link>
        </motion.div>
      )}
    </section>
  );
};
