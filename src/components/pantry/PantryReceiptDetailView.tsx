'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Download,
  FileText,
  Loader2,
  Plus,
  TrendingUp,
  Wallet,
  Trash2,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import { PantryLayoutShell } from '@/components/pantry/PantryLayoutShell';
import { PantryMetricTile } from '@/components/pantry/PantryMetricTile';
import { useFinanceContext } from '@/context/finance-context';
import {
  buildOwnerQuery,
  getClientApiBaseUrl,
} from '@/lib/api/client-fetch';
import {
  deletePantryReceipt,
  getPantryReceipt,
  patchPantryReceipt,
} from '@/lib/api/pantry';
import { formatCurrency } from '@/lib/utils';
import type { FinanceContextType } from '@/types/finance-context';
import type { PantryReceiptDetailDto, PantryReceiptLineDto } from '@/types/pantry-receipt';

type EditableLine = {
  tempKey: string;
  description: string;
  quantity: string;
  unit_label: string;
  unit_price: string;
  line_total: string;
};

const lineDtoToEditable = (l: PantryReceiptLineDto): EditableLine => ({
  tempKey: `e-${l.id}`,
  description: l.description,
  quantity: String(l.quantity),
  unit_label: l.unit_label ?? '',
  unit_price: l.unit_price != null ? String(l.unit_price) : '',
  line_total: String(l.line_total),
});

const parseNum = (s: string): number | null => {
  const n = Number.parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const ownerHref = (path: string, context: FinanceContextType) => {
  const q = buildOwnerQuery(context).toString();
  return q ? `${path}?${q}` : path;
};

type PantryReceiptDetailViewProps = {
  receiptId: number;
};

export function PantryReceiptDetailView({ receiptId }: PantryReceiptDetailViewProps) {
  const router = useRouter();
  const { context } = useFinanceContext();
  const listHref = ownerHref('/pantry/receipts', context);

  const [detail, setDetail] = useState<PantryReceiptDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [editableLines, setEditableLines] = useState<EditableLine[]>([]);
  const [linesDirty, setLinesDirty] = useState(false);
  const [savingLines, setSavingLines] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(receiptId) || receiptId < 1) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setNotFound(false);
      const d = await getPantryReceipt(receiptId, context);
      setDetail(d);
      setEditableLines(d.lines.map(lineDtoToEditable));
      setLinesDirty(false);
    } catch (e) {
      const status =
        typeof e === 'object' &&
        e !== null &&
        'status' in e &&
        typeof (e as { status: unknown }).status === 'number'
          ? (e as { status: number }).status
          : undefined;
      const msg = e instanceof Error ? e.message : '';
      if (status === 404 || msg.includes('no encontrado')) {
        setNotFound(true);
        setDetail(null);
      } else {
        toast.error(msg || 'No se pudo cargar el recibo');
        setDetail(null);
      }
    } finally {
      setLoading(false);
    }
  }, [receiptId, context]);

  useEffect(() => {
    void load();
  }, [load]);

  const linesSum = useMemo(() => {
    let sum = 0;
    for (const row of editableLines) {
      const v = parseNum(row.line_total);
      if (v != null) sum += v;
    }
    return Math.round(sum * 100) / 100;
  }, [editableLines]);

  const handleSaveLines = async () => {
    if (!detail) return;
    const linesPayload: Array<{
      description: string;
      quantity: number;
      unit_label: string | null;
      unit_price: number | null;
      line_total: number;
    }> = [];
    for (const row of editableLines) {
      const quantity = parseNum(row.quantity) ?? 1;
      const line_total = parseNum(row.line_total);
      if (!row.description.trim() || line_total == null) {
        toast.error('Completa descripción y total en cada renglón');
        return;
      }
      const unit_price =
        row.unit_price.trim() === ''
          ? null
          : (parseNum(row.unit_price) ?? null);
      linesPayload.push({
        description: row.description.trim(),
        quantity,
        unit_label: row.unit_label.trim() || null,
        unit_price,
        line_total,
      });
    }
    if (linesPayload.length === 0) {
      toast.error('Agrega al menos un renglón');
      return;
    }
    try {
      setSavingLines(true);
      const updated = await patchPantryReceipt(
        receiptId,
        { lines: linesPayload },
        context,
      );
      setDetail(updated);
      setEditableLines(updated.lines.map(lineDtoToEditable));
      setLinesDirty(false);
      toast.success('Líneas actualizadas');
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'No se pudieron guardar las líneas',
      );
    } finally {
      setSavingLines(false);
    }
  };

  const handleAddLine = () => {
    setEditableLines((prev) => [
      ...prev,
      {
        tempKey: `new-${Date.now()}`,
        description: '',
        quantity: '1',
        unit_label: 'pz',
        unit_price: '',
        line_total: '',
      },
    ]);
    setLinesDirty(true);
  };

  const handleRemoveLine = (tempKey: string) => {
    setEditableLines((prev) => prev.filter((r) => r.tempKey !== tempKey));
    setLinesDirty(true);
  };

  const handleDownloadFile = async () => {
    if (!detail?.has_file) return;
    const owner = buildOwnerQuery(context);
    const q = owner.toString();
    const url = `${getClientApiBaseUrl()}/api/pantry/receipts/${receiptId}/file${q ? `?${q}` : ''}`;
    try {
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('No se pudo descargar el archivo');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = detail.file_name ?? 'recibo';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Error al descargar',
      );
    }
  };

  const handleConfirmDelete = async () => {
    await deletePantryReceipt(receiptId, context);
    toast.success('Recibo eliminado');
    setDeleteOpen(false);
    router.replace(listHref);
  };

  if (notFound) {
    return (
      <PantryLayoutShell
        className="flex flex-col gap-5"
        role="region"
        aria-label="Recibo no encontrado"
      >
        <Card className="overflow-hidden border-border/60">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            <p className="mb-4">No encontramos este recibo en el contexto actual.</p>
            <Button variant="outline" size="sm" className="h-9" asChild>
              <Link href={listHref}>Volver a recibos</Link>
            </Button>
          </CardContent>
        </Card>
      </PantryLayoutShell>
    );
  }

  if (loading || !detail) {
    return (
      <PantryLayoutShell className="flex min-h-[40vh] flex-1 items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </PantryLayoutShell>
    );
  }

  return (
    <PantryLayoutShell
      className="flex flex-col gap-5"
      role="region"
      aria-label="Detalle del recibo"
    >
      <Card className="overflow-hidden border-border/60 border-l-[3px] border-l-violet-500/50 bg-transparent">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
          <div className="flex flex-col gap-3 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-fit shrink-0 -ml-2"
              asChild
            >
              <Link href={listHref}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Recibos
              </Link>
            </Button>
            <div className="flex flex-row items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10 dark:bg-violet-500/15 shrink-0">
                <FileText className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
              </span>
              <div className="min-w-0">
                <CardTitle className="text-sm font-semibold leading-none truncate">
                  {detail.title ?? `Recibo #${detail.id}`}
                </CardTitle>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {detail.merchant_ref
                    ? `Ref. ${detail.merchant_ref}`
                    : `ID ${detail.id}`}{' '}
                  · {detail.currency}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {detail.has_file && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => void handleDownloadFile()}
                aria-label="Descargar archivo del recibo"
              >
                <Download className="h-4 w-4 mr-1" />
                Descargar
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8">
                  Más
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  Eliminar recibo…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {detail.parse_warnings.length > 0 && (
            <Alert className="border-amber-500/40 bg-transparent">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-sm">Avisos de importación</AlertTitle>
              <AlertDescription className="text-xs">
                {detail.parse_warnings.join(' ')}
              </AlertDescription>
            </Alert>
          )}

          <div
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            role="region"
            aria-label="Totales del recibo"
          >
            <PantryMetricTile
              icon={CalendarDays}
              label="Compra"
              value={
                detail.purchased_at
                  ? new Date(detail.purchased_at).toLocaleDateString('es-MX', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '—'
              }
              accent="blue"
            />
            <PantryMetricTile
              icon={FileText}
              label="Subtotal"
              value={
                detail.subtotal != null ? formatCurrency(detail.subtotal) : '—'
              }
              accent="slate"
            />
            <PantryMetricTile
              icon={Wallet}
              label="Total (recibo)"
              value={
                detail.grand_total != null
                  ? formatCurrency(detail.grand_total)
                  : '—'
              }
              accent="violet"
            />
            <PantryMetricTile
              icon={TrendingUp}
              label="Suma líneas"
              value={formatCurrency(linesSum)}
              accent="emerald"
            />
          </div>

          <div className="space-y-2 md:hidden">
            {editableLines.map((row) => (
              <div
                key={row.tempKey}
                className="rounded-xl border border-border/60 bg-card p-3"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Producto
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    aria-label="Eliminar línea"
                    onClick={() => handleRemoveLine(row.tempKey)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <Input
                  value={row.description}
                  onChange={(e) => {
                    setEditableLines((prev) =>
                      prev.map((x) =>
                        x.tempKey === row.tempKey
                          ? { ...x, description: e.target.value }
                          : x,
                      ),
                    );
                    setLinesDirty(true);
                  }}
                  className="h-9 text-sm"
                  aria-label="Descripción del producto"
                />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Cant.
                    </Label>
                    <Input
                      value={row.quantity}
                      onChange={(e) => {
                        setEditableLines((prev) =>
                          prev.map((x) =>
                            x.tempKey === row.tempKey
                              ? { ...x, quantity: e.target.value }
                              : x,
                          ),
                        );
                        setLinesDirty(true);
                      }}
                      className="h-9 text-sm font-mono tabular-nums"
                      inputMode="decimal"
                      aria-label="Cantidad"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Ud.
                    </Label>
                    <Input
                      value={row.unit_label}
                      onChange={(e) => {
                        setEditableLines((prev) =>
                          prev.map((x) =>
                            x.tempKey === row.tempKey
                              ? { ...x, unit_label: e.target.value }
                              : x,
                          ),
                        );
                        setLinesDirty(true);
                      }}
                      className="h-9 text-sm"
                      aria-label="Unidad"
                    />
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      P. unit.
                    </Label>
                    <Input
                      value={row.unit_price}
                      onChange={(e) => {
                        setEditableLines((prev) =>
                          prev.map((x) =>
                            x.tempKey === row.tempKey
                              ? { ...x, unit_price: e.target.value }
                              : x,
                          ),
                        );
                        setLinesDirty(true);
                      }}
                      className="h-9 text-sm font-mono tabular-nums"
                      inputMode="decimal"
                      aria-label="Precio unitario"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Total
                    </Label>
                    <Input
                      value={row.line_total}
                      onChange={(e) => {
                        setEditableLines((prev) =>
                          prev.map((x) =>
                            x.tempKey === row.tempKey
                              ? { ...x, line_total: e.target.value }
                              : x,
                          ),
                        );
                        setLinesDirty(true);
                      }}
                      className="h-9 text-right text-sm font-mono tabular-nums"
                      inputMode="decimal"
                      aria-label="Total de línea"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border border-border/60 shadow-sm dark:border-white/[0.08] md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px] text-[10px] font-semibold uppercase tracking-wider">
                    Producto
                  </TableHead>
                  <TableHead className="w-24 text-[10px] font-semibold uppercase tracking-wider">
                    Cant.
                  </TableHead>
                  <TableHead className="w-24 text-[10px] font-semibold uppercase tracking-wider">
                    Ud.
                  </TableHead>
                  <TableHead className="w-28 text-[10px] font-semibold uppercase tracking-wider">
                    P. unit.
                  </TableHead>
                  <TableHead className="w-28 text-right text-[10px] font-semibold uppercase tracking-wider">
                    Total
                  </TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {editableLines.map((row) => (
                  <TableRow key={row.tempKey}>
                    <TableCell className="py-2">
                      <Input
                        value={row.description}
                        onChange={(e) => {
                          setEditableLines((prev) =>
                            prev.map((x) =>
                              x.tempKey === row.tempKey
                                ? { ...x, description: e.target.value }
                                : x,
                            ),
                          );
                          setLinesDirty(true);
                        }}
                        className="h-8 text-sm"
                        aria-label="Descripción del producto"
                      />
                    </TableCell>
                    <TableCell className="py-2">
                      <Input
                        value={row.quantity}
                        onChange={(e) => {
                          setEditableLines((prev) =>
                            prev.map((x) =>
                              x.tempKey === row.tempKey
                                ? { ...x, quantity: e.target.value }
                                : x,
                            ),
                          );
                          setLinesDirty(true);
                        }}
                        className="h-8 text-sm font-mono tabular-nums"
                        inputMode="decimal"
                        aria-label="Cantidad"
                      />
                    </TableCell>
                    <TableCell className="py-2">
                      <Input
                        value={row.unit_label}
                        onChange={(e) => {
                          setEditableLines((prev) =>
                            prev.map((x) =>
                              x.tempKey === row.tempKey
                                ? { ...x, unit_label: e.target.value }
                                : x,
                            ),
                          );
                          setLinesDirty(true);
                        }}
                        className="h-8 text-sm"
                        aria-label="Unidad"
                      />
                    </TableCell>
                    <TableCell className="py-2">
                      <Input
                        value={row.unit_price}
                        onChange={(e) => {
                          setEditableLines((prev) =>
                            prev.map((x) =>
                              x.tempKey === row.tempKey
                                ? { ...x, unit_price: e.target.value }
                                : x,
                            ),
                          );
                          setLinesDirty(true);
                        }}
                        className="h-8 text-sm font-mono tabular-nums"
                        inputMode="decimal"
                        aria-label="Precio unitario"
                      />
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <Input
                        value={row.line_total}
                        onChange={(e) => {
                          setEditableLines((prev) =>
                            prev.map((x) =>
                              x.tempKey === row.tempKey
                                ? { ...x, line_total: e.target.value }
                                : x,
                            ),
                          );
                          setLinesDirty(true);
                        }}
                        className="h-8 text-sm font-mono tabular-nums text-right"
                        inputMode="decimal"
                        aria-label="Total de línea"
                      />
                    </TableCell>
                    <TableCell className="py-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        aria-label="Eliminar línea"
                        onClick={() => handleRemoveLine(row.tempKey)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex w-full flex-wrap items-center justify-between gap-4 border-t-2 border-border/60 bg-muted/30 px-3 py-2.5 rounded-b-lg">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={handleAddLine}
            >
              <Plus className="h-4 w-4 mr-1" />
              Renglón
            </Button>
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Total editado
              </span>
              <span className="text-sm font-bold font-mono tabular-nums">
                {formatCurrency(linesSum)}
              </span>
              <Button
                type="button"
                variant="default"
                className="rounded-xl h-9"
                disabled={!linesDirty || savingLines}
                onClick={() => void handleSaveLines()}
              >
                {savingLines ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Guardar líneas'
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleConfirmDelete}
        title="¿Eliminar este recibo?"
        description="Se borrarán todas las líneas y el archivo asociado. Esta acción no se puede deshacer."
        itemName={detail.title ?? undefined}
      />
    </PantryLayoutShell>
  );
}
