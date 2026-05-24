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
import { uploadCreditCardStatement } from '@/lib/api/credit-cards';
import type { ClientApiError } from '@/lib/api/client-fetch';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type { FinanceContextType } from '@/types/finance-context';
import type {
  CategoryOption,
  CreditCardStatementImportListItem,
} from '@/types/catalog';
import { formatCategoryLabel } from '@/components/categories/CategoryLabel';

const IMPORT_LIST_SCROLL_CLASS =
  'max-h-[min(16rem,40vh)] overflow-y-auto scrollbar-hide pr-0.5';

type Provider = 'MERCADO_PAGO' | 'CA_DEPARTAMENTAL' | 'CA_EFECTIVO' | 'DIDI_CARD' | 'LIVERPOOL';

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

export type CreditCardStatementImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creditCardId: number;
  context: FinanceContextType;
  categoryOptions: CategoryOption[];
  statementImports: CreditCardStatementImportListItem[];
  /** Used to default «Banco / Proveedor» (e.g. icon DIDI → DiDi Card). */
  walletProviderIconKey: string | null;
  walletName: string;
  onSuccess: () => Promise<void>;
  onDownloadImport: (importId: number) => Promise<void>;
  onRollbackClick: (importId: number) => void;
};

const PROVIDER_LABEL: Record<string, string> = {
  MERCADO_PAGO: 'Mercado Pago',
  CA_DEPARTAMENTAL: 'C&A Departamental',
  CA_EFECTIVO: 'C&A Efectivo',
  DIDI_CARD: 'DiDi Card',
  LIVERPOOL: 'Liverpool',
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
  const [importFile, setImportFile] = useState<File | null>(null);
  const [provider, setProvider] = useState<Provider>('MERCADO_PAGO');
  const [importCategoryId, setImportCategoryId] = useState('');
  const [storePdf, setStorePdf] = useState(true);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const prevOpenForProviderRef = useRef(false);

  const resetForm = useCallback(() => {
    setImportFile(null);
    setImportCategoryId('');
    setStorePdf(true);
    setSkipDuplicates(true);
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

  const handleImport = async () => {
    if (!importFile) {
      toast.error('Elige un PDF de estado de cuenta');
      return;
    }
    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('provider', provider);
      if (!storePdf) {
        formData.append('store_file', 'false');
      }
      if (skipDuplicates) {
        formData.append('skip_duplicates', 'true');
      }
      if (importCategoryId) {
        formData.append('category_id', importCategoryId);
      }

      const result = await uploadCreditCardStatement(creditCardId, formData, context);

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
                Importar estado de cuenta
              </DialogTitle>
              <DialogDescription className="text-left text-xs leading-relaxed">
                Sube el PDF del banco: guardamos el archivo (opcional) y creamos
                un gasto pagado por cada compra del periodo. Elige el proveedor
                que coincida con el PDF (p. ej. DiDi Card). Si ya registraste
                cargos, activa omitir duplicados para evitar dobles.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="flex flex-col gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Banco / Proveedor</Label>
              <Select
                value={provider}
                onValueChange={(v) => setProvider(v as Provider)}
                disabled={submitting}
              >
                <SelectTrigger className="h-9">
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
            <div className="space-y-2">
              <Label htmlFor="statement-file-dialog" className="text-xs">
                PDF del estado de cuenta
              </Label>
              <Input
                key={fileInputKey}
                id="statement-file-dialog"
                type="file"
                accept="application/pdf"
                className="cursor-pointer"
                disabled={submitting}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setImportFile(f ?? null);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Categoría (opcional)</Label>
              <Select
                value={importCategoryId || '__default__'}
                onValueChange={(v) =>
                  setImportCategoryId(v === '__default__' ? '' : v)
                }
                disabled={submitting}
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
                      {formatCategoryLabel(c.name, c.icon)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex items-center gap-2">
              <Checkbox
                id="store-pdf-dialog"
                checked={storePdf}
                onCheckedChange={(v) => setStorePdf(v === true)}
                disabled={submitting}
              />
              <Label htmlFor="store-pdf-dialog" className="text-xs font-normal">
                Guardar PDF para descargarlo después
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="skip-dup-dialog"
                checked={skipDuplicates}
                onCheckedChange={(v) => setSkipDuplicates(v === true)}
                disabled={submitting}
              />
              <Label htmlFor="skip-dup-dialog" className="text-xs font-normal">
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
                        {PROVIDER_LABEL[row.provider] ?? row.provider}
                        {' · '}
                        {row.expense_count} gasto(s)
                        {row.payment_due_date
                          ? ` · Vence ${formatDate(row.payment_due_date.slice(0, 10))}`
                          : ''}
                        {row.total_due != null
                          ? ` · Total ${formatCurrency(row.total_due)}`
                          : ''}
                        {row.minimum_payment != null
                          ? ` · Mín ${formatCurrency(row.minimum_payment)}`
                          : ''}
                        {row.account_number
                          ? ` · ${row.account_number}`
                          : ''}
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
            disabled={submitting}
          >
            Cerrar
          </Button>
          <Button
            type="button"
            onClick={handleImport}
            disabled={submitting || !importFile}
            className="rounded-xl"
          >
            {submitting ? 'Importando…' : 'Importar PDF'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreditCardStatementImportDialog;
