'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { FinanceContextType } from '@/types/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ResponsiveOverlay } from '@/components/overlay/responsive-overlay';
import {
  AmountRow,
  OVERLAY_GROUPED_CARD_CLASS,
  OVERLAY_PRIMARY_BUTTON_CLASS,
} from '@/components/overlay/overlay-form';

const DETAIL_BALANCE_INPUT_ID = 'wallet-detail-balance-input';

export type WalletBalanceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletId: number;
  walletName: string;
  currentAmount: number;
  context: FinanceContextType;
  /** Called after a successful PATCH with the persisted amount. */
  onSuccess: (newAmount: number) => void;
  /**
   * `credit`: saldo utilizado en TC / tienda (no crea movimientos).
   * `funding` (default): efectivo / débito.
   */
  variant?: 'funding' | 'credit';
  /** Si la tarjeta tiene límite, no permitir deuda mayor al límite. */
  creditLimit?: number | null;
};

/**
 * Shared overlay to adjust wallet balance / credit debt (Dialog desktop,
 * Sheet mobile). Used from wallet lists, strips, liquidity, and detail pages.
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
  const dialogTitle = isCredit ? 'Ajustar deuda' : 'Ajustar saldo';
  const dialogDescription = isCredit
    ? `${walletName} — deuda actual en libros: ${formatCurrency(currentAmount)}. No registra movimientos ni pagos: solo alinea el saldo utilizado con el emisor si difiere de compras y pagos cargados en MiCasa.`
    : `${walletName} — saldo actual en libros: ${formatCurrency(currentAmount)}.`;
  const amountLabel = isCredit ? 'Nueva deuda' : 'Nuevo saldo';
  const parsedBalance = Number(balanceInput.replace(/[,\s]/g, '')) || 0;

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
      onSuccess(parsed);
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'No se pudo actualizar el saldo',
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
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      title={dialogTitle}
      description={dialogDescription}
      busy={savingBalance}
    >
      <div className="flex flex-col gap-3">
        <p className="px-1 text-xs text-muted-foreground">
          {walletName} —{' '}
          {isCredit ? 'deuda actual en libros' : 'saldo actual en libros'}:{' '}
          <span className="font-mono font-semibold tabular-nums text-foreground">
            {formatCurrency(currentAmount)}
          </span>
        </p>

        {isCredit ? (
          <p className="px-1 text-xs text-muted-foreground">
            No registra movimientos ni pagos: solo alinea el saldo utilizado con
            el emisor si difiere de compras y pagos cargados en MiCasa.
          </p>
        ) : null}

        <div className={OVERLAY_GROUPED_CARD_CLASS}>
          <AmountRow
            id={DETAIL_BALANCE_INPUT_ID}
            label={amountLabel}
            value={parsedBalance}
            onChange={(val) => setBalanceInput(val === 0 ? '' : String(val))}
            disabled={savingBalance}
            enterKeyHint="done"
            ariaLabel={isCredit ? 'Nueva deuda utilizada' : 'Nuevo saldo'}
          />
        </div>

        <Button
          type="button"
          onClick={handleSaveBalance}
          disabled={savingBalance}
          className={OVERLAY_PRIMARY_BUTTON_CLASS}
        >
          {savingBalance ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </ResponsiveOverlay>
  );
}
