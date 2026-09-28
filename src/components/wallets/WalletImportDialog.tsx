'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResponsiveOverlay } from '@/components/overlay/responsive-overlay';
import {
  OVERLAY_GROUPED_CARD_CLASS,
  OVERLAY_PRIMARY_BUTTON_CLASS,
} from '@/components/overlay/overlay-form';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import { downloadWalletImportCsvTemplate } from '@/lib/finance/wallet-movements-csv';
import type { FinanceContextType } from '@/types/finance-context';
import type { WalletImportResult } from '@/types/wallet-movements';

export type WalletImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletId: number;
  context: FinanceContextType;
  onSuccess: () => Promise<void> | void;
};

const readFileAsText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el archivo'));
    reader.readAsText(file);
  });

const WalletImportDialog = ({
  open,
  onOpenChange,
  walletId,
  context,
  onSuccess,
}: WalletImportDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<WalletImportResult | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  const resetForm = useCallback(() => {
    setFile(null);
    setResult(null);
    setFileInputKey((k) => k + 1);
  }, []);

  const prevOpenRef = useRef(open);
  useEffect(() => {
    if (prevOpenRef.current && !open) {
      resetForm();
    }
    prevOpenRef.current = open;
  }, [open, resetForm]);

  const handleImport = async () => {
    if (!file) {
      toast.error('Elige un CSV para importar');
      return;
    }
    try {
      setSubmitting(true);
      const csv = await readFileAsText(file);
      const response = await clientFetchFromApi<WalletImportResult>(
        `/api/wallets/${walletId}/import`,
        {
          method: 'POST',
          body: JSON.stringify({ csv }),
        },
        context,
      );
      setResult(response);
      if (response.imported > 0) {
        toast.success(
          `Importación lista: ${response.imported} movimiento(s) creado(s)${
            response.skipped > 0 ? `, ${response.skipped} omitido(s)` : ''
          }`,
        );
        await onSuccess();
      } else {
        toast.error('No se importó ningún movimiento. Revisa los errores.');
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'No se pudo importar el CSV',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const hasResult = result != null;

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      title="Importar movimientos"
      description="Sube un CSV de gastos e ingresos para registrarlos en esta billetera."
      busy={submitting}
      dismissLabel={hasResult ? 'Cerrar' : 'Cancelar'}
    >
      <div className="flex flex-col gap-4">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Sube un CSV con columnas{' '}
          <code className="font-mono text-caption">
            date,description,amount,category,type
          </code>
          . La columna <code className="font-mono text-caption">type</code>{' '}
          debe ser <code className="font-mono text-caption">expense</code> o{' '}
          <code className="font-mono text-caption">income</code>. Los gastos se
          registran como pagados con esta billetera y los ingresos aumentan el
          saldo.
        </p>

        <div className={OVERLAY_GROUPED_CARD_CLASS}>
          <div className="space-y-2 px-3 py-2.5">
            <Label
              htmlFor="wallet-import-file"
              className="text-sm font-medium text-foreground"
            >
              Archivo CSV
            </Label>
            <Input
              key={fileInputKey}
              id="wallet-import-file"
              type="file"
              accept=".csv,text/csv"
              className="cursor-pointer"
              disabled={submitting}
              aria-invalid={Boolean(result && result.errors.length > 0)}
              aria-describedby={
                result && result.errors.length > 0
                  ? 'wallet-import-field-errors'
                  : undefined
              }
              onChange={(e) => {
                const f = e.target.files?.[0];
                setFile(f ?? null);
                setResult(null);
              }}
            />
          </div>
          <div className="px-1.5 py-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-2 text-xs"
              onClick={() => downloadWalletImportCsvTemplate()}
            >
              <Download
                className="h-3.5 w-3.5"
                aria-hidden
                data-icon="inline-start"
              />
              Descargar plantilla
            </Button>
          </div>
        </div>

        {result ? (
          <div
            className="rounded-xl border border-border/60 bg-card p-3 text-xs"
            role="status"
            aria-live="polite"
          >
            <p className="font-medium">
              Importados: {result.imported} · Omitidos: {result.skipped}
            </p>
            {result.errors.length > 0 ? (
              <div
                className="mt-2 space-y-1"
                role="alert"
                id="wallet-import-field-errors"
              >
                <p className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">
                  Errores
                </p>
                <ul className="max-h-40 list-disc space-y-0.5 overflow-y-auto pl-4 text-caption text-destructive">
                  {result.errors.slice(0, 50).map((e, idx) => (
                    <li key={idx}>
                      Línea {e.line}: {e.message}
                    </li>
                  ))}
                  {result.errors.length > 50 ? (
                    <li>… y {result.errors.length - 50} más</li>
                  ) : null}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <Button
            type="button"
            onClick={handleImport}
            disabled={submitting || !file}
            className={OVERLAY_PRIMARY_BUTTON_CLASS}
          >
            {submitting ? 'Importando…' : 'Importar CSV'}
          </Button>
        )}
      </div>
    </ResponsiveOverlay>
  );
};

export default WalletImportDialog;
