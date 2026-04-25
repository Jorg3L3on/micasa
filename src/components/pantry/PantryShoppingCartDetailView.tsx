'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  History,
  Loader2,
  MoreVertical,
  Pencil,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PantryLayoutShell } from '@/components/pantry/PantryLayoutShell';
import { PantryShoppingAddBar } from '@/components/pantry/PantryShoppingAddBar';
import {
  PantryShoppingCartActivityDrawer,
} from '@/components/pantry/PantryShoppingCartActivityDrawer';
import {
  PantryShoppingItemEditSheet,
  type EditItemInput,
} from '@/components/pantry/PantryShoppingItemEditSheet';
import { PantryShoppingItemRow } from '@/components/pantry/PantryShoppingItemRow';
import { ShoppingCartStatusBadge } from '@/components/pantry/PantryShoppingCartCard';
import { CreateCartSheet } from '@/components/pantry/CreateCartSheet';
import { useFinanceContext } from '@/context/finance-context';
import {
  deleteShoppingCart,
  deleteShoppingCartItem,
  getShoppingCart,
  listPantryProducts,
  updateShoppingCart,
  updateShoppingCartItem,
  updateShoppingCartStatus,
} from '@/lib/api';
import { cn, formatCurrency } from '@/lib/utils';
import type { PantryProductDto } from '@/types/pantry-product';
import type {
  PantryShoppingCartDetailDto,
  PantryShoppingCartItemDto,
  ShoppingCartStatus,
} from '@/types/pantry-shopping-cart';

type Props = { cartId: number };

const STATUS_OPTIONS: { value: ShoppingCartStatus; label: string }[] = [
  { value: 'IN_PROGRESS', label: 'En curso' },
  { value: 'BOUGHT', label: 'Comprado' },
  { value: 'CANCELED', label: 'Cancelado' },
  { value: 'ARCHIVED', label: 'Archivado' },
];

export default function PantryShoppingCartDetailView({ cartId }: Props) {
  const router = useRouter();
  const { context } = useFinanceContext();

  const [cart, setCart] = useState<PantryShoppingCartDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<PantryProductDto[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<PantryShoppingCartItemDto | null>(
    null,
  );
  const [activityOpen, setActivityOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PantryShoppingCartItemDto | null>(
    null,
  );

  const ownerQuery = useMemo(() => {
    const q = new URLSearchParams();
    q.set('ownerType', context.type);
    q.set('ownerId', String(context.id));
    return q.toString();
  }, [context.id, context.type]);
  const backHref = ownerQuery
    ? `/pantry/shopping?${ownerQuery}`
    : '/pantry/shopping';

  const loadCart = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getShoppingCart(cartId, context);
      setCart(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar el carrito');
    } finally {
      setLoading(false);
    }
  }, [cartId, context]);

  const loadProducts = useCallback(async () => {
    try {
      setProductsLoading(true);
      const data = await listPantryProducts(context);
      setProducts(data);
    } catch {
      // non-fatal; add-bar still works with free text
    } finally {
      setProductsLoading(false);
    }
  }, [context]);

  useEffect(() => {
    void loadCart();
    void loadProducts();
  }, [loadCart, loadProducts]);

  const readOnly = cart
    ? cart.status === 'CANCELED' || cart.status === 'ARCHIVED'
    : false;

  const updateItemLocal = (next: PantryShoppingCartItemDto) => {
    setCart((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((i) => (i.id === next.id ? next : i)),
            totals: recomputeTotals(
              prev.items.map((i) => (i.id === next.id ? next : i)),
            ),
          }
        : prev,
    );
  };

  const handleToggleChecked = async (
    item: PantryShoppingCartItemDto,
    checked: boolean,
  ) => {
    updateItemLocal({ ...item, checked });
    try {
      const updated = await updateShoppingCartItem(
        cartId,
        item.id,
        { checked },
        context,
      );
      updateItemLocal(updated);
    } catch (err) {
      updateItemLocal(item);
      toast.error(
        err instanceof Error ? err.message : 'No se pudo actualizar',
      );
    }
  };

  const handleEditItem = async (input: EditItemInput) => {
    if (!selectedItem) return;
    const updated = await updateShoppingCartItem(
      cartId,
      selectedItem.id,
      input,
      context,
    );
    updateItemLocal(updated);
    toast.success('Ítem actualizado');
    setEditOpen(false);
    setSelectedItem(null);
  };

  const handleDeleteItem = async () => {
    if (!deleteItem) return;
    try {
      await deleteShoppingCartItem(cartId, deleteItem.id, context);
      setCart((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.filter((i) => i.id !== deleteItem.id),
              totals: recomputeTotals(
                prev.items.filter((i) => i.id !== deleteItem.id),
              ),
            }
          : prev,
      );
      toast.success('Ítem eliminado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo eliminar');
    } finally {
      setDeleteItem(null);
    }
  };

  const handleStatusChange = async (status: ShoppingCartStatus) => {
    try {
      const updated = await updateShoppingCartStatus(cartId, status, context);
      setCart(updated);
      toast.success('Estado actualizado');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'No se pudo actualizar',
      );
    }
  };

  const handleRename = async (data: { title: string; notes: string | null }) => {
    const updated = await updateShoppingCart(cartId, data, context);
    setCart(updated);
    toast.success('Carrito actualizado');
    setRenameOpen(false);
  };

  const handleDeleteCart = async () => {
    try {
      await deleteShoppingCart(cartId, context);
      toast.success('Carrito eliminado');
      router.push(backHref);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo eliminar');
    }
  };

  if (loading) {
    return (
      <PantryLayoutShell className="flex justify-center py-12 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </PantryLayoutShell>
    );
  }

  if (error || !cart) {
    return (
      <PantryLayoutShell className="flex flex-col gap-3">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error ?? 'Carrito no disponible'}</AlertDescription>
        </Alert>
        <Button variant="outline" asChild>
          <Link href={backHref}>Volver</Link>
        </Button>
      </PantryLayoutShell>
    );
  }

  return (
    <PantryLayoutShell className="flex flex-col gap-3 pb-28">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          asChild
        >
          <Link href={backHref} aria-label="Volver">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            className="block w-full truncate text-left text-base font-semibold leading-tight"
            onClick={() => setRenameOpen(true)}
            aria-label="Renombrar carrito"
          >
            {cart.title}
          </button>
          <p className="truncate text-xs text-muted-foreground">
            Creado por {cart.created_by.name}
            {cart.updated_by ? ` · últ. ${cart.updated_by.name}` : ''}
          </p>
        </div>
        <ShoppingCartStatusBadge status={cart.status} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              aria-label="Más"
            >
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {STATUS_OPTIONS.map((s) => (
              <DropdownMenuItem
                key={s.value}
                onClick={() => handleStatusChange(s.value)}
                disabled={cart.status === s.value}
              >
                <span
                  className={cn(
                    'text-sm',
                    cart.status === s.value && 'font-semibold',
                  )}
                >
                  {s.label}
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setRenameOpen(true)}>
              <Pencil className="h-4 w-4" />
              Renombrar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setActivityOpen(true)}>
              <History className="h-4 w-4" />
              Movimientos
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              Eliminar carrito
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {cart.notes ? (
        <p className="rounded-lg border border-border/60 bg-card px-3 py-2 text-xs text-muted-foreground">
          {cart.notes}
        </p>
      ) : null}

      <PantryShoppingAddBar
        cartId={cart.id}
        products={products}
        productsLoading={productsLoading}
        onItemAdded={(item) =>
          setCart((prev) =>
            prev
              ? {
                  ...prev,
                  items: [...prev.items, item],
                  totals: recomputeTotals([...prev.items, item]),
                }
              : prev,
          )
        }
        onProductCreated={(p) => setProducts((prev) => [p, ...prev])}
        disabled={readOnly}
      />

      {readOnly ? (
        <Alert>
          <AlertTitle>Solo lectura</AlertTitle>
          <AlertDescription>
            Este carrito está {cart.status === 'CANCELED' ? 'cancelado' : 'archivado'}.
            Cambia el estado desde el menú para editarlo.
          </AlertDescription>
        </Alert>
      ) : null}

      {cart.items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Aún no hay ítems. Empieza a agregar arriba ↑
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {cart.items.map((item) => (
            <li key={item.id}>
              <PantryShoppingItemRow
                item={item}
                onToggleChecked={(checked) =>
                  void handleToggleChecked(item, checked)
                }
                onEdit={() => {
                  setSelectedItem(item);
                  setEditOpen(true);
                }}
                onDelete={() => setDeleteItem(item)}
                disabled={readOnly}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex max-w-screen-md items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-muted-foreground">
              {cart.totals.checked_count}/{cart.totals.items_count} comprados
            </p>
            <p className="font-mono text-base font-semibold tabular-nums">
              {formatCurrency(cart.totals.estimated_total)}
            </p>
          </div>
          {cart.status !== 'BOUGHT' ? (
            <Button
              type="button"
              className="h-11 rounded-xl"
              onClick={() => handleStatusChange('BOUGHT')}
              disabled={cart.items.length === 0}
            >
              Marcar comprado
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl"
              onClick={() => handleStatusChange('IN_PROGRESS')}
            >
              Reanudar
            </Button>
          )}
        </div>
      </div>

      <PantryShoppingItemEditSheet
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o);
          if (!o) setSelectedItem(null);
        }}
        item={selectedItem}
        onSubmit={handleEditItem}
      />

      <CreateCartSheet
        open={renameOpen}
        onOpenChange={setRenameOpen}
        onSubmit={handleRename}
      />

      <PantryShoppingCartActivityDrawer
        open={activityOpen}
        onOpenChange={setActivityOpen}
        cartId={cart.id}
      />

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDeleteCart}
        title="Eliminar carrito"
        description="Se eliminará junto con todos sus ítems."
        itemName={cart.title}
      />

      {deleteItem ? (
        <ConfirmDeleteDialog
          open={Boolean(deleteItem)}
          onOpenChange={(o) => {
            if (!o) setDeleteItem(null);
          }}
          onConfirm={handleDeleteItem}
          title="Eliminar ítem"
          description="Esta acción no se puede deshacer."
          itemName={deleteItem.name}
        />
      ) : null}
    </PantryLayoutShell>
  );
}

function recomputeTotals(items: PantryShoppingCartItemDto[]) {
  const estimated_total =
    Math.round(items.reduce((acc, i) => acc + i.line_total, 0) * 100) / 100;
  return {
    items_count: items.length,
    checked_count: items.filter((i) => i.checked).length,
    estimated_total,
  };
}
