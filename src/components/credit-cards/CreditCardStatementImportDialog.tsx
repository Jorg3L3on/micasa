'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, Download, FileText, Undo2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  previewCreditCardStatement,
  uploadCreditCardStatement,
} from '@/lib/api/credit-cards';
import type { ClientApiError } from '@/lib/api/client-fetch';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type { FinanceContextType } from '@/types/finance-context';
import type {
  CategoryOption,
  CreditCardStatementImportListItem,
  CreditCardStatementImportPreviewResponse,
  StatementImportPreviewMovement,
} from '@/types/catalog';
import { CategorySelectGroups } from '@/components/categories/CategoryGroupedSelect';

type Provider = 'MERCADO_PAGO' | 'CA_DEPARTAMENTAL' | 'CA_EFECTIVO' | 'DIDI_CARD' | 'LIVERPOOL';

type ImportStep = 'upload' | 'preview';

const PROVIDER_OPTIONS: { value: Provider; label: string }[] = [
  { value: 'MERCADO_PAGO', label: 'Mercado Pago' },
  { value: 'CA_DEPARTAMENTAL', label: 'C&A Departamental' },
  { value: 'CA_EFECTIVO', label: 'C&A Efectivo' },
  { value: 'DIDI_CARD', label: 'DiDi Card' },
  { value: 'LIVERPOOL', label: 'Liverpool' },
];

const VALID_STATEMENT_PROVIDERS = new Set<Provider>(
  PROVIDER_OPTIONS.map((o) => o.value),
);

const PROVIDER_LABEL: Record<string, string> = {
  MERCADO_PAGO: 'Mercado Pago',
  CA_DEPARTAMENTAL: 'C&A Departamental',
  CA_EFECTIVO: 'C&A Efectivo',
  DIDI_CARD: 'DiDi Card',
  LIVERPOOL: 'Liverpool',
};

const MOVEMENT_KIND_LABEL: Record<StatementImportPreviewMovement['kind'], string> = {
  charge: 'Cargo',
  payment: 'Pago',
  msi_installment: 'Cuota MSI',
};

export type CreditCardStatementImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creditCardId: number;
  context: FinanceContextType;
  categoryOptions: CategoryOption[];
  statementImports: CreditCardStatementImportListItem[];
  walletProviderIconKey: string | null;
  walletName: string;
  onSuccess: () => Promise<void>;
  onDownloadImport: (importId: number) => Promise<void>;
  onRollbackClick: (importId: number) => void;
};

const CreditCardStatementImportDialog = ({
  open,
  onOpenChange,
  creditCardId,
  context,
  categoryOptions,
  statementImports,
  walletProviderIconKey,
  walletName,
  onSuccess,
  onDownloadImport,
  onRollbackClick,
}: CreditCardStatementImportDialogProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<ImportStep>('upload');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [provider, setProvider] = useState<Provider>('MERCADO_PAGO');
  const [importCategoryId, setImportCategoryId] = useState('');
  const [storePdf, setStorePdf] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(false);
  const [importCharges, setImportCharges] = useState(true);
  const [importPayments, setImportPayments] = useState(true);
  const [importMsiSchedule, setImportMsiSchedule] = useState(true);
  const [adjustWalletDebt, setAdjustWalletDebt] = useState(true);
  const [preview, setPreview] = useState<CreditCardStatementImportPreviewResponse | null>(
    null,
  );
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const prevOpenForProviderRef = useRef(false);

  const resetForm = useCallback(() => {
    setStep('upload');
    setImportFile(null);
    setImportCategoryId('');
    setStorePdf(false);
    setSkipDuplicates(false);
    setImportCharges(true);
    setImportPayments(true);
    setImportMsiSchedule(true);
    setAdjustWalletDebt(true);
    setPreview(null);
    setOptionsOpen(false);
    setFileInputKey((k) => k + 1);
  }, []);

  const prevOpenRef = useRef(open);
  useEffect(() => {
    if (prevOpenRef.current && !open) {
      resetForm();
    }
    prevOpenRef.current = open;
  }, [open, resetForm]);

  useEffect(() => {
    if (open && !prevOpenForProviderRef.current) {
      const fromWallet: Provider | null =
        walletProviderIconKey === 'DIDI' ||
        walletName.toLowerCase().includes('didi')
          ? 'DIDI_CARD'
          : walletProviderIconKey === 'LIVERPOOL' ||
              walletName.toLowerCase().includes('liverpool')
            ? 'LIVERPOOL'
            : null;
      const lastProv = statementImports[0]?.provider;
      const fromHistory: Provider | null =
        lastProv && VALID_STATEMENT_PROVIDERS.has(lastProv as Provider)
          ? (lastProv as Provider)
          : null;
      setProvider(fromWallet ?? fromHistory ?? 'MERCADO_PAGO');
    }
    prevOpenForProviderRef.current = open;
  }, [open, walletProviderIconKey, walletName, statementImports]);

  const buildFormData = useCallback(() => {
    const formData = new FormData();
    if (!importFile) return formData;
    formData.append('file', importFile);
    formData.append('provider', provider);
    return formData;
  }, [importFile, provider]);

  const handlePreview = async () => {
    if (!importFile) {
      toast.error('Elige un PDF de estado de cuenta');
      return;
    }
    try {
      setSubmitting(true);
      const result = await previewCreditCardStatement(
        creditCardId,
        buildFormData(),
        context,
      );
      setPreview(result);
      setStep('preview');
      if (result.warnings.length > 0) {
        toast.info(result.warnings.join(' · '), { duration: 10_000 });
      }
    } catch (err) {
      const e = err as ClientApiError;
      toast.error(e.message ?? 'No se pudo analizar el PDF');
      const followUp = [e.hint, e.parse_warnings?.filter(Boolean).join(' · ')]
        .filter(Boolean)
        .join('\n\n');
      if (followUp) {
        toast.info(followUp, { duration: 14_000 });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      toast.error('Elige un PDF de estado de cuenta');
      return;
    }
    try {
      setSubmitting(true);
      const formData = buildFormData();
      if (!storePdf) {
        formData.append('store_file', 'false');
      }
      if (skipDuplicates) {
        formData.append('skip_duplicates', 'true');
      }
      if (!importCharges) {
        formData.append('import_charges', 'false');
      }
      if (!importPayments) {
        formData.append('import_payments', 'false');
      }
      if (!importMsiSchedule) {
        formData.append('import_msi_schedule', 'false');
      }
      if (!adjustWalletDebt) {
        formData.append('adjust_wallet_debt', 'false');
      }
      if (importCategoryId) {
        formData.append('category_id', importCategoryId);
      }

      const result = await uploadCreditCardStatement(creditCardId, formData, context);

      const parts = [
        `${result.expenses_created} gasto(s)`,
        result.payments_created > 0 ? `${result.payments_created} pago(s)` : null,
        result.scheduled_created > 0
          ? `${result.scheduled_created} cuota(s) programada(s)`
          : null,
      ].filter(Boolean);

      toast.success(
        `Importación lista: ${parts.join(', ')}${
          result.duplicates_skipped
            ? ` · ${result.duplicates_skipped} duplicado(s) omitidos`
            : ''
        }`,
      );
      if (result.warnings.length > 0) {
        toast.info(result.warnings.join(' · '), { duration: 10_000 });
      }
      resetForm();
      await onSuccess();
      onOpenChange(false);
    } catch (err) {
      const e = err as ClientApiError;
      toast.error(e.message ?? 'No se pudo importar el PDF');
      const followUp = [e.hint, e.parse_warnings?.filter(Boolean).join(' · ')]
        .filter(Boolean)
        .join('\n\n');
      if (followUp) {
        toast.info(followUp, { duration: 14_000 });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const advancedOptionsActive = storePdf || skipDuplicates;
  const previewMovements = preview?.movements ?? [];
  const chargeCount = previewMovements.filter((m) => m.kind === 'charge').length;
  const paymentCount = previewMovements.filter((m) => m.kind === 'payment').length;
  const msiCount = previewMovements.filter((m) => m.kind === 'msi_installment').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92dvh,36rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 space-y-0 border-b border-border/60 px-4 py-3 text-left">
          <div className="flex items-center gap-2.5">
            {step === 'preview' ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => setStep('upload')}
                disabled={submitting}
                aria-label="Volver a subir archivo"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
              </Button>
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 dark:bg-sky-500/15">
                <Upload
                  className="h-4 w-4 text-sky-600 dark:text-sky-400"
                  aria-hidden
                  data-icon="inline-start"
                />
              </span>
            )}
            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold leading-tight">
                {step === 'preview' ? 'Revisar importación' : 'Importar estado de cuenta'}
              </DialogTitle>
              {walletName ? (
                <p className="truncate text-xs text-muted-foreground">{walletName}</p>
              ) : null}
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {step === 'upload' ? (
            <>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="statement-provider" className="text-xs font-medium">
                    Proveedor
                  </Label>
                  <Select
                    value={provider}
                    onValueChange={(v) => setProvider(v as Provider)}
                    disabled={submitting}
                  >
                    <SelectTrigger
                      id="statement-provider"
                      className="h-10 w-full"
                      aria-label="Seleccionar proveedor"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDER_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="statement-pdf-file" className="text-xs font-medium">
                    Archivo PDF
                  </Label>
                  <input
                    id="statement-pdf-file"
                    key={fileInputKey}
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    className="sr-only"
                    disabled={submitting}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      setImportFile(f ?? null);
                      setPreview(null);
                    }}
                  />
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl border border-dashed px-3 py-3 text-left transition-colors',
                      importFile
                        ? 'border-sky-500/40 bg-sky-500/5'
                        : 'border-border/60 bg-muted/20 hover:bg-muted/40',
                    )}
                    aria-label={
                      importFile
                        ? `PDF seleccionado: ${importFile.name}. Cambiar archivo`
                        : 'Elegir PDF del estado de cuenta'
                    }
                  >
                    <span
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                        importFile
                          ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      <FileText className="h-4 w-4" aria-hidden data-icon="inline-start" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {importFile ? importFile.name : 'Elegir PDF'}
                      </span>
                      <span className="block text-[10px] text-muted-foreground">
                        {importFile
                          ? `${(importFile.size / 1024).toFixed(0)} KB · Toca para cambiar`
                          : 'Estado de cuenta en PDF'}
                      </span>
                    </span>
                  </button>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="statement-category" className="text-xs font-medium">
                    Categoría
                    <span className="font-normal text-muted-foreground"> (opcional)</span>
                  </Label>
                  <Select
                    value={importCategoryId || '__default__'}
                    onValueChange={(v) =>
                      setImportCategoryId(v === '__default__' ? '' : v)
                    }
                    disabled={submitting}
                  >
                    <SelectTrigger
                      id="statement-category"
                      className="h-10 w-full"
                      aria-label="Seleccionar categoría"
                    >
                      <SelectValue placeholder="Predeterminada" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__default__">Predeterminada</SelectItem>
                      <CategorySelectGroups categories={categoryOptions} />
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Collapsible open={optionsOpen} onOpenChange={setOptionsOpen}>
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-9 w-full justify-between px-2 text-xs font-medium text-muted-foreground"
                    aria-expanded={optionsOpen}
                  >
                    <span className="flex items-center gap-2">
                      Opciones
                      {advancedOptionsActive ? (
                        <span className="rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-sky-600 dark:text-sky-400">
                          Activas
                        </span>
                      ) : null}
                    </span>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 shrink-0 transition-transform',
                        optionsOpen && 'rotate-180',
                      )}
                      aria-hidden
                      data-icon="inline-end"
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-1">
                  <label
                    htmlFor="store-pdf-dialog"
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 px-3 py-2.5"
                  >
                    <Checkbox
                      id="store-pdf-dialog"
                      checked={storePdf}
                      onCheckedChange={(v) => setStorePdf(v === true)}
                      disabled={submitting}
                      className="mt-0.5"
                    />
                    <span className="min-w-0 space-y-0.5">
                      <span className="block text-sm font-medium leading-none">
                        Guardar PDF
                      </span>
                      <span className="block text-[10px] text-muted-foreground">
                        Podrás descargarlo después desde esta tarjeta
                      </span>
                    </span>
                  </label>
                  <label
                    htmlFor="skip-dup-dialog"
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 px-3 py-2.5"
                  >
                    <Checkbox
                      id="skip-dup-dialog"
                      checked={skipDuplicates}
                      onCheckedChange={(v) => setSkipDuplicates(v === true)}
                      disabled={submitting}
                      className="mt-0.5"
                    />
                    <span className="min-w-0 space-y-0.5">
                      <span className="block text-sm font-medium leading-none">
                        Omitir duplicados
                      </span>
                      <span className="block text-[10px] text-muted-foreground">
                        Misma fecha, monto y descripción
                      </span>
                    </span>
                  </label>
                </CollapsibleContent>
              </Collapsible>
            </>
          ) : (
            <>
              {preview ? (
                <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3 text-xs">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                    {preview.payment_due_date ? (
                      <span>
                        Vence:{' '}
                        <span className="font-medium text-foreground">
                          {formatDate(preview.payment_due_date)}
                        </span>
                      </span>
                    ) : null}
                    {preview.total_due != null ? (
                      <span>
                        Total:{' '}
                        <span className="font-mono font-medium text-foreground">
                          {formatCurrency(preview.total_due)}
                        </span>
                      </span>
                    ) : null}
                    {preview.minimum_payment != null ? (
                      <span>
                        Mínimo:{' '}
                        <span className="font-mono font-medium text-foreground">
                          {formatCurrency(preview.minimum_payment)}
                        </span>
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {chargeCount} cargo(s) · {paymentCount} pago(s) · {msiCount} cuota(s) MSI
                  </p>
                </div>
              ) : null}

              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground">Qué importar</p>
                <label
                  htmlFor="import-charges"
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 px-3 py-2.5"
                >
                  <Checkbox
                    id="import-charges"
                    checked={importCharges}
                    onCheckedChange={(v) => setImportCharges(v === true)}
                    disabled={submitting || chargeCount === 0}
                    className="mt-0.5"
                  />
                  <span className="min-w-0 space-y-0.5">
                    <span className="block text-sm font-medium leading-none">
                      Cargos ({chargeCount})
                    </span>
                    <span className="block text-[10px] text-muted-foreground">
                      Compras y gastos del periodo
                    </span>
                  </span>
                </label>
                <label
                  htmlFor="import-payments"
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 px-3 py-2.5"
                >
                  <Checkbox
                    id="import-payments"
                    checked={importPayments}
                    onCheckedChange={(v) => setImportPayments(v === true)}
                    disabled={submitting || paymentCount === 0}
                    className="mt-0.5"
                  />
                  <span className="min-w-0 space-y-0.5">
                    <span className="block text-sm font-medium leading-none">
                      Pagos ({paymentCount})
                    </span>
                    <span className="block text-[10px] text-muted-foreground">
                      Abonos registrados como ya pagados
                    </span>
                  </span>
                </label>
                <label
                  htmlFor="import-msi"
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 px-3 py-2.5"
                >
                  <Checkbox
                    id="import-msi"
                    checked={importMsiSchedule}
                    onCheckedChange={(v) => setImportMsiSchedule(v === true)}
                    disabled={submitting || msiCount === 0}
                    className="mt-0.5"
                  />
                  <span className="min-w-0 space-y-0.5">
                    <span className="block text-sm font-medium leading-none">
                      Cuotas MSI ({msiCount})
                    </span>
                    <span className="block text-[10px] text-muted-foreground">
                      Calendario futuro sin crear compras
                    </span>
                  </span>
                </label>
                <label
                  htmlFor="adjust-debt"
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 px-3 py-2.5"
                >
                  <Checkbox
                    id="adjust-debt"
                    checked={adjustWalletDebt}
                    onCheckedChange={(v) => setAdjustWalletDebt(v === true)}
                    disabled={submitting}
                    className="mt-0.5"
                  />
                  <span className="min-w-0 space-y-0.5">
                    <span className="block text-sm font-medium leading-none">
                      Ajustar deuda de la tarjeta
                    </span>
                    <span className="block text-[10px] text-muted-foreground">
                      Desactiva para importar solo como bitácora sin mover saldos
                    </span>
                  </span>
                </label>
              </div>

              {previewMovements.length > 0 ? (
                <div
                  className="rounded-xl border border-border/60"
                  role="region"
                  aria-label="Movimientos detectados"
                >
                  <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Movimientos
                  </p>
                  <ul className="max-h-[min(12rem,32vh)] divide-y divide-border/60 overflow-y-auto scrollbar-hide">
                    {previewMovements.map((row, index) => (
                      <li
                        key={`${row.kind}-${row.payment_date}-${row.amount}-${index}`}
                        className="flex items-start gap-2 px-3 py-2"
                      >
                        <span className="mt-0.5 shrink-0 rounded-full border border-border/60 bg-background px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {MOVEMENT_KIND_LABEL[row.kind]}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{row.description}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatDate(row.payment_date)}
                            {row.installment_current != null && row.installment_total != null
                              ? ` · ${row.installment_current}/${row.installment_total}`
                              : ''}
                          </p>
                        </div>
                        <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">
                          {formatCurrency(row.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
                  No se detectaron movimientos en el detalle; puedes importar totales de corte
                  si el PDF los incluye.
                </p>
              )}
            </>
          )}

          {step === 'upload' && statementImports.length > 0 ? (
            <div
              className="rounded-xl border border-border/60"
              role="region"
              aria-label="Importaciones recientes"
            >
              <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Recientes
              </p>
              <ul className="max-h-[min(10rem,28vh)] divide-y divide-border/60 overflow-y-auto scrollbar-hide">
                {statementImports.map((row) => {
                  const periodLabel =
                    row.period_start && row.period_end
                      ? `${formatDate(row.period_start.slice(0, 10))} – ${formatDate(row.period_end.slice(0, 10))}`
                      : 'Sin periodo';

                  return (
                    <li
                      key={row.id}
                      className="flex items-center gap-2 px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{periodLabel}</p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {PROVIDER_LABEL[row.provider] ?? row.provider}
                          {' · '}
                          {row.expense_count} gasto{row.expense_count === 1 ? '' : 's'}
                          {row.total_due != null
                            ? ` · ${formatCurrency(row.total_due)}`
                            : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        {row.has_file ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onDownloadImport(row.id)}
                            aria-label="Descargar PDF"
                          >
                            <Download className="h-4 w-4" data-icon="inline-start" />
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => onRollbackClick(row.id)}
                          aria-label="Revertir importación"
                        >
                          <Undo2 className="h-4 w-4" data-icon="inline-start" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-border/60 px-4 py-3 sm:flex-row">
          <Button
            type="button"
            variant="ghost"
            className="h-10 flex-1 sm:flex-none"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          {step === 'upload' ? (
            <Button
              type="button"
              onClick={() => void handlePreview()}
              disabled={submitting || !importFile}
              className="h-10 flex-1 rounded-xl sm:flex-none sm:min-w-[8.5rem]"
            >
              {submitting ? 'Analizando…' : 'Analizar PDF'}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => void handleImport()}
              disabled={submitting}
              className="h-10 flex-1 rounded-xl sm:flex-none sm:min-w-[8.5rem]"
            >
              {submitting ? 'Importando…' : 'Confirmar importación'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreditCardStatementImportDialog;
