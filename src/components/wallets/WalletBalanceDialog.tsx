'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { FinanceContextType } from '@/types/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import { cn, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
import { CurrencyInput } from '@/components/ui/currency-input';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const isMobile = useIsMobile();
  const nestedSelectOpenRef = useRef(false);
  const blockDismissUntilRef = useRef(0);
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

  const shouldBlockDismiss = () =>
    nestedSelectOpenRef.current || Date.now() < blockDismissUntilRef.current;

  const handleRootOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && shouldBlockDismiss()) return;
    if (!nextOpen && savingBalance) return;
    onOpenChange(nextOpen);
  };

  const preventDismissWhileSelectOpen = (event: {
    preventDefault: () => void;
  }) => {
    if (shouldBlockDismiss()) event.preventDefault();
  };

  const handleCancel = () => handleRootOpenChange(false);

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

  const cancelButton = (
    <Button
      type="button"
      variant="ghost"
      className="absolute left-0 h-9 px-2 text-primary"
      onClick={handleCancel}
      disabled={savingBalance}
    >
      Cancelar
    </Button>
  );

  const dialogHeader = (
    <div className="relative flex min-h-10 items-center justify-center">
      {cancelButton}
      <DialogTitle className="text-base font-semibold">{dialogTitle}</DialogTitle>
      <DialogDescription className="sr-only">
        {dialogDescription}
      </DialogDescription>
    </div>
  );

  const sheetHeader = (
    <div className="relative flex min-h-10 items-center justify-center">
      {cancelButton}
      <SheetTitle className="text-base font-semibold">{dialogTitle}</SheetTitle>
      <SheetDescription className="sr-only">{dialogDescription}</SheetDescription>
    </div>
  );

  const formBody = (
    <div className={cn('flex flex-col gap-3', isMobile && 'pb-1')}>
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

      <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card">
        <div className="space-y-1 px-3 py-2">
          <span className="text-sm font-medium text-foreground">
            {amountLabel}
          </span>
          <div className="flex items-center gap-2">
            <span
              className="mr-[2.5rem] inline-flex h-7 shrink-0 items-center rounded-md bg-muted px-2 text-xs font-semibold tracking-wide text-muted-foreground"
              aria-hidden
            >
              MXN
            </span>
            <CurrencyInput
              id={DETAIL_BALANCE_INPUT_ID}
              hideSymbol
              clearable
              value={parsedBalance}
              onChange={(val) => setBalanceInput(val === 0 ? '' : String(val))}
              placeholder="0.00"
              disabled={savingBalance}
              className="h-10 border-0 bg-transparent px-0 font-mono text-2xl font-bold tabular-nums shadow-none focus-visible:ring-0 md:h-12 md:text-4xl"
              enterKeyHint="done"
              aria-label={isCredit ? 'Nueva deuda utilizada' : 'Nuevo saldo'}
            />
          </div>
        </div>
      </div>

      <Button
        type="button"
        onClick={handleSaveBalance}
        disabled={savingBalance}
        className="h-11 w-full rounded-xl"
      >
        {savingBalance ? 'Guardando…' : 'Guardar'}
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleRootOpenChange}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="flex max-h-[92vh] flex-col gap-0 rounded-t-xl p-0"
          onPointerDownOutside={preventDismissWhileSelectOpen}
          onFocusOutside={preventDismissWhileSelectOpen}
          onInteractOutside={preventDismissWhileSelectOpen}
        >
          <div className="border-b border-border/50 px-4 py-3">{sheetHeader}</div>
          <div className="flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {open ? formBody : null}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleRootOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-md w-full gap-4 p-5"
        onPointerDownOutside={preventDismissWhileSelectOpen}
        onFocusOutside={preventDismissWhileSelectOpen}
        onInteractOutside={preventDismissWhileSelectOpen}
      >
        {dialogHeader}
        {open ? formBody : null}
      </DialogContent>
    </Dialog>
  );
}
