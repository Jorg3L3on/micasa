'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
                Importar movimientos
              </DialogTitle>
              <DialogDescription className="text-left text-xs leading-relaxed">
                Sube un CSV con columnas{' '}
                <code className="font-mono text-[11px]">
                  date,description,amount,category,type
                </code>
                . La columna <code className="font-mono text-[11px]">type</code>{' '}
                debe ser <code className="font-mono text-[11px]">expense</code>{' '}
                o <code className="font-mono text-[11px]">income</code>. Los
                gastos se registran como pagados con esta billetera y los
                ingresos aumentan el saldo.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="space-y-2">
            <Label htmlFor="wallet-import-file" className="text-xs">
              Archivo CSV
            </Label>
            <Input
              key={fileInputKey}
              id="wallet-import-file"
              type="file"
              accept=".csv,text/csv"
              className="cursor-pointer"
              disabled={submitting}
              onChange={(e) => {
                const f = e.target.files?.[0];
                setFile(f ?? null);
                setResult(null);
              }}
            />
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-2 text-xs"
            onClick={() => downloadWalletImportCsvTemplate()}
          >
            <Download className="h-3.5 w-3.5" />
            Descargar plantilla
          </Button>

          {result && (
            <div
              className="rounded-lg border border-border/60 p-3 text-xs"
              role="status"
              aria-live="polite"
            >
              <p className="font-medium">
                Importados: {result.imported} · Omitidos: {result.skipped}
              </p>
              {result.errors.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Errores
                  </p>
                  <ul className="max-h-40 overflow-y-auto space-y-0.5 pl-4 list-disc text-[11px] text-destructive">
                    {result.errors.slice(0, 50).map((e, idx) => (
                      <li key={idx}>
                        Línea {e.line}: {e.message}
                      </li>
                    ))}
                    {result.errors.length > 50 && (
                      <li>… y {result.errors.length - 50} más</li>
                    )}
                  </ul>
                </div>
              )}
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
            disabled={submitting || !file}
            className="rounded-xl"
          >
            {submitting ? 'Importando…' : 'Importar CSV'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WalletImportDialog;
