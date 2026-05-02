'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Package,
  Receipt,
  Sparkles,
} from 'lucide-react';

import { PantryProductListRow } from '@/components/pantry/PantryProductListRow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import EmptyState from '@/components/EmptyState';
import { PantryLayoutShell } from '@/components/pantry/PantryLayoutShell';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import { PantryProductForm } from '@/components/pantry/PantryProductForm';
import { useFinanceContext } from '@/context/finance-context';
import {
  createPantryProduct,
  deletePantryProduct,
  listPantryProducts,
  patchPantryProduct,
} from '@/lib/api/pantry';
import { cn } from '@/lib/utils';
import type {
  CreatePantryProductInput,
  PantryProductFormValues,
  PatchPantryProductInput,
} from '@/schemas/pantry-product.schema';
import type { PantryProductDto } from '@/types/pantry-product';

const formValuesToCreateBody = (
  v: PantryProductFormValues,
): CreatePantryProductInput => {
  const raw = v.default_unit_price?.trim().replace(',', '.') ?? '';
  let default_unit_price: number | null | undefined;
  if (raw === '') {
    default_unit_price = null;
  } else {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      throw new Error('Precio de referencia inválido');
    }
    default_unit_price = Math.round(n * 100) / 100;
  }
  return {
    name: v.name.trim(),
    description: v.description?.trim() ? v.description.trim() : null,
    brand: v.brand?.trim() ? v.brand.trim() : null,
    barcode: v.barcode?.trim() ? v.barcode.trim() : null,
    unit_label: v.unit_label?.trim() ? v.unit_label.trim() : null,
    default_unit_price,
    active: v.active,
  };
};

const formValuesToPatchBody = (
  v: PantryProductFormValues,
): PatchPantryProductInput => formValuesToCreateBody(v);

const productToFormDefaults = (p: PantryProductDto): PantryProductFormValues => ({
  name: p.name,
  description: p.description ?? '',
  barcode: p.barcode ?? '',
  brand: p.brand ?? '',
  unit_label: p.unit_label ?? '',
  default_unit_price:
    p.default_unit_price != null ? String(p.default_unit_price) : '',
  active: p.active,
});

export default function PantryProductsPage() {
  const { context } = useFinanceContext();
  const [products, setProducts] = useState<PantryProductDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<PantryProductDto | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const PRODUCTS_PAGE_SIZE = 10;
  const [productSearch, setProductSearch] = useState('');
  const [productPageIndex, setProductPageIndex] = useState(0);

  const loadList = useCallback(async () => {
    try {
      setLoading(true);
      setListError(null);
      const data = await listPantryProducts(context);
      setProducts(data);
    } catch (e) {
      setListError(
        e instanceof Error ? e.message : 'Error al cargar los productos',
      );
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const handleCreate = async (data: PantryProductFormValues) => {
    try {
      setFormError(null);
      const body = formValuesToCreateBody(data);
      await createPantryProduct(body, context);
      toast.success('Producto creado');
      await loadList();
      setCreateOpen(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al crear el producto';
      setFormError(message);
      throw err;
    }
  };

  const handleEdit = async (data: PantryProductFormValues) => {
    if (!selected) return;
    try {
      setFormError(null);
      const body = formValuesToPatchBody(data);
      await patchPantryProduct(selected.id, body, context);
      toast.success('Producto actualizado');
      await loadList();
      setEditOpen(false);
      setSelected(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al actualizar el producto';
      setFormError(message);
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    try {
      await deletePantryProduct(selected.id, context);
      toast.success('Producto eliminado');
      await loadList();
      setDeleteOpen(false);
      setSelected(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'No se pudo eliminar el producto',
      );
    }
  };

  const openEdit = useCallback((p: PantryProductDto) => {
    setSelected(p);
    setFormError(null);
    setEditOpen(true);
  }, []);

  const openDelete = useCallback((p: PantryProductDto) => {
    setSelected(p);
    setDeleteOpen(true);
  }, []);

  const ownerQuery = useMemo(() => {
    const q = new URLSearchParams();
    q.set('ownerType', context.type);
    q.set('ownerId', String(context.id));
    return q.toString();
  }, [context.id, context.type]);
  const receiptsHref = ownerQuery ? `/pantry/receipts?${ownerQuery}` : '/pantry/receipts';
  const insightsHref = ownerQuery ? `/pantry?${ownerQuery}` : '/pantry';

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, productSearch]);

  const productPageCount = Math.max(
    1,
    Math.ceil(filteredProducts.length / PRODUCTS_PAGE_SIZE),
  );

  const paginatedProducts = useMemo(() => {
    const start = productPageIndex * PRODUCTS_PAGE_SIZE;
    return filteredProducts.slice(start, start + PRODUCTS_PAGE_SIZE);
  }, [filteredProducts, productPageIndex]);

  useEffect(() => {
    setProductPageIndex(0);
  }, [productSearch]);

  useEffect(() => {
    const maxIdx = Math.max(0, productPageCount - 1);
    setProductPageIndex((i) => Math.min(i, maxIdx));
  }, [productPageCount, filteredProducts.length]);

  const stats = useMemo(() => {
    const activeCount = products.filter((p) => p.active).length;
    const pricedCount = products.filter((p) => p.default_unit_price != null).length;
    const brandedCount = products.filter((p) => Boolean(p.brand)).length;
    return {
      total: products.length,
      activeCount,
      pricedCount,
      brandedCount,
    };
  }, [products]);

  return (
    <PantryLayoutShell
      className="flex flex-col gap-5"
      role="region"
      aria-label="Catálogo de productos de despensa"
    >
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" size="sm" className="h-9 rounded-lg" asChild>
          <Link href={receiptsHref}>
            <Receipt className="h-4 w-4" />
            Recibos
          </Link>
        </Button>
        <Button variant="outline" size="sm" className="h-9 rounded-lg" asChild>
          <Link href={insightsHref}>
            <Sparkles className="h-4 w-4" />
            Ver insights
          </Link>
        </Button>
      </div>

      <section
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Resumen del catálogo de productos"
      >
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Productos
          </p>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums">
            {stats.total.toLocaleString('es-MX')}
          </p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Activos
          </p>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {stats.activeCount.toLocaleString('es-MX')}
          </p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Con precio referencia
          </p>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums">
            {stats.pricedCount.toLocaleString('es-MX')}
          </p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Con marca
          </p>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums">
            {stats.brandedCount.toLocaleString('es-MX')}
          </p>
        </div>
      </section>

      <Card
        className={cn(
          'overflow-hidden border-border/60 transition-shadow duration-200 hover:shadow-md',
        )}
      >
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
          <div className="flex min-w-0 flex-1 flex-row items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 dark:bg-sky-500/15">
              <Package className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
            </span>
            <div className="min-w-0 flex flex-col gap-0.5">
              <CardTitle className="text-sm font-semibold leading-none">
                Productos
              </CardTitle>
              <p className="text-[10px] text-muted-foreground">
                Catálogo por contexto (personal o casa).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-[10px] font-semibold tabular-nums text-muted-foreground">
              {stats.total.toLocaleString('es-MX')}
            </span>
            <Button
              type="button"
              className="rounded-xl shrink-0"
              onClick={() => {
                setFormError(null);
                setCreateOpen(true);
              }}
            >
              Agregar producto
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {listError ? (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{listError}</AlertDescription>
            </Alert>
          ) : null}
          {loading ? (
            <div
              className="flex justify-center py-12 text-muted-foreground"
              role="status"
              aria-label="Cargando productos"
            >
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : products.length === 0 ? (
            <EmptyState
              message="Aún no hay productos en este contexto."
              description="Crea productos para ahorrar tiempo al importar recibos y mantener nombres consistentes."
              action={{
                label: 'Agregar producto',
                onClick: () => {
                  setFormError(null);
                  setCreateOpen(true);
                },
              }}
            />
          ) : (
            <div className="w-full min-w-0 space-y-4">
              <Input
                placeholder="Buscar producto…"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="max-w-full sm:max-w-xs"
                aria-label="Buscar producto…"
              />
              {filteredProducts.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Sin resultados.
                </p>
              ) : (
                <>
                  <ul
                    role="list"
                    className="flex flex-col gap-2"
                    aria-label="Lista de productos"
                  >
                    {paginatedProducts.map((product) => (
                      <PantryProductListRow
                        key={product.id}
                        product={product}
                        onOpenEdit={() => openEdit(product)}
                        onOpenDelete={() => openDelete(product)}
                      />
                    ))}
                  </ul>
                  {productPageCount > 1 ? (
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-muted-foreground">
                        Página {productPageIndex + 1} de {productPageCount} (
                        {filteredProducts.length}{' '}
                        {filteredProducts.length === 1 ? 'producto' : 'productos'})
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={productPageIndex <= 0}
                          onClick={() =>
                            setProductPageIndex((p) => Math.max(0, p - 1))
                          }
                          aria-label="Página anterior"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={productPageIndex >= productPageCount - 1}
                          onClick={() =>
                            setProductPageIndex((p) =>
                              Math.min(productPageCount - 1, p + 1),
                            )
                          }
                          aria-label="Página siguiente"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <PantryProductForm
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          setFormError(null);
        }}
        onSubmit={handleCreate}
        mode="create"
        error={formError && createOpen ? formError : null}
      />

      {selected ? (
        <>
          <PantryProductForm
            open={editOpen}
            onOpenChange={(open) => {
              setEditOpen(open);
              if (!open) setSelected(null);
              setFormError(null);
            }}
            onSubmit={handleEdit}
            mode="edit"
            defaultValues={productToFormDefaults(selected)}
            error={formError && editOpen ? formError : null}
          />

          <ConfirmDeleteDialog
            open={deleteOpen}
            onOpenChange={(open) => {
              setDeleteOpen(open);
              if (!open) setSelected(null);
            }}
            onConfirm={handleDelete}
            title="Eliminar producto"
            description="¿Eliminar este producto del catálogo? No afecta recibos ya guardados."
            itemName={selected.name}
          />
        </>
      ) : null}
    </PantryLayoutShell>
  );
}
