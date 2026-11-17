'use client';

import {
  ArrowLeftRight,
  Banknote,
  Diff,
  ShoppingCart,
  SlidersHorizontal,
} from 'lucide-react';
import {
  isCreditOrStoreCardWalletType,
} from '@/domain/payment-method';
import { WalletRecentMovements } from '@/components/wallets/WalletRecentMovements';
import type { WalletListItem } from '@/types/catalog';
import { Button } from '@/components/ui/button';

export type WalletFlowActions = {
  /** Cash and debit: Agregar movimiento (gasto or ingreso). */
  onMovement: (wallet: WalletListItem) => void;
  onTransfer: (wallet: WalletListItem) => void;
  /** Credit and store cards. */
  onPurchase: (wallet: WalletListItem) => void;
  onPay: (wallet: WalletListItem) => void;
  /** Wallet id whose Pagar is waiting on the statement. */
  payPendingId: number | null;
  onAdjustBalance: (wallet: WalletListItem) => void;
};

type WalletFlowDetailsProps = WalletFlowActions & {
  wallet: WalletListItem;
  detailHref: string;
};

/** Quick actions for one wallet; shared by the row under the card and the long-press preview. */
export const walletQuickActions = (
  wallet: WalletListItem,
  {
    onMovement,
    onTransfer,
    onPurchase,
    onPay,
    payPendingId,
    onAdjustBalance,
  }: WalletFlowActions,
) =>
  isCreditOrStoreCardWalletType(wallet.type)
    ? [
        { key: 'purchase', label: 'Compra', icon: ShoppingCart, onClick: () => onPurchase(wallet), busy: false },
        { key: 'pay', label: 'Pagar', icon: Banknote, onClick: () => onPay(wallet), busy: payPendingId === wallet.id },
        { key: 'adjust', label: 'Ajustar saldo', icon: SlidersHorizontal, onClick: () => onAdjustBalance(wallet), busy: false },
      ]
    : [
        { key: 'movement', label: 'Movimiento', icon: Diff, onClick: () => onMovement(wallet), busy: false },
        { key: 'transfer', label: 'Transferir', icon: ArrowLeftRight, onClick: () => onTransfer(wallet), busy: false },
        { key: 'adjust', label: 'Ajustar saldo', icon: SlidersHorizontal, onClick: () => onAdjustBalance(wallet), busy: false },
      ];

const ACTION_BUTTON_CLASS =
  'h-auto min-w-0 flex-col gap-1 rounded-2xl px-1 py-2.5 text-xs leading-tight';

/** Quick actions for the wallet centered in the cover flow. */
export const WalletFlowDetails = ({
  wallet,
  detailHref,
  ...flowActions
}: WalletFlowDetailsProps) => {
  const actions = walletQuickActions(wallet, flowActions);

  return (
    <div className="w-full">
      <div className="flex flex-col items-center gap-4 md:border-t md:border-border/60 md:pt-4">
        <div
          className="grid w-full max-w-md grid-cols-3 gap-2"
          role="group"
          aria-label={`Acciones de ${wallet.name}`}
        >
          {actions.map(({ key, label, icon: Icon, onClick, busy }) => (
            <Button
              key={key}
              type="button"
              variant="outline"
              className={ACTION_BUTTON_CLASS}
              disabled={busy}
              aria-busy={busy || undefined}
              onClick={onClick}
            >
              <Icon className="h-5 w-5" aria-hidden />
              {label}
            </Button>
          ))}
        </div>
      </div>

      <WalletRecentMovements wallet={wallet} detailHref={detailHref} />
    </div>
  );
};
