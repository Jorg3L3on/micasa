'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { FinanceContextType } from '@/types/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import { formatCurrency } from '@/lib/utils';
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

const DETAIL_BALANCE_INPUT_ID = 'wallet-detail-balance-input';

type WalletBalanceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletId: number;
  walletName: string;
  currentAmount: number;
  context: FinanceContextType;
  onSuccess: () => void;
};

/**
 * Modal de ajuste rápido de saldo en la página de detalle de una billetera
 * (`/wallets/[id]`). Distinto de {@link WalletBalanceEditDialog} (listas / strip).
 */
export default function WalletBalanceDialog({
  open,
  onOpenChange,
  walletId,
  walletName,
  currentAmount,
  context,
  onSuccess,
}: WalletBalanceDialogProps) {
  const [balanceInput, setBalanceInput] = useState('');
  const [savingBalance, setSavingBalance] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBalanceInput(String(currentAmount));
  }, [open, currentAmount]);

  const handleSaveBalance = useCallback(async () => {
    const parsed = Number(balanceInput.replace(/[,\s]/g, ''));
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error('Ingresa un saldo válido (no negativo)');
      return;
    }

    try {
      setSavingBalance(true);
      await clientFetchFromApi(
        `/api/wallets?id=${walletId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ amount: parsed }),
        },
        context,
      );
      toast.success('Saldo actualizado');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No se pudo actualizar el saldo',
      );
    } finally {
      setSavingBalance(false);
    }
  }, [balanceInput, context, onOpenChange, onSuccess, walletId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-left text-base">Ajustar saldo</DialogTitle>
          <DialogDescription className="text-left text-xs">
            {walletName} — saldo actual en libros:{' '}
            <span className="font-mono font-semibold tabular-nums text-foreground">
              {formatCurrency(currentAmount)}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor={DETAIL_BALANCE_INPUT_ID} className="text-xs">
            Nuevo saldo
          </Label>
          <Input
            id={DETAIL_BALANCE_INPUT_ID}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={balanceInput}
            onChange={(event) => setBalanceInput(event.target.value)}
            disabled={savingBalance}
          />
        </div>

        <DialogFooter className="gap-2 sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSaveBalance}
            disabled={savingBalance}
            className="rounded-xl"
          >
            {savingBalance ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
