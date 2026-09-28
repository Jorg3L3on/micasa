/**
 * @deprecated Use CreditCardStatementImportDialog instead.
 * This file is kept for backward compatibility.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleField } from '@/components/ui/toggle';
import { uploadMercadoPagoCreditCardStatement } from '@/lib/api/credit-cards';
import { cn, formatDate } from '@/lib/utils';
import type { FinanceContextType } from '@/types/finance-context';
import type {
  CategoryOption,
  CreditCardStatementImportListItem,
} from '@/types/catalog';
import { CategorySelectGroups } from '@/components/categories/CategoryGroupedSelect';
import { ResponsiveOverlay } from '@/components/overlay/responsive-overlay';
import {
  GroupedRow,
  OVERLAY_GROUPED_CARD_CLASS,
  OVERLAY_PRIMARY_BUTTON_CLASS,
  OVERLAY_ROW_TRIGGER_CLASS,
} from '@/components/overlay/overlay-form';

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
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      title="Importar estado de cuenta"
      description="Sube el PDF de Mercado Pago: guardamos el archivo (opcional) y creamos un gasto pagado por cada compra del apartado «Movimientos»."
      busy={mpImportSubmitting}
    >
      {({ handleSelectOpenChange }) => (
        <div className="flex flex-col gap-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Si ya registraste cargos, activa omitir duplicados o revisa el
            saldo de la tarjeta para evitar dobles.
          </p>

          <div className={OVERLAY_GROUPED_CARD_CLASS}>
            <div className="space-y-2 px-3 py-2.5">
              <Label
                htmlFor="mp-statement-file-dialog"
                className="text-sm font-medium text-foreground"
              >
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
            <GroupedRow label="Categoría">
              <Select
                value={mpImportCategoryId || '__default__'}
                onOpenChange={handleSelectOpenChange}
                onValueChange={(v) =>
                  setMpImportCategoryId(v === '__default__' ? '' : v)
                }
                disabled={mpImportSubmitting}
              >
                <SelectTrigger
                  className={OVERLAY_ROW_TRIGGER_CLASS}
                  aria-label="Categoría (opcional)"
                >
                  <SelectValue placeholder="Predeterminada" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">
                    Predeterminada (Tarjeta de crédito o primera)
                  </SelectItem>
                  <CategorySelectGroups categories={categoryOptions} />
                </SelectContent>
              </Select>
            </GroupedRow>
          </div>

          <div className={cn(OVERLAY_GROUPED_CARD_CLASS, 'py-1')}>
            <ToggleField
              layout="row"
              className="px-3"
              label="Guardar PDF"
              helper="Para descargarlo después"
              checked={mpStorePdf}
              onCheckedChange={setMpStorePdf}
              disabled={mpImportSubmitting}
              aria-label="Guardar PDF para descargarlo después"
            />
            <ToggleField
              layout="row"
              className="px-3"
              label="Omitir duplicados"
              helper="Misma fecha, monto y descripción"
              checked={mpSkipDuplicates}
              onCheckedChange={setMpSkipDuplicates}
              disabled={mpImportSubmitting}
              aria-label="Omitir duplicados"
            />
          </div>

            {statementImports.length > 0 && (
              <div
                className="rounded-lg border border-border/60 bg-transparent"
                role="region"
                aria-label="Importaciones recientes"
              >
                <p className="border-b border-border/60 px-3 py-2 overline text-muted-foreground">
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
                        <p className="text-caption text-muted-foreground">
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
                            <Download className="h-3.5 w-3.5" data-icon="inline-start" />
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
                          <Undo2 className="h-3.5 w-3.5" data-icon="inline-start" />
                          Revertir
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

          <Button
            type="button"
            onClick={handleMercadoPagoImport}
            disabled={mpImportSubmitting || !mpImportFile}
            className={OVERLAY_PRIMARY_BUTTON_CLASS}
          >
            {mpImportSubmitting ? 'Importando…' : 'Importar estado de cuenta'}
          </Button>
        </div>
      )}
    </ResponsiveOverlay>
  );
};

export default CreditCardMercadoPagoImportDialog;
