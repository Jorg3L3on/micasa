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

const ACTION_BUTTON_CLASS =
  'h-auto min-w-0 flex-col gap-1 rounded-2xl px-1 py-2.5 text-xs leading-tight';

/** Quick actions for the wallet centered in the cover flow. */
export const WalletFlowDetails = ({
  wallet,
  detailHref,
  onMovement,
  onTransfer,
  onPurchase,
  onPay,
  payPendingId,
  onAdjustBalance,
}: WalletFlowDetailsProps) => {
  const isCard = isCreditOrStoreCardWalletType(wallet.type);

  const actions = isCard
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

  return (
    <div className="mt-2 w-full">
      <div className="mt-2 flex flex-col items-center gap-4 md:border-t md:border-border/60 md:pt-4">
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
