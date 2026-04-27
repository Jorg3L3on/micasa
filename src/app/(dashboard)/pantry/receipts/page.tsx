'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Download,
  FileText,
  FileUp,
  Loader2,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';

import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import EmptyState from '@/components/EmptyState';
import { PantryLayoutShell } from '@/components/pantry/PantryLayoutShell';
import { useFinanceContext } from '@/context/finance-context';
import {
  buildOwnerQuery,
  checkAllShoppingCartItems,
  deletePantryReceipt,
  patchPantryReceipt,
  listShoppingCarts,
  listPantryReceipts,
  getClientApiBaseUrl,
  updateShoppingCartStatus,
  updateShoppingCart,
  uploadPantryReceipt,
} from '@/lib/api';
import { cn, formatCurrency } from '@/lib/utils';
import type { PantryReceiptListItemDto } from '@/types/pantry-receipt';
import type { PantryShoppingCartSummaryDto } from '@/types/pantry-shopping-cart';
import {
  SHOPPING_STORE_OPTIONS,
  SHOPPING_STORE_LABELS,
  type ShoppingStore,
} from '@/types/shopping-store';

const formatShortDate = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const getReceiptDisplayTotal = (receipt: PantryReceiptListItemDto): number =>
  receipt.grand_total ?? receipt.lines_sum;

export default function PantryReceiptsPage() {
  const router = useRouter();
  const { context } = useFinanceContext();
  const [receipts, setReceipts] = useState<PantryReceiptListItemDto[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [storeFile, setStoreFile] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadPurchasedAt, setUploadPurchasedAt] = useState('');
  const [uploadStore, setUploadStore] = useState<ShoppingStore | null>(null);
  const [cartsLoading, setCartsLoading] = useState(false);
  const [inProgressCarts, setInProgressCarts] = useState<
    PantryShoppingCartSummaryDto[]
  >([]);
  const [linkCartOnImport, setLinkCartOnImport] = useState(false);
  const [cartLinkMode, setCartLinkMode] = useState<'existing' | 'new'>('existing');
  const [selectedCartId, setSelectedCartId] = useState<number | null>(null);
  const [newCartTitle, setNewCartTitle] = useState('');
  const [downloadingReceiptId, setDownloadingReceiptId] = useState<number | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<PantryReceiptListItemDto | null>(
    null,
  );

  const receiptDetailHref = useCallback(
    (id: number) => {
      const q = buildOwnerQuery(context).toString();
      return q
        ? `/pantry/receipts/${id}?${q}`
        : `/pantry/receipts/${id}`;
    },
    [context],
  );

  const loadList = useCallback(async () => {
    try {
      setLoadingList(true);
      setListError(null);
      const data = await listPantryReceipts(context);
      setReceipts(data);
    } catch (e) {
      setListError(
        e instanceof Error ? e.message : 'Error al cargar los recibos',
      );
    } finally {
      setLoadingList(false);
    }
  }, [context]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const resetUploadForm = () => {
    setSelectedFile(null);
    setUploadTitle('');
    setUploadPurchasedAt('');
    setUploadStore(null);
    setLinkCartOnImport(false);
    setCartLinkMode('existing');
    setSelectedCartId(null);
    setNewCartTitle('');
    setStoreFile(false);
  };

  const handleOpenUpload = async () => {
    setUploadOpen(true);
    try {
      setCartsLoading(true);
      const carts = await listShoppingCarts(context, 'IN_PROGRESS');
      setInProgressCarts(carts);
    } catch {
      setInProgressCarts([]);
    } finally {
      setCartsLoading(false);
    }
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile) {
      toast.error('Selecciona un archivo');
      return;
    }
    if (!uploadPurchasedAt.trim()) {
      toast.error('La fecha de compra es obligatoria');
      return;
    }
    if (linkCartOnImport && cartLinkMode === 'existing' && selectedCartId == null) {
      toast.error('Selecciona un carrito en curso');
      return;
    }
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('storeFile', storeFile ? 'true' : 'false');
    if (uploadTitle.trim()) formData.append('title', uploadTitle.trim());
    formData.append('purchased_at', uploadPurchasedAt.trim());
    if (uploadStore) formData.append('store', uploadStore);
    if (linkCartOnImport && cartLinkMode === 'new') {
      formData.append('cartMode', 'new');
      if (newCartTitle.trim()) {
        formData.append('newCartTitle', newCartTitle.trim());
      }
    }
    try {
      setUploading(true);
      const created = await uploadPantryReceipt(formData, context);
      toast.success('Recibo guardado');
      if (linkCartOnImport && cartLinkMode === 'existing' && selectedCartId != null) {
        try {
          await checkAllShoppingCartItems(selectedCartId, context);
          await updateShoppingCartStatus(selectedCartId, 'BOUGHT', context);
          if (uploadStore) {
            await updateShoppingCart(selectedCartId, { store: uploadStore }, context);
          }
          await patchPantryReceipt(
            created.id,
            { linked_cart_id: selectedCartId },
            context,
          );
          toast.success('Carrito marcado como comprado');
        } catch (statusErr) {
          toast.error(
            statusErr instanceof Error
              ? statusErr.message
              : 'No se pudo actualizar el carrito',
          );
        }
      }
      if (linkCartOnImport && cartLinkMode === 'new') {
        const importedLineCount = created.lines.filter(
          (line) => line.description.trim().length > 0,
        ).length;
        toast.success(
          `Carrito nuevo creado como comprado (${importedLineCount} ítems)`,
        );
      }
      setUploadOpen(false);
      resetUploadForm();
      await loadList();
      if (created.parse_warnings.length > 0) {
        toast.message('Avisos del archivo', {
          description: created.parse_warnings.join(' '),
        });
      }
      router.push(receiptDetailHref(created.id));
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'No se pudo subir el recibo',
      );
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deletePantryReceipt(deleteTarget.id, context);
      toast.success('Recibo eliminado');
      setDeleteTarget(null);
      await loadList();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'No se pudo eliminar el recibo',
      );
    }
  };

  const handleDownloadFromList = useCallback(
    async (receipt: PantryReceiptListItemDto) => {
      if (!receipt.file_name) return;
      setDownloadingReceiptId(receipt.id);
      const query = buildOwnerQuery(context).toString();
      const url = `${getClientApiBaseUrl()}/api/pantry/receipts/${receipt.id}/file${query ? `?${query}` : ''}`;
      try {
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) throw new Error('No se pudo descargar el archivo');
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = receipt.file_name ?? 'recibo';
        a.click();
        URL.revokeObjectURL(a.href);
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : 'No se pudo descargar el archivo',
        );
      } finally {
        setDownloadingReceiptId(null);
      }
    },
    [context],
  );

  const listColumns = useMemo<ColumnDef<PantryReceiptListItemDto>[]>(
    () => [
      {
        accessorKey: 'title',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Recibo" />
        ),
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">
              {row.original.title ?? 'Sin título'}
            </span>
            {row.original.parse_warnings.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                Avisos al importar
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'purchased_at',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Compra" />
        ),
        cell: ({ row }) => (
          <span className="text-sm font-mono tabular-nums text-muted-foreground">
            {formatShortDate(row.original.purchased_at)}
          </span>
        ),
      },
      {
        accessorKey: 'store',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Tienda" />
        ),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.store ? SHOPPING_STORE_LABELS[row.original.store] : '—'}
          </span>
        ),
      },
      {
        accessorKey: 'line_count',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Ítems" />
        ),
        cell: ({ row }) => (
          <span className="text-sm font-mono tabular-nums">
            {row.original.line_count}
          </span>
        ),
      },
      {
        accessorKey: 'lines_sum',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Suma líneas" />
        ),
        cell: ({ row }) => (
          <span className="text-sm font-mono tabular-nums">
            {formatCurrency(row.original.lines_sum)}
          </span>
        ),
      },
      {
        accessorKey: 'grand_total',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Total recibo" />
        ),
        cell: ({ row }) => {
          const total = getReceiptDisplayTotal(row.original);
          return (
            <span className="text-sm font-bold font-mono tabular-nums">
              {formatCurrency(total)}
            </span>
          );
        },
      },
      {
        id: 'file',
        header: () => <span className="sr-only">Archivo</span>,
        cell: ({ row }) => (
          <div
            className="flex justify-center"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {row.original.file_name ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Descargar archivo del recibo"
                disabled={downloadingReceiptId === row.original.id}
                onClick={() => void handleDownloadFromList(row.original)}
              >
                {downloadingReceiptId === row.original.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </div>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Acciones</span>,
        cell: ({ row }) => (
          <div
            className="flex justify-end"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Acciones del recibo"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setDeleteTarget(row.original)}
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar recibo
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [downloadingReceiptId, handleDownloadFromList, setDeleteTarget],
  );

  const stats = useMemo(() => {
    const receiptCount = receipts.length;
    const totalGrand = receipts.reduce(
      (acc, r) => acc + getReceiptDisplayTotal(r),
      0,
    );
    const latestPurchasedAt = receipts.reduce<string | null>((latest, r) => {
      if (!r.purchased_at) return latest;
      if (!latest) return r.purchased_at;
      return r.purchased_at > latest ? r.purchased_at : latest;
    }, null);
    return {
      receiptCount,
      totalGrand,
      latestPurchasedAt,
    };
  }, [receipts]);

  return (
    <PantryLayoutShell
      className="flex flex-col gap-5"
      role="region"
      aria-label="Recibos de despensa"
    >
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          size="sm"
          className="h-9 rounded-lg"
          onClick={() => void handleOpenUpload()}
        >
          <FileUp className="h-4 w-4" />
          Importar archivo
        </Button>
      </div>

      <section
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Resumen de recibos"
      >
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Recibos
          </p>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums">
            {stats.receiptCount.toLocaleString('es-MX')}
          </p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Total acumulado
          </p>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums">
            {formatCurrency(stats.totalGrand)}
          </p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Última compra
          </p>
          <p className="mt-1 text-base font-semibold text-foreground">
            {formatShortDate(stats.latestPurchasedAt)}
          </p>
        </div>
      </section>

      <Card
        className={cn(
          'overflow-hidden border-border/60 border-l-[3px] border-l-violet-500/45 transition-shadow duration-200 hover:shadow-md',
        )}
      >
        <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10 dark:bg-violet-500/15">
            <FileText className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
          </span>
          <div className="flex flex-1 flex-col gap-0.5">
            <CardTitle className="text-sm font-semibold leading-none">
              Recibos guardados
            </CardTitle>
            <p className="text-[10px] text-muted-foreground">
              Haz clic en una fila para abrir el detalle en otra página.
            </p>
          </div>
          <span className="rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-[10px] font-semibold tabular-nums text-muted-foreground">
            {stats.receiptCount.toLocaleString('es-MX')}
          </span>
        </CardHeader>
        <CardContent>
          {listError && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{listError}</AlertDescription>
            </Alert>
          )}
          {loadingList ? (
            <div className="flex justify-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : receipts.length === 0 ? (
            <EmptyState
              message="Aún no hay recibos en este contexto."
              description="Sube tu primer archivo para comenzar a ver comparativas y tendencias."
            />
          ) : (
            <DataTable
              data={receipts}
              columns={listColumns}
              filterColumn="title"
              filterPlaceholder="Buscar recibo…"
              pagination
              columnVisibility
              emptyMessage="Sin resultados."
              onRowClick={(row) => router.push(receiptDetailHref(row.id))}
            />
          )}
        </CardContent>
      </Card>

      <Dialog
        open={uploadOpen}
        onOpenChange={(open) => {
          setUploadOpen(open);
          if (!open && !uploading) resetUploadForm();
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Importar recibo</DialogTitle>
            <DialogDescription>
              La fecha de compra es obligatoria. Puedes elegir si quieres vincular un
              carrito en curso o crear uno nuevo como comprado.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="upload-file">Archivo</Label>
              <Input
                id="upload-file"
                type="file"
                accept=".pdf,.csv,.txt,application/pdf,text/csv,text/plain"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-[11px] text-muted-foreground">
                PDF con texto, CSV o TXT.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="receipt-date-required">Fecha de compra *</Label>
                <Input
                  id="receipt-date-required"
                  type="date"
                  value={uploadPurchasedAt}
                  onChange={(e) => setUploadPurchasedAt(e.target.value)}
                  className="h-9"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="receipt-title-modal">Título (opcional)</Label>
                <Input
                  id="receipt-title-modal"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Ej. Compra quincenal"
                  className="h-9"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Tienda (opcional)</Label>
                <Select
                  value={uploadStore ?? '__NONE__'}
                  onValueChange={(value) =>
                    setUploadStore(value === '__NONE__' ? null : (value as ShoppingStore))
                  }
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Sin tienda" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__NONE__">Sin tienda</SelectItem>
                    {SHOPPING_STORE_OPTIONS.map((store) => (
                      <SelectItem key={store.value} value={store.value}>
                        {store.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="sr-only">Opciones de carrito</Label>
              </div>
            </div>
            <div className="space-y-3 rounded-lg border border-border/60 p-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="link-cart-on-import"
                  checked={linkCartOnImport}
                  onCheckedChange={(v) => setLinkCartOnImport(v === true)}
                />
                <Label
                  htmlFor="link-cart-on-import"
                  className="text-sm font-normal leading-snug cursor-pointer"
                >
                  Vincular carrito al importar recibo
                </Label>
              </div>
              {linkCartOnImport && (
                <div className="grid gap-3">
                  <div className="space-y-1.5">
                    <Label>Acción de carrito</Label>
                    <Select
                      value={cartLinkMode}
                      onValueChange={(value) =>
                        setCartLinkMode(value as 'existing' | 'new')
                      }
                    >
                      <SelectTrigger className="h-9 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="existing">
                          Marcar carrito en curso como comprado
                        </SelectItem>
                        <SelectItem value="new">
                          Crear carrito nuevo como comprado
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {cartLinkMode === 'existing' ? (
                    <div className="space-y-1.5">
                      <Label>Carrito en curso *</Label>
                      <Select
                        value={selectedCartId != null ? String(selectedCartId) : '__NONE__'}
                        onValueChange={(value) =>
                          setSelectedCartId(value === '__NONE__' ? null : Number(value))
                        }
                        disabled={cartsLoading}
                      >
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue
                            placeholder={cartsLoading ? 'Cargando...' : 'Selecciona un carrito'}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__NONE__">Selecciona un carrito</SelectItem>
                          {inProgressCarts.map((cart) => (
                            <SelectItem key={cart.id} value={String(cart.id)}>
                              {cart.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Label htmlFor="new-cart-title">Título del nuevo carrito (opcional)</Label>
                      <Input
                        id="new-cart-title"
                        value={newCartTitle}
                        onChange={(e) => setNewCartTitle(e.target.value)}
                        placeholder="Si lo dejas vacío, se autogenera con el recibo"
                        className="h-9"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="store-file-modal"
                checked={storeFile}
                onCheckedChange={(v) => setStoreFile(v === true)}
              />
              <Label
                htmlFor="store-file-modal"
                className="text-sm font-normal leading-snug cursor-pointer"
              >
                Guardar copia del archivo en MiCasa
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setUploadOpen(false);
                resetUploadForm();
              }}
              disabled={uploading}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleUploadSubmit()} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Importar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={handleConfirmDelete}
        title="¿Eliminar este recibo?"
        description="Se borrarán todas las líneas y el archivo asociado. Esta acción no se puede deshacer."
        itemName={deleteTarget?.title ?? undefined}
      />
    </PantryLayoutShell>
  );
}
