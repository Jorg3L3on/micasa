'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, ListChecks, Loader2, Plus, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn, formatCurrency } from '@/lib/utils';
import EmptyState from '@/components/EmptyState';
import { PantryLayoutShell } from '@/components/pantry/PantryLayoutShell';
import { PantryMetricTile } from '@/components/pantry/PantryMetricTile';
import { CreateCartSheet } from '@/components/pantry/CreateCartSheet';
import { PantryShoppingCartCard } from '@/components/pantry/PantryShoppingCartCard';
import { useFinanceContext } from '@/context/finance-context';
import { createShoppingCart, listShoppingCarts } from '@/lib/api';
import type {
  PantryShoppingCartSummaryDto,
  ShoppingCartStatus,
} from '@/types/pantry-shopping-cart';

type StatusFilter = ShoppingCartStatus | 'ALL';

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'IN_PROGRESS', label: 'En curso' },
  { value: 'BOUGHT', label: 'Comprados' },
  { value: 'CANCELED', label: 'Cancelados' },
  { value: 'ARCHIVED', label: 'Archivados' },
  { value: 'ALL', label: 'Todos' },
];

const formatRelative = (iso: string | null): string => {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diffMs = Date.now() - then;
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `hace ${days} d`;
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
};

export default function PantryShoppingListView() {
  const { context } = useFinanceContext();
  const [allCarts, setAllCarts] = useState<PantryShoppingCartSummaryDto[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('IN_PROGRESS');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const loadList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const carts = await listShoppingCarts(context, 'ALL');
      setAllCarts(carts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar los carritos');
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const carts = useMemo(
    () =>
      filter === 'ALL'
        ? allCarts
        : allCarts.filter((cart) => cart.status === filter),
    [allCarts, filter],
  );

  const inProgressCarts = useMemo(
    () => allCarts.filter((cart) => cart.status === 'IN_PROGRESS'),
    [allCarts],
  );

  const filterCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      IN_PROGRESS: 0,
      BOUGHT: 0,
      CANCELED: 0,
      ARCHIVED: 0,
      ALL: allCarts.length,
    };
    for (const cart of allCarts) {
      counts[cart.status] += 1;
    }
    return counts;
  }, [allCarts]);

  const ownerQuery = useMemo(() => {
    const q = new URLSearchParams();
    q.set('ownerType', context.type);
    q.set('ownerId', String(context.id));
    return q.toString();
  }, [context.id, context.type]);

  const hrefFor = (id: number) =>
    ownerQuery
      ? `/pantry/shopping/${id}?${ownerQuery}`
      : `/pantry/shopping/${id}`;

  const metrics = useMemo(() => {
    const cartsCount = inProgressCarts.length;
    const itemsPending = inProgressCarts.reduce(
      (acc, c) => acc + Math.max(0, c.totals.items_count - c.totals.checked_count),
      0,
    );
    const estimated = inProgressCarts.reduce(
      (acc, c) => acc + (c.totals.estimated_total ?? 0),
      0,
    );
    const lastUpdated = inProgressCarts.reduce<string | null>((acc, c) => {
      if (!acc) return c.updated_at;
      return new Date(c.updated_at) > new Date(acc) ? c.updated_at : acc;
    }, null);
    return { cartsCount, itemsPending, estimated, lastUpdated };
  }, [inProgressCarts]);

  const handleCreate = async (data: {
    title: string;
    notes: string | null;
    store: PantryShoppingCartSummaryDto['store'];
  }) => {
    const created = await createShoppingCart(data, context);
    toast.success('Carrito creado');
    setCreateOpen(false);
    const summary: PantryShoppingCartSummaryDto = {
      id: created.id,
      title: created.title,
      notes: created.notes,
      status: created.status,
      currency: created.currency,
      store: created.store,
      created_by: created.created_by,
      updated_by: created.updated_by,
      created_at: created.created_at,
      updated_at: created.updated_at,
      totals: created.totals,
    };
    setAllCarts((prev) => [summary, ...prev]);
  };

  return (
    <PantryLayoutShell
      className="space-y-5 pb-24"
      role="region"
      aria-label="Listas de compras"
    >
      <div className="sticky top-20 z-20 -mx-4 flex flex-wrap items-center justify-between gap-2 bg-background/95 px-4 py-2 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-tight">Listas de compras</h2>
          <p className="text-xs text-muted-foreground">
            Planea lo que tienes que comprar y llévalo en el bolsillo.
          </p>
        </div>
        <Button
          type="button"
          className="hidden h-9 rounded-xl sm:inline-flex"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Nuevo carrito
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <PantryMetricTile
          icon={ListChecks}
          label="Carritos en curso"
          value={String(metrics.cartsCount)}
          accent="sky"
        />
        <PantryMetricTile
          icon={CheckCircle2}
          label="Por comprar"
          value={String(metrics.itemsPending)}
          accent="amber"
        />
        <PantryMetricTile
          icon={Wallet}
          label="Estimado"
          value={formatCurrency(metrics.estimated)}
          accent="emerald"
        />
        <PantryMetricTile
          icon={Clock}
          label="Última actividad"
          value={formatRelative(metrics.lastUpdated)}
          accent="slate"
        />
      </div>

      <div
        className="flex gap-2 overflow-x-auto pb-1"
        role="tablist"
        aria-label="Filtro por estado"
      >
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              'h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors',
              filter === f.value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border/60 bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            {f.label} ({filterCounts[f.value]})
          </button>
        ))}
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-12 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : carts.length === 0 ? (
        <EmptyState
          message="Aún no tienes carritos en este filtro."
          description="Crea una lista para planear tu próxima compra."
          action={{
            label: 'Nuevo carrito',
            onClick: () => setCreateOpen(true),
          }}
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {carts.map((cart) => (
            <li key={cart.id}>
              <PantryShoppingCartCard cart={cart} href={hrefFor(cart.id)} />
            </li>
          ))}
        </ul>
      )}

      <Button
        type="button"
        size="icon"
        aria-label="Nuevo carrito"
        className="fixed bottom-6 right-6 z-30 h-14 w-14 rounded-full shadow-lg sm:hidden"
        onClick={() => setCreateOpen(true)}
      >
        <Plus className="h-6 w-6" />
      </Button>

      <CreateCartSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
      />
    </PantryLayoutShell>
  );
}
