'use client';

import Link from 'next/link';
import { CheckCircle2, ShoppingCart, User as UserIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn, formatCurrency } from '@/lib/utils';
import type {
  PantryShoppingCartSummaryDto,
  ShoppingCartStatus,
} from '@/types/pantry-shopping-cart';

const STATUS_META: Record<
  ShoppingCartStatus,
  { label: string; className: string }
> = {
  IN_PROGRESS: {
    label: 'En curso',
    className:
      'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300',
  },
  BOUGHT: {
    label: 'Comprado',
    className:
      'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300',
  },
  CANCELED: {
    label: 'Cancelado',
    className:
      'bg-rose-500/10 text-rose-700 border-rose-500/30 dark:text-rose-300',
  },
  ARCHIVED: {
    label: 'Archivado',
    className:
      'bg-muted text-muted-foreground border-border/60',
  },
};

export function ShoppingCartStatusBadge({
  status,
}: {
  status: ShoppingCartStatus;
}) {
  const meta = STATUS_META[status];
  return (
    <Badge
      variant="outline"
      className={cn('text-[10px] font-semibold', meta.className)}
    >
      {meta.label}
    </Badge>
  );
}

type Props = {
  cart: PantryShoppingCartSummaryDto;
  href: string;
};

export function PantryShoppingCartCard({ cart, href }: Props) {
  const { totals } = cart;
  return (
    <Link
      href={href}
      className="group block rounded-2xl border border-border/60 bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
          <ShoppingCart className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-sm font-semibold leading-tight">
              {cart.title}
            </h3>
            <ShoppingCartStatusBadge status={cart.status} />
          </div>
          {cart.notes ? (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {cart.notes}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <ShoppingCart className="h-3 w-3" />
              {totals.items_count}
              {totals.items_count === 1 ? ' ítem' : ' ítems'}
            </span>
            {totals.items_count > 0 ? (
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {totals.checked_count}/{totals.items_count}
              </span>
            ) : null}
            <span className="ml-auto font-mono tabular-nums text-foreground">
              {formatCurrency(totals.estimated_total)}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
            <UserIcon className="h-3 w-3" />
            <span className="truncate">Creado por {cart.created_by.name}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
