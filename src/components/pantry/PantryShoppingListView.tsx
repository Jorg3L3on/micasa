'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import EmptyState from '@/components/EmptyState';
import { PantryLayoutShell } from '@/components/pantry/PantryLayoutShell';
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

export default function PantryShoppingListView() {
  const { context } = useFinanceContext();
  const [carts, setCarts] = useState<PantryShoppingCartSummaryDto[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('IN_PROGRESS');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const loadList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listShoppingCarts(context, filter);
      setCarts(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar los carritos');
    } finally {
      setLoading(false);
    }
  }, [context, filter]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

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

  const handleCreate = async (data: { title: string; notes: string | null }) => {
    const created = await createShoppingCart(data, context);
    toast.success('Carrito creado');
    setCreateOpen(false);
    setCarts((prev) => [
      {
        id: created.id,
        title: created.title,
        notes: created.notes,
        status: created.status,
        currency: created.currency,
        created_by: created.created_by,
        updated_by: created.updated_by,
        created_at: created.created_at,
        updated_at: created.updated_at,
        totals: created.totals,
      },
      ...prev,
    ]);
  };

  return (
    <PantryLayoutShell
      className="flex flex-col gap-4 pb-24"
      role="region"
      aria-label="Listas de compras"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
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

      <div
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
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
            {f.label}
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
        <ul className="flex flex-col gap-3">
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
