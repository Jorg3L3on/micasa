'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { isCreditOrStoreCardWalletType } from '@/domain/payment-method';
import { clampFlowIndex } from '@/lib/ui/wallet-cover-flow';
import {
  navigateWithTransitionType,
} from '@/lib/ui/wallet-card-view-transition';
import { prefetchWalletDetailApis } from '@/lib/ui/wallet-detail-prefetch';
import { useFinanceContext } from '@/context/finance-context';
import type { WalletListItem } from '@/types/catalog';
import { WalletCoverFlow } from '@/components/wallets/WalletCoverFlow';
import {
  WalletFlowDetails,
  type WalletFlowActions,
} from '@/components/wallets/WalletFlowDetails';

type WalletFlowSectionProps = WalletFlowActions & {
  title: string;
  wallets: WalletListItem[];
  ownerQueryString: string;
  isHouseContext?: boolean;
  /** Wallet to center when it appears in this section (from the attention block). */
  focusWalletId?: number | null;
  /** Hide the section title row (the mobile flow shows a type switcher instead). */
  hideHeader?: boolean;
};

export const walletDetailHref = (
  wallet: WalletListItem,
  ownerQueryString: string,
): string =>
  isCreditOrStoreCardWalletType(wallet.type)
    ? `/credit-cards/${wallet.id}${ownerQueryString}`
    : `/wallets/${wallet.id}${ownerQueryString}`;

export const WalletFlowSection = ({
  title,
  wallets,
  ownerQueryString,
  isHouseContext,
  focusWalletId,
  hideHeader = false,
  ...actions
}: WalletFlowSectionProps) => {
  const router = useRouter();
  const { context } = useFinanceContext();
  const [activeId, setActiveId] = useState<number | null>(
    wallets[0]?.id ?? null,
  );

  // Keep the selection by id so filtering or reloading doesn't jump around.
  const foundIndex = wallets.findIndex((w) => w.id === activeId);
  const activeIndex = clampFlowIndex(foundIndex < 0 ? 0 : foundIndex, wallets.length);

  // Adjust during render: center the wallet requested from the attention block.
  const [handledFocus, setHandledFocus] = useState<number | null>(null);
  if (
    focusWalletId != null &&
    focusWalletId !== handledFocus &&
    wallets.some((w) => w.id === focusWalletId)
  ) {
    setHandledFocus(focusWalletId);
    setActiveId(focusWalletId);
  }

  // Adjust during render: remember which way the rail travelled.
  const [prevIndex, setPrevIndex] = useState(activeIndex);
  const [direction, setDirection] = useState<1 | -1>(1);
  if (activeIndex !== prevIndex) {
    setPrevIndex(activeIndex);
    setDirection(activeIndex > prevIndex ? 1 : -1);
  }

  const active = wallets[activeIndex];
  if (!active) return null;

  const openDetail = (wallet: WalletListItem) => {
    const href = walletDetailHref(wallet, ownerQueryString);
    prefetchWalletDetailApis(
      wallet.id,
      isCreditOrStoreCardWalletType(wallet.type),
      context,
    );
    navigateWithTransitionType(href, 'nav-forward', (to) => router.push(to));
  };

  return (
    <section aria-label={title} className="min-w-0">
      {hideHeader ? (
        <h2 className="sr-only">{title}</h2>
      ) : (
        <div className="mb-1 flex items-baseline justify-between gap-2 px-1">
          <h2 className="text-section text-foreground">{title}</h2>
          <span className="text-caption text-muted-foreground">
            {wallets.length}
          </span>
        </div>
      )}
      <WalletCoverFlow
        wallets={wallets}
        activeIndex={activeIndex}
        onActiveIndexChange={(index) => setActiveId(wallets[index]?.id ?? null)}
        onOpen={openDetail}
        ariaLabel={title}
      />
      <WalletFlowDetails
        wallet={active}
        detailHref={walletDetailHref(active, ownerQueryString)}
        isHouseContext={isHouseContext}
        direction={direction}
        {...actions}
      />
    </section>
  );
};
