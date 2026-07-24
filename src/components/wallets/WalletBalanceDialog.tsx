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
  /**
   * `credit`: saldo utilizado en TC / tienda (no crea movimientos).
   * `funding` (default): efectivo / débito.
   */
  variant?: 'funding' | 'credit';
  /** Si la tarjeta tiene límite, no permitir deuda mayor al límite. */
  creditLimit?: number | null;
};

/**
 * Modal de ajuste rápido de saldo en la página de detalle de una billetera
 * (`/wallets/[id]`) o deuda en tarjeta (`/credit-cards/[id]`).
 * Distinto de {@link WalletBalanceEditDialog} (listas / strip).
 */
export default function WalletBalanceDialog({
  open,
  onOpenChange,
  walletId,
  walletName,
  currentAmount,
  context,
  onSuccess,
  variant = 'funding',
  creditLimit = null,
}: WalletBalanceDialogProps) {
  const [balanceInput, setBalanceInput] = useState('');
  const [savingBalance, setSavingBalance] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBalanceInput(String(currentAmount));
  }, [open, currentAmount]);

  const isCredit = variant === 'credit';

  const handleSaveBalance = useCallback(async () => {
    const parsed = Number(balanceInput.replace(/[,\s]/g, ''));
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error('Ingresa un saldo válido (no negativo)');
      return;
    }

    if (
      isCredit &&
      creditLimit != null &&
      Number.isFinite(creditLimit) &&
      parsed > creditLimit
    ) {
      toast.error('La deuda no puede superar la línea de crédito');
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
      toast.success(isCredit ? 'Deuda actualizada' : 'Saldo actualizado');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No se pudo actualizar el saldo',
      );
      onOpenChange(false);
    } finally {
      setSavingBalance(false);
    }
  }, [
    balanceInput,
    context,
    creditLimit,
    isCredit,
    onOpenChange,
    onSuccess,
    walletId,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-left text-base">
            {isCredit ? 'Ajustar deuda' : 'Ajustar saldo'}
          </DialogTitle>
          <DialogDescription className="text-left text-xs">
            {walletName} —{' '}
            {isCredit ? 'deuda actual en libros' : 'saldo actual en libros'}:{' '}
            <span className="font-mono font-semibold tabular-nums text-foreground">
              {formatCurrency(currentAmount)}
            </span>
            {isCredit ? (
              <span className="mt-1 block text-muted-foreground">
                No registra movimientos ni pagos: solo alinea el saldo utilizado con el
                emisor si difiere de compras y pagos cargados en MiCasa.
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor={DETAIL_BALANCE_INPUT_ID} className="text-xs">
            {isCredit ? 'Nueva deuda (utilizada)' : 'Nuevo saldo'}
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
