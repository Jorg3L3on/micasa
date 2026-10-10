'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  buildWalletDeckSlots,
  WALLET_DECK_OVERLAP_CLASS,
} from '@/lib/ui/wallet-deck';
import type { WalletListItem } from '@/types/catalog';

/** Wallet ids whose card shows the full face in the mobile deck. */
const WalletDeckContext = createContext<ReadonlySet<number>>(new Set());

export const useWalletDeckCard = (walletId: number) => ({
  expanded: useContext(WalletDeckContext).has(walletId),
});

type WalletCardsListProps = {
  wallets: WalletListItem[];
  renderCard: (wallet: WalletListItem) => ReactNode;
  className?: string;
};

/**
 * Billeteras collection. Below `md` the items are a stacked plastic deck:
 * each card shows its top strip and the last card is always complete. Tap
 * opens a card's detail; long press shows it enlarged. From `md` up the same
 * items are a grid.
 */
export const WalletCardsList = ({
  wallets,
  renderCard,
  className,
}: WalletCardsListProps) => {
  const slots = useMemo(
    () => buildWalletDeckSlots(wallets.length),
    [wallets.length],
  );
  const expandedIds = useMemo(
    () =>
      new Set(
        wallets
          .filter((_, index) => slots[index]?.expanded)
          .map((wallet) => wallet.id),
      ),
    [slots, wallets],
  );

  return (
    <WalletDeckContext.Provider value={expandedIds}>
      <ul
        className={cn(
          'isolate flex w-full list-none flex-col p-0',
          'md:grid md:grid-cols-2 md:gap-5 md:py-1',
          '@min-[1045px]:!grid-cols-3',
          className,
        )}
        role="list"
        aria-label="Billeteras"
      >
        {wallets.map((wallet, index) => {
          const slot = slots[index];
          return (
            <li
              key={wallet.id}
              data-wallet-card-id={wallet.id}
              data-expanded={slot?.expanded ? 'true' : 'false'}
              className={cn(
                'relative min-w-0 md:mt-0',
                slot?.overlapPrevious && WALLET_DECK_OVERLAP_CLASS,
              )}
              style={{ zIndex: slot?.zIndex ?? index + 1 }}
            >
              {renderCard(wallet)}
            </li>
          );
        })}
      </ul>
    </WalletDeckContext.Provider>
  );
};
