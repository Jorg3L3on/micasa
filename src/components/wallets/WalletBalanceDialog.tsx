'use client';

import { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
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
import { clientFetchFromApi } from '@/lib/api';
import type { FinanceContextType } from '@/types/finance-context';

export type WalletBalanceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletId: number;
  walletName: string;
  currentAmount: number;
  context: FinanceContextType;
  onSuccess: () => Promise<void> | void;
};

const WalletBalanceDialog = ({
  open,
  onOpenChange,
  walletId,
  walletName,
  currentAmount,
  context,
  onSuccess,
}: WalletBalanceDialogProps) => {
  const [value, setValue] = useState<string>(String(currentAmount));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setValue(String(currentAmount));
  }, [open, currentAmount]);

  const handleSubmit = async () => {
    const parsed = Number(value.replace(/[,\s]/g, ''));
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error('Ingresa un saldo válido (no negativo)');
      return;
    }
    try {
      setSubmitting(true);
      await clientFetchFromApi(
        `/api/wallets?id=${walletId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ amount: parsed }),
        },
        context,
      );
      toast.success('Saldo actualizado');
      onOpenChange(false);
      await onSuccess();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'No se pudo actualizar el saldo',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15">
              <Pencil className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </span>
            <div className="min-w-0 space-y-1.5">
              <DialogTitle className="text-left text-base">
                Ajustar saldo
              </DialogTitle>
              <DialogDescription className="text-left text-xs leading-relaxed">
                Fija el saldo actual de{' '}
                <span className="font-medium text-foreground">{walletName}</span>
                . Úsalo para conciliar con lo que tienes físicamente o en el
                banco; no crea un movimiento.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-2 pt-1">
          <Label htmlFor="wallet-balance-input" className="text-xs">
            Nuevo saldo
          </Label>
          <Input
            id="wallet-balance-input"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={submitting}
            autoFocus
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-xl"
          >
            {submitting ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WalletBalanceDialog;
