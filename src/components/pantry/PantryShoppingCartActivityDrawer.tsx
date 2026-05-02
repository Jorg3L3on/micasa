'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useFinanceContext } from '@/context/finance-context';
import { listShoppingCartActivity } from '@/lib/api/pantry';
import type {
  PantryShoppingCartActivityDto,
  ShoppingCartActivityAction,
} from '@/types/pantry-shopping-cart';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cartId: number;
};

const ACTION_LABEL: Record<ShoppingCartActivityAction, string> = {
  CART_CREATED: 'Creó el carrito',
  CART_UPDATED: 'Actualizó el carrito',
  CART_STATUS_CHANGED: 'Cambió el estado',
  CART_DELETED: 'Eliminó el carrito',
  ITEM_ADDED: 'Agregó un ítem',
  ITEM_UPDATED: 'Editó un ítem',
  ITEM_CHECKED: 'Marcó como comprado',
  ITEM_UNCHECKED: 'Desmarcó',
  ITEM_REMOVED: 'Eliminó un ítem',
};

const STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: 'En curso',
  BOUGHT: 'Comprado',
  CANCELED: 'Cancelado',
  ARCHIVED: 'Archivado',
};

const formatWhen = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
};

const describeDetails = (
  activity: PantryShoppingCartActivityDto,
): string | null => {
  const { action, metadata } = activity;
  if (!metadata) return null;
  if (action === 'CART_STATUS_CHANGED') {
    const from = STATUS_LABEL[String(metadata.from)] ?? String(metadata.from);
    const to = STATUS_LABEL[String(metadata.to)] ?? String(metadata.to);
    return `${from} → ${to}`;
  }
  if (action === 'ITEM_ADDED' || action === 'ITEM_REMOVED' ||
      action === 'ITEM_CHECKED' || action === 'ITEM_UNCHECKED') {
    return typeof metadata.name === 'string' ? metadata.name : null;
  }
  if (action === 'ITEM_UPDATED') {
    const name = typeof metadata.name === 'string' ? metadata.name : '';
    const changes = metadata.changes as
      | Record<string, { from: unknown; to: unknown }>
      | undefined;
    if (!changes) return name;
    const fields = Object.keys(changes).join(', ');
    return name ? `${name} · ${fields}` : fields;
  }
  if (action === 'CART_UPDATED' && metadata.changes) {
    const changes = metadata.changes as Record<
      string,
      { from: unknown; to: unknown }
    >;
    return Object.keys(changes).join(', ');
  }
  return null;
};

export function PantryShoppingCartActivityDrawer({
  open,
  onOpenChange,
  cartId,
}: Props) {
  const { context } = useFinanceContext();
  const [rows, setRows] = useState<PantryShoppingCartActivityDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await listShoppingCartActivity(cartId, context, 200);
        if (!cancelled) setRows(data);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Error al cargar');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, cartId, context]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Movimientos</SheetTitle>
          <SheetDescription>Quién hizo qué, y cuándo.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {error ? (
            <Alert variant="destructive" className="mb-3">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {loading ? (
            <div className="flex justify-center py-6 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Sin actividad todavía.
            </p>
          ) : (
            <ol className="flex flex-col gap-3">
              {rows.map((row) => {
                const details = describeDetails(row);
                return (
                  <li
                    key={row.id}
                    className="rounded-xl border border-border/60 bg-card p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium leading-tight">
                        {ACTION_LABEL[row.action] ?? row.action}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatWhen(row.created_at)}
                      </span>
                    </div>
                    {details ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {details}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      por {row.user.name}
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
