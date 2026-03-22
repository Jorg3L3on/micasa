'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AlertTriangle, FileText, FileUp, Loader2 } from 'lucide-react';

import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import EmptyState from '@/components/EmptyState';
import { useFinanceContext } from '@/context/finance-context';
import { buildOwnerQuery, listPantryReceipts, uploadPantryReceipt } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import type { PantryReceiptListItemDto } from '@/types/pantry-receipt';

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

export default function PantryReceiptsPage() {
  const router = useRouter();
  const { context } = useFinanceContext();
  const [receipts, setReceipts] = useState<PantryReceiptListItemDto[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [storeFile, setStoreFile] = useState(true);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadPurchasedAt, setUploadPurchasedAt] = useState('');

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

  const handleFileSelected = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('storeFile', storeFile ? 'true' : 'false');
    if (uploadTitle.trim()) formData.append('title', uploadTitle.trim());
    if (uploadPurchasedAt.trim()) {
      formData.append('purchased_at', uploadPurchasedAt.trim());
    }
    try {
      setUploading(true);
      const created = await uploadPantryReceipt(formData, context);
      toast.success('Recibo guardado');
      setUploadTitle('');
      setUploadPurchasedAt('');
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
        cell: ({ row }) => (
          <span className="text-sm font-bold font-mono tabular-nums">
            {row.original.grand_total != null
              ? formatCurrency(row.original.grand_total)
              : '—'}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div
      className="flex flex-1 flex-col gap-4 p-4 pt-0"
      role="region"
      aria-label="Recibos de despensa"
    >
      <Card className="overflow-hidden border-border/60">
        <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15">
            <FileUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          </span>
          <div className="flex flex-1 flex-col gap-0.5">
            <CardTitle className="text-sm font-semibold leading-none">
              Subir recibo
            </CardTitle>
            <p className="text-[10px] text-muted-foreground">
              PDF (texto seleccionable), CSV o TXT. Los datos se asocian al
              contexto actual (personal o casa).
            </p>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="receipt-title" className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Título (opcional)
              </Label>
              <Input
                id="receipt-title"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="Ej. Bodega Aurrera — marzo"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="receipt-date" className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Fecha de compra (opcional)
              </Label>
              <Input
                id="receipt-date"
                type="date"
                value={uploadPurchasedAt}
                onChange={(e) => setUploadPurchasedAt(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="flex items-end gap-2 pb-0.5">
              <Checkbox
                id="store-file"
                checked={storeFile}
                onCheckedChange={(v) => setStoreFile(v === true)}
              />
              <Label htmlFor="store-file" className="text-sm font-normal leading-snug cursor-pointer">
                Guardar copia del archivo en MiCasa
              </Label>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              accept=".pdf,.csv,.txt,application/pdf,text/csv,text/plain"
              className="sr-only"
              id="pantry-receipt-upload"
              disabled={uploading}
              onChange={(e) => {
                void handleFileSelected(e.target.files);
                e.target.value = '';
              }}
            />
            <Button
              type="button"
              variant="default"
              className="rounded-xl"
              disabled={uploading}
              asChild
            >
              <label
                htmlFor="pantry-receipt-upload"
                className="inline-flex cursor-pointer items-center gap-2"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileUp className="h-4 w-4" />
                )}
                Elegir archivo
              </label>
            </Button>
            <p className="text-[10px] text-muted-foreground">
              CSV ejemplo: descripcion, cantidad, total
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-border/60">
        <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10 dark:bg-violet-500/15">
            <FileText className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
          </span>
          <div className="flex flex-col gap-0.5">
            <CardTitle className="text-sm font-semibold leading-none">
              Recibos guardados
            </CardTitle>
            <p className="text-[10px] text-muted-foreground">
              Haz clic en una fila para abrir el detalle en otra página.
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
            <EmptyState message="Aún no hay recibos en este contexto." />
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
    </div>
  );
}
