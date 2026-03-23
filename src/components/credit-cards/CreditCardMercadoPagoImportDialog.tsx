'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Undo2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { uploadMercadoPagoCreditCardStatement } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import type { FinanceContextType } from '@/types/finance-context';
import type {
  CategoryOption,
  CreditCardStatementImportListItem,
} from '@/types/catalog';

const IMPORT_LIST_SCROLL_CLASS =
  'max-h-[min(16rem,40vh)] overflow-y-auto scrollbar-hide pr-0.5';

export type CreditCardMercadoPagoImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creditCardId: number;
  context: FinanceContextType;
  categoryOptions: CategoryOption[];
  statementImports: CreditCardStatementImportListItem[];
  onSuccess: () => Promise<void>;
  onDownloadImport: (importId: number) => Promise<void>;
  onRollbackClick: (importId: number) => void;
};

const CreditCardMercadoPagoImportDialog = ({
  open,
  onOpenChange,
  creditCardId,
  context,
  categoryOptions,
  statementImports,
  onSuccess,
  onDownloadImport,
  onRollbackClick,
}: CreditCardMercadoPagoImportDialogProps) => {
  const [mpImportFile, setMpImportFile] = useState<File | null>(null);
  const [mpImportCategoryId, setMpImportCategoryId] = useState('');
  const [mpStorePdf, setMpStorePdf] = useState(true);
  const [mpSkipDuplicates, setMpSkipDuplicates] = useState(true);
  const [mpImportSubmitting, setMpImportSubmitting] = useState(false);
  const [mpFileInputKey, setMpFileInputKey] = useState(0);

  const resetForm = useCallback(() => {
    setMpImportFile(null);
    setMpImportCategoryId('');
    setMpStorePdf(true);
    setMpSkipDuplicates(true);
    setMpFileInputKey((k) => k + 1);
  }, []);

  const prevOpenRef = useRef(open);
  useEffect(() => {
    if (prevOpenRef.current && !open) {
      resetForm();
    }
    prevOpenRef.current = open;
  }, [open, resetForm]);

  const handleMercadoPagoImport = async () => {
    if (!mpImportFile) {
      toast.error('Elige un PDF de Mercado Pago');
      return;
    }
    try {
      setMpImportSubmitting(true);
      const formData = new FormData();
      formData.append('file', mpImportFile);
      formData.append('provider', 'MERCADO_PAGO');
      if (!mpStorePdf) {
        formData.append('store_file', 'false');
      }
      if (mpSkipDuplicates) {
        formData.append('skip_duplicates', 'true');
      }
      if (mpImportCategoryId) {
        formData.append('category_id', mpImportCategoryId);
      }

      const result = await uploadMercadoPagoCreditCardStatement(
        creditCardId,
        formData,
        context,
      );

      toast.success(
        `Importación lista: ${result.expenses_created} gasto(s) creado(s)${
          result.duplicates_skipped
            ? `, ${result.duplicates_skipped} duplicado(s) omitidos`
            : ''
        }`,
      );
      if (result.warnings.length > 0) {
        toast.info(result.warnings.join(' · '), { duration: 10_000 });
      }
      resetForm();
      await onSuccess();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'No se pudo importar el PDF',
      );
    } finally {
      setMpImportSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,40rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 dark:bg-blue-500/15">
              <Upload className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </span>
            <div className="min-w-0 space-y-1.5">
              <DialogTitle className="text-left text-base">
                Importar estado de cuenta (Mercado Pago)
              </DialogTitle>
              <DialogDescription className="text-left text-xs leading-relaxed">
                Sube el PDF del banco: guardamos el archivo (opcional) y creamos
                un gasto pagado por cada compra del apartado «Movimientos». Si
                ya registraste cargos, activa omitir duplicados o revisa el
                saldo de la tarjeta para evitar dobles.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="flex flex-col gap-3">
            <div className="space-y-2">
              <Label htmlFor="mp-statement-file-dialog" className="text-xs">
                PDF del estado de cuenta
              </Label>
              <Input
                key={mpFileInputKey}
                id="mp-statement-file-dialog"
                type="file"
                accept="application/pdf"
                className="cursor-pointer"
                disabled={mpImportSubmitting}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setMpImportFile(f ?? null);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Categoría (opcional)</Label>
              <Select
                value={mpImportCategoryId || '__default__'}
                onValueChange={(v) =>
                  setMpImportCategoryId(v === '__default__' ? '' : v)
                }
                disabled={mpImportSubmitting}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Predeterminada" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">
                    Predeterminada (Tarjeta de crédito o primera)
                  </SelectItem>
                  {categoryOptions.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex items-center gap-2">
              <Checkbox
                id="mp-store-pdf-dialog"
                checked={mpStorePdf}
                onCheckedChange={(v) => setMpStorePdf(v === true)}
                disabled={mpImportSubmitting}
              />
              <Label htmlFor="mp-store-pdf-dialog" className="text-xs font-normal">
                Guardar PDF para descargarlo después
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="mp-skip-dup-dialog"
                checked={mpSkipDuplicates}
                onCheckedChange={(v) => setMpSkipDuplicates(v === true)}
                disabled={mpImportSubmitting}
              />
              <Label htmlFor="mp-skip-dup-dialog" className="text-xs font-normal">
                Omitir duplicados (misma fecha, monto y descripción)
              </Label>
            </div>
          </div>

          {statementImports.length > 0 && (
            <div
              className="rounded-lg border border-border/60 bg-transparent"
              role="region"
              aria-label="Importaciones recientes"
            >
              <p className="border-b border-border/60 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Importaciones recientes
              </p>
              <ul className={cn('divide-y divide-border/60', IMPORT_LIST_SCROLL_CLASS)}>
                {statementImports.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 text-sm">
                      <p className="font-medium tabular-nums">
                        {row.period_start && row.period_end
                          ? `${formatDate(row.period_start.slice(0, 10))} – ${formatDate(row.period_end.slice(0, 10))}`
                          : 'Periodo no detectado'}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {row.expense_count} gasto(s)
                        {row.account_number
                          ? ` · Cuenta ${row.account_number}`
                          : ''}
                        {row.file_name ? ` · ${row.file_name}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                      {row.has_file ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 shrink-0"
                          onClick={() => onDownloadImport(row.id)}
                          aria-label="Descargar PDF importado"
                        >
                          <Download className="h-3.5 w-3.5" />
                          PDF
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => onRollbackClick(row.id)}
                        aria-label="Revertir esta importación"
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                        Revertir
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mpImportSubmitting}
          >
            Cerrar
          </Button>
          <Button
            type="button"
            onClick={handleMercadoPagoImport}
            disabled={mpImportSubmitting || !mpImportFile}
            className="rounded-xl"
          >
            {mpImportSubmitting ? 'Importando…' : 'Importar PDF'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreditCardMercadoPagoImportDialog;
