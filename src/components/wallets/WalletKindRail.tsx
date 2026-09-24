'use client';

import { WalletListCard } from '@/components/wallets/WalletListCard';
import { WALLET_LIST_STACK_OVERLAP_CLASS } from '@/lib/ui/wallet-card-view-transition';
import { cn } from '@/lib/utils';
import type { WalletListItem } from '@/types/catalog';

type WalletKindRailProps = {
  label: string;
  wallets: WalletListItem[];
  ownerQueryString: string;
  isHouseContext: boolean;
  onEdit: (wallet: WalletListItem) => void;
  onTransfer: (wallet: WalletListItem) => void;
  onDelete: (wallet: WalletListItem) => void;
  onOpenBalance: (wallet: WalletListItem) => void;
};

export const WalletKindRail = ({
  label,
  wallets,
  ownerQueryString,
  isHouseContext,
  onEdit,
  onTransfer,
  onDelete,
  onOpenBalance,
}: WalletKindRailProps) => (
  <section aria-label={label} className="min-w-0">
    <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {label}
    </h2>
    {wallets.length === 0 ? (
      <p className="rounded-xl border border-border/60 bg-card px-3 py-6 text-center text-xs text-muted-foreground">
        Sin registros
      </p>
    ) : (
      <ul className="isolate flex list-none flex-col gap-3 p-0" role="list">
        {wallets.map((wallet, index) => (
          <li
            key={wallet.id}
            className={cn(
              'relative min-w-0',
              index > 0 && WALLET_LIST_STACK_OVERLAP_CLASS,
            )}
            style={{ zIndex: index + 1 }}
          >
            <WalletListCard
              wallet={wallet}
              ownerQueryString={ownerQueryString}
              isHouseContext={isHouseContext}
              onEdit={onEdit}
              onTransfer={onTransfer}
              onDelete={onDelete}
              onOpenBalance={onOpenBalance}
            />
          </li>
        ))}
      </ul>
    )}
  </section>
);
