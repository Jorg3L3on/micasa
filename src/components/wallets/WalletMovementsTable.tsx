'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CreditCard } from 'lucide-react';
import { CategoryIcon } from '@/components/categories/CategoryIcon';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useFinanceContext } from '@/context/finance-context';
import {
  fetchRecentMovements,
  getCachedRecentMovements,
  recentMovementsKey,
} from '@/lib/ui/wallet-recent-movements';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type { WalletListItem } from '@/types/catalog';
import type { WalletMovement, WalletMovementKind } from '@/types/wallet-movements';

export const WALLET_TABLE_ROWS = 8;

const KIND_LABEL: Record<WalletMovementKind, string> = {
  expense: 'Gasto',
  income: 'Ingreso',
  card_payment: 'Pago de tarjeta',
  wallet_transfer: 'Transferencia',
  wallet_transfer_fee: 'Comisión',
};

type Loaded = { key: string; movements: WalletMovement[] | null };

type WalletMovementsTableProps = {
  wallet: WalletListItem;
  /** Full movements page for this wallet. */
  moreHref: string;
};

/** Payment-history table for one wallet: description, date, type chip, amount. */
export const WalletMovementsTable = ({ wallet, moreHref }: WalletMovementsTableProps) => {
  const { context } = useFinanceContext();
  const key = `${recentMovementsKey(context, wallet.id, Number(wallet.amount) || 0)}:n${WALLET_TABLE_ROWS}`;
  const [loaded, setLoaded] = useState<Loaded>({ key: '', movements: null });
  const cached = getCachedRecentMovements(key);
  const movements = cached ?? (loaded.key === key ? loaded.movements : null);
  const failed = loaded.key === key && loaded.movements === null && cached == null;

  useEffect(() => {
    if (cached || loaded.key === key) return;
    let cancelled = false;
    fetchRecentMovements(key, wallet.id, context, WALLET_TABLE_ROWS)
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

  if (movements == null && !failed) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Cargando movimientos">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (movements == null || movements.length === 0) {
    return (
      <p className="px-3 py-8 text-center text-body text-muted-foreground">
        {failed ? 'No se pudieron cargar los movimientos' : 'Sin movimientos recientes'}
      </p>
    );
  }

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Descripción</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="text-right">Monto</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {movements.map((movement) => {
            const isIn = movement.direction === 'in';
            return (
              <TableRow key={`${movement.kind}-${movement.id}`} className="h-16">
                <TableCell>
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted/70">
                      {movement.categoryIcon ? (
                        <CategoryIcon
                          icon={movement.categoryIcon}
                          iconClassName="h-5 w-5"
                          className="text-foreground"
                        />
                      ) : (
                        <CreditCard className="h-5 w-5 text-foreground" aria-hidden />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {movement.description}
                      </span>
                      {movement.category ? (
                        <span className="block truncate text-caption text-muted-foreground">
                          {movement.category}
                        </span>
                      ) : null}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {formatDate(movement.date)}
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2.5 py-0.5 text-caption font-medium',
                      isIn
                        ? 'bg-status-income-soft text-status-income'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {KIND_LABEL[movement.kind]}
                  </span>
                </TableCell>
                <TableCell
                  className={cn(
                    'whitespace-nowrap text-right text-sm font-semibold tabular-nums',
                    isIn ? 'text-status-income' : 'text-foreground',
                  )}
                >
                  {isIn ? '+' : '−'}
                  {formatCurrency(Math.abs(movement.amount))}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <div className="px-3 pt-3 text-right">
        <Link
          href={moreHref}
          className="rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          Ver todos los movimientos
        </Link>
      </div>
    </div>
  );
};
