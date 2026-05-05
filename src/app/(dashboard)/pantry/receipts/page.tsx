'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  FileText,
  FileUp,
  Loader2,
  Receipt,
} from 'lucide-react';

import { PantryReceiptListRow } from '@/components/pantry/PantryReceiptListRow';
import { PantryMetricTile } from '@/components/pantry/PantryMetricTile';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import EmptyState from '@/components/EmptyState';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { PantryLayoutShell } from '@/components/pantry/PantryLayoutShell';
import { useFinanceContext } from '@/context/finance-context';
import {
  buildOwnerQuery,
  clientFetchFromApi,
  getClientApiBaseUrl,
} from '@/lib/api/client-fetch';
import { getPaymentMethodOptions } from '@/lib/api/wallets';
import {
  deletePantryReceipt,
  listPantryReceipts,
  patchPantryReceipt,
  reconcilePantryReceiptToCart,
  listShoppingCarts,
  updateShoppingCart,
  uploadPantryReceipt,
} from '@/lib/api/pantry';
import { cn, formatCurrency } from '@/lib/utils';
import type { CategoryOption, PaymentMethodOption } from '@/types/catalog';
import type { PantryReceiptListItemDto } from '@/types/pantry-receipt';
import type { PantryShoppingCartSummaryDto } from '@/types/pantry-shopping-cart';
import { SHOPPING_STORE_OPTIONS, type ShoppingStore } from '@/types/shopping-store';

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
  const [registerExpenseOnImport, setRegisterExpenseOnImport] = useState(false);
  const [expenseCatalogLoading, setExpenseCatalogLoading] = useState(false);
  const [expenseCategories, setExpenseCategories] = useState<CategoryOption[]>(
    [],
  );
  const [expenseWallets, setExpenseWallets] = useState<PaymentMethodOption[]>(
    [],
  );
  const [expenseCategoryId, setExpenseCategoryId] = useState<number | null>(
    null,
  );
  const [expenseWalletId, setExpenseWalletId] = useState<number | null>(null);
  const [expenseDate, setExpenseDate] = useState('');
  const [downloadingReceiptId, setDownloadingReceiptId] = useState<number | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<PantryReceiptListItemDto | null>(
    null,
  );

  const RECEIPTS_PAGE_SIZE = 10;
  const [receiptSearch, setReceiptSearch] = useState('');
  const [receiptPageIndex, setReceiptPageIndex] = useState(0);

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
    setRegisterExpenseOnImport(false);
    setExpenseCategoryId(null);
    setExpenseWalletId(null);
    setExpenseDate('');
    setStoreFile(false);
  };

  const handleOpenUpload = async () => {
    setUploadOpen(true);
    try {
      setCartsLoading(true);
      setExpenseCatalogLoading(true);
      const [carts, categoriesData, walletsData] = await Promise.all([
        listShoppingCarts(context, 'IN_PROGRESS'),
        clientFetchFromApi<CategoryOption[]>(
          '/api/categories',
          undefined,
          context,
        ),
        getPaymentMethodOptions(context),
      ]);
      setInProgressCarts(carts);
      setExpenseCategories(categoriesData);
      setExpenseWallets(walletsData);
    } catch {
      setInProgressCarts([]);
      setExpenseCategories([]);
      setExpenseWallets([]);
    } finally {
      setCartsLoading(false);
      setExpenseCatalogLoading(false);
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
    if (registerExpenseOnImport) {
      if (expenseCategoryId == null) {
        toast.error('Selecciona una categoría para el gasto');
        return;
      }
      if (expenseWalletId == null) {
        toast.error('Selecciona una cartera para el gasto');
        return;
      }
      if (!expenseDate.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(expenseDate.trim())) {
        toast.error('Indica la fecha del gasto');
        return;
      }
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
    if (registerExpenseOnImport) {
      formData.append('registerExpense', 'true');
      formData.append('expenseCategoryId', String(expenseCategoryId));
      formData.append('expenseWalletId', String(expenseWalletId));
      formData.append('expenseDate', expenseDate.trim());
    }
    try {
      setUploading(true);
      const created = await uploadPantryReceipt(formData, context);
      toast.success('Recibo guardado');
      if (linkCartOnImport && cartLinkMode === 'existing' && selectedCartId != null) {
        try {
          const reconcile = await reconcilePantryReceiptToCart(
            created.id,
            { cart_id: selectedCartId, apply: true },
            context,
          );
          if (uploadStore) {
            await updateShoppingCart(selectedCartId, { store: uploadStore }, context);
          }
          await patchPantryReceipt(
            created.id,
            { linked_cart_id: selectedCartId },
            context,
          );
          toast.success(
            `Reconciliación aplicada: ${reconcile.matched_count}/${reconcile.total_receipt_lines} líneas.`,
          );
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

  const filteredReceipts = useMemo(() => {
    const q = receiptSearch.trim().toLowerCase();
    if (!q) return receipts;
    return receipts.filter((r) => (r.title ?? '').toLowerCase().includes(q));
  }, [receipts, receiptSearch]);

  const receiptPageCount = Math.max(
    1,
    Math.ceil(filteredReceipts.length / RECEIPTS_PAGE_SIZE),
  );

  const paginatedReceipts = useMemo(() => {
    const start = receiptPageIndex * RECEIPTS_PAGE_SIZE;
    return filteredReceipts.slice(start, start + RECEIPTS_PAGE_SIZE);
  }, [filteredReceipts, receiptPageIndex]);

  useEffect(() => {
    setReceiptPageIndex(0);
  }, [receiptSearch]);

  useEffect(() => {
    const maxIdx = Math.max(0, receiptPageCount - 1);
    setReceiptPageIndex((i) => Math.min(i, maxIdx));
  }, [receiptPageCount, filteredReceipts.length]);

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

  const receiptSearchActive = Boolean(receiptSearch.trim());
  const savedListSubtitle = receiptSearchActive
    ? `Mostrando ${filteredReceipts.length.toLocaleString('es-MX')} de ${receipts.length.toLocaleString('es-MX')} recibos.`
    : 'Toca un recibo para abrir el detalle.';

  return (
    <PantryLayoutShell
      className="flex flex-col gap-5 pb-24"
      role="region"
      aria-label="Recibos de despensa"
    >
      <div className="sticky top-16 z-20 -mx-4 flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-background px-4 py-2 shadow-sm group-has-data-[collapsible=icon]/sidebar-wrapper:top-12">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-tight">Recibos</h2>
          <p className="text-xs text-muted-foreground">
            Recibos guardados y totales en este contexto.
          </p>
        </div>
        <Button
          type="button"
          className="hidden h-9 rounded-xl sm:inline-flex"
          onClick={() => void handleOpenUpload()}
        >
          <FileUp className="h-4 w-4" />
          Importar archivo
        </Button>
      </div>

      <section
        className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3"
        aria-label="Resumen de recibos"
      >
        <PantryMetricTile
          icon={Receipt}
          label="Recibos"
          value={stats.receiptCount.toLocaleString('es-MX')}
          accent="blue"
        />
        <PantryMetricTile
          icon={CircleDollarSign}
          label="Total acumulado"
          value={formatCurrency(stats.totalGrand)}
          accent="violet"
        />
        <PantryMetricTile
          icon={CalendarDays}
          label="Última compra"
          value={formatShortDate(stats.latestPurchasedAt)}
          accent="slate"
        />
      </section>

      <Card
        className={cn(
          'overflow-hidden border-border/60 transition-shadow duration-200 hover:shadow-md',
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
              {savedListSubtitle}
            </p>
          </div>
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
            <div className="w-full min-w-0 space-y-4">
              <Input
                placeholder="Buscar recibo…"
                value={receiptSearch}
                onChange={(e) => setReceiptSearch(e.target.value)}
                className="max-w-full sm:max-w-xs"
                aria-label="Buscar recibo…"
              />
              {filteredReceipts.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Sin resultados.
                </p>
              ) : (
                <>
                  <ul
                    role="list"
                    className="flex flex-col gap-2"
                    aria-label="Lista de recibos"
                  >
                    {paginatedReceipts.map((receipt) => (
                      <PantryReceiptListRow
                        key={receipt.id}
                        receipt={receipt}
                        downloading={downloadingReceiptId === receipt.id}
                        onOpenDetail={() =>
                          router.push(receiptDetailHref(receipt.id))
                        }
                        onDownload={() =>
                          void handleDownloadFromList(receipt)
                        }
                        onDelete={() => setDeleteTarget(receipt)}
                      />
                    ))}
                  </ul>
                  {receiptPageCount > 1 ? (
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-muted-foreground">
                        Página {receiptPageIndex + 1} de {receiptPageCount} (
                        {filteredReceipts.length}{' '}
                        {filteredReceipts.length === 1 ? 'recibo' : 'recibos'})
                      </p>
                      <div className="flex items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={receiptPageIndex <= 0}
                              onClick={() =>
                                setReceiptPageIndex((p) => Math.max(0, p - 1))
                              }
                              aria-label="Página anterior"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Página anterior</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={
                                receiptPageIndex >= receiptPageCount - 1
                              }
                              onClick={() =>
                                setReceiptPageIndex((p) =>
                                  Math.min(receiptPageCount - 1, p + 1),
                                )
                              }
                              aria-label="Página siguiente"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Página siguiente</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Button
        type="button"
        size="icon"
        aria-label="Importar archivo"
        className="fixed bottom-6 right-6 z-30 h-14 w-14 rounded-full shadow-lg sm:hidden"
        onClick={() => void handleOpenUpload()}
      >
        <FileUp className="h-6 w-6" />
      </Button>

      <Dialog
        open={uploadOpen}
        onOpenChange={(open) => {
          setUploadOpen(open);
          if (!open && !uploading) resetUploadForm();
        }}
      >
        <DialogContent
          className={cn(
            'flex w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden p-0',
            'max-h-[92dvh] sm:max-h-[min(90vh,920px)] sm:max-w-2xl',
          )}
        >
          <DialogHeader className="shrink-0 space-y-2 px-4 pb-2 pt-5 text-left sm:px-6 sm:pb-3 sm:pt-6 sm:text-left">
            <DialogTitle className="text-base sm:text-lg">Importar recibo</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              La fecha de compra es obligatoria. Opcionalmente vincula un carrito y registra
              el gasto en tus cuentas.
            </DialogDescription>
          </DialogHeader>

          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 pb-1 [-webkit-overflow-scrolling:touch] sm:px-6"
          >
          <div className="grid gap-4 pb-2">
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
                  className="h-11 min-h-11 sm:h-9 sm:min-h-9"
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
                  className="h-11 min-h-11 sm:h-9 sm:min-h-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Tienda (opcional)</Label>
              <Select
                value={uploadStore ?? '__NONE__'}
                onValueChange={(value) =>
                  setUploadStore(value === '__NONE__' ? null : (value as ShoppingStore))
                }
              >
                <SelectTrigger className="h-11 w-full min-h-11 sm:h-9 sm:min-h-9">
                  <SelectValue placeholder="Sin tienda" />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-[min(50dvh,280px)]">
                  <SelectItem value="__NONE__">Sin tienda</SelectItem>
                  {SHOPPING_STORE_OPTIONS.map((store) => (
                    <SelectItem key={store.value} value={store.value}>
                      {store.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3 rounded-lg border border-border/60 p-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="link-cart-on-import"
                  className="mt-0.5 shrink-0"
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
                      <SelectTrigger className="h-11 min-h-11 w-full sm:h-9 sm:min-h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper" className="max-h-[min(50dvh,280px)]">
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
                        <SelectTrigger className="h-11 min-h-11 w-full sm:h-9 sm:min-h-9">
                          <SelectValue
                            placeholder={cartsLoading ? 'Cargando...' : 'Selecciona un carrito'}
                          />
                        </SelectTrigger>
                        <SelectContent position="popper" className="max-h-[min(50dvh,280px)]">
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
                        className="h-11 min-h-11 sm:h-9 sm:min-h-9"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-3 rounded-lg border border-border/60 p-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="register-expense-on-import"
                  className="mt-0.5 shrink-0"
                  checked={registerExpenseOnImport}
                  onCheckedChange={(v) => {
                    const on = v === true;
                    setRegisterExpenseOnImport(on);
                    if (on && uploadPurchasedAt.trim()) {
                      setExpenseDate(uploadPurchasedAt.trim());
                    }
                  }}
                />
                <Label
                  htmlFor="register-expense-on-import"
                  className="text-sm font-normal leading-snug cursor-pointer"
                >
                  Registrar como gasto
                </Label>
              </div>
              {registerExpenseOnImport && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Categoría *</Label>
                    <Select
                      value={expenseCategoryId != null ? String(expenseCategoryId) : '__NONE__'}
                      onValueChange={(value) =>
                        setExpenseCategoryId(
                          value === '__NONE__' ? null : Number(value),
                        )
                      }
                      disabled={expenseCatalogLoading}
                    >
                      <SelectTrigger className="h-11 min-h-11 w-full sm:h-9 sm:min-h-9">
                        <SelectValue
                          placeholder={
                            expenseCatalogLoading ? 'Cargando…' : 'Selecciona categoría'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent position="popper" className="max-h-[min(50dvh,280px)]">
                        <SelectItem value="__NONE__">Selecciona categoría</SelectItem>
                        {expenseCategories.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cartera *</Label>
                    <Select
                      value={expenseWalletId != null ? String(expenseWalletId) : '__NONE__'}
                      onValueChange={(value) =>
                        setExpenseWalletId(
                          value === '__NONE__' ? null : Number(value),
                        )
                      }
                      disabled={expenseCatalogLoading}
                    >
                      <SelectTrigger className="h-11 min-h-11 w-full sm:h-9 sm:min-h-9">
                        <SelectValue
                          placeholder={
                            expenseCatalogLoading ? 'Cargando…' : 'Selecciona cartera'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent position="popper" className="max-h-[min(50dvh,280px)]">
                        <SelectItem value="__NONE__">Selecciona cartera</SelectItem>
                        {expenseWallets.map((w) => (
                          <SelectItem key={w.id} value={String(w.id)}>
                            {w.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="expense-date-import">Fecha del gasto *</Label>
                    <Input
                      id="expense-date-import"
                      type="date"
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      className="h-11 min-h-11 sm:h-9 sm:min-h-9"
                      required
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-start gap-3">
              <Checkbox
                id="store-file-modal"
                className="mt-0.5 shrink-0"
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
          </div>

          <DialogFooter
            className={cn(
              'shrink-0 gap-2 border-t border-border/60 bg-background px-4 py-3 sm:px-6',
              'flex-col pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:flex-row sm:justify-end',
            )}
          >
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full sm:h-9 sm:w-auto"
              onClick={() => {
                setUploadOpen(false);
                resetUploadForm();
              }}
              disabled={uploading}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="h-11 w-full sm:h-9 sm:w-auto"
              onClick={() => void handleUploadSubmit()}
              disabled={uploading}
            >
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
