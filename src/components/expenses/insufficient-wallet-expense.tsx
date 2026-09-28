'use client';

import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import { formatCurrency } from '@/lib/utils';

export const insufficientWalletExpenseMessage = (
  walletName: string,
  balance: number,
  amount: number,
) =>
  `${walletName} tiene ${formatCurrency(balance)}. Este gasto de ${formatCurrency(amount)} supera el saldo, así que no se descontará de esa billetera. Si continúas, el gasto se registra y el saldo no cambia.`;

export function InsufficientWalletExpenseNotice({
  walletName,
  balance,
  amount,
}: {
  walletName: string;
  balance: number;
  amount: number;
}) {
  return (
    <p
      role="status"
      className="rounded-lg border border-status-pending/30 bg-status-pending/10 px-3 py-2 text-xs leading-snug text-status-pending"
    >
      {walletName} tiene {formatCurrency(balance)}. Este gasto supera el saldo,
      así que no se descontará de esa billetera.
    </p>
  );
}

export function InsufficientWalletExpenseDialog({
  open,
  onOpenChange,
  walletName,
  balance,
  amount,
  busy,
  onAccept,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletName: string;
  balance: number;
  amount: number;
  busy?: boolean;
  onAccept: () => void;
}) {
  return (
    <ConfirmDeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onAccept}
      title="Saldo insuficiente"
      description={insufficientWalletExpenseMessage(walletName, balance, amount)}
      confirmLabel="Registrar sin descontar"
      loadingLabel="Guardando…"
      tone="default"
      busy={busy}
    />
  );
}
