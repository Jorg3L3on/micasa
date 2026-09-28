'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { WalletListItem } from '@/types/catalog';

type WalletCardsListProps = {
  wallets: WalletListItem[];
  renderCard: (wallet: WalletListItem) => ReactNode;
  className?: string;
};

/**
 * Billeteras collection. Below `md` each item is a calm row (the card decides).
 * From `md` up the same items are card faces in a grid, never an overlapping deck.
 */
export const WalletCardsList = ({
  wallets,
  renderCard,
  className,
}: WalletCardsListProps) => {
  return (
    <ul
      className={cn(
        'flex w-full list-none flex-col gap-2 p-0',
        'md:grid md:grid-cols-2 md:gap-5 md:py-1',
        '@min-[1045px]:!grid-cols-3',
        className,
      )}
      role="list"
      aria-label="Billeteras"
    >
      {wallets.map((wallet) => (
        <li key={wallet.id} className="min-w-0">
          {renderCard(wallet)}
        </li>
      ))}
    </ul>
  );
};
