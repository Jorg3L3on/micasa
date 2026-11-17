'use client';

import { useEffect, useState, ViewTransition, type MouseEvent } from 'react';
import { flushSync } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isCreditOrStoreCardWalletType } from '@/domain/payment-method';
import { WalletFlowFace } from '@/components/wallets/WalletFlowFace';
import { walletDetailHref } from '@/components/wallets/WalletFlowSection';
import { useFinanceContext } from '@/context/finance-context';
import { prefetchWalletDetailApis } from '@/lib/ui/wallet-detail-prefetch';
import {
  navigateWithTransitionType,
  walletCardViewTransitionName,
} from '@/lib/ui/wallet-card-view-transition';
import {
  prepareWalletDetailOpen,
  readStoredId,
  WALLET_RETURN_KEY,
  writeStoredId,
} from '@/lib/ui/wallet-detail-open';
import {
  attentionCaption,
  type WalletAttentionItem,
} from '@/lib/ui/wallet-cover-flow';
import type { WalletListItem } from '@/types/catalog';

type WalletsGalleryProps = {
  funding: WalletListItem[];
  credit: WalletListItem[];
  attention: WalletAttentionItem[];
  ownerQueryString: string;
};

/**
 * Web (`md`+) Billeteras: one grid of wallet faces, cash and debit first, then
 * cards. The face already carries the name, type and amount, so nothing sits
 * under it; a card opens its detail page. A wallet that needs attention shows
 * its reason as a small pill on the face.
 */
export const WalletsGallery = ({
  funding,
  credit,
  attention,
  ownerQueryString,
}: WalletsGalleryProps) => {
  const router = useRouter();
  const { context } = useFinanceContext();
  const wallets = [...funding, ...credit];
  // Only the opened card carries the shared name (names must be unique). On the
  // way back from a detail page it is named from its first paint, so the
  // return morph has a target.
  const [vtId, setVtId] = useState<number | null>(() => {
    const returning = readStoredId(WALLET_RETURN_KEY);
    return returning != null && wallets.some((w) => w.id === returning)
      ? returning
      : null;
  });
  useEffect(() => {
    if (readStoredId(WALLET_RETURN_KEY) == null) return;
    writeStoredId(WALLET_RETURN_KEY, null);
    const timer = window.setTimeout(() => setVtId(null), 800);
    return () => window.clearTimeout(timer);
  }, []);

  const openDetail = (event: MouseEvent<HTMLAnchorElement>, wallet: WalletListItem) => {
    // Let the browser handle new-tab and modified clicks.
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    prepareWalletDetailOpen(wallet, context);
    flushSync(() => setVtId(wallet.id));
    navigateWithTransitionType(
      walletDetailHref(wallet, ownerQueryString),
      'nav-forward',
      (to) => router.push(to),
    );
    window.setTimeout(() => setVtId(null), 800);
  };
  const attentionById = new Map(attention.map((item) => [item.wallet.id, item]));

  return (
    <section aria-label="Billeteras">
      {/* The padding keeps the focus ring of the outer cards inside the page. */}
      <ul className="grid grid-cols-2 gap-6 p-1.5 lg:grid-cols-3 xl:grid-cols-4">
        {wallets.map((wallet) => {
          const item = attentionById.get(wallet.id);
          const isCard = isCreditOrStoreCardWalletType(wallet.type);
          return (
            <li key={wallet.id} className="relative min-w-0">
              <Link
                href={walletDetailHref(wallet, ownerQueryString)}
                aria-label={`Abrir ${wallet.name}`}
                onPointerEnter={() => prefetchWalletDetailApis(wallet.id, isCard, context)}
                onFocus={() => prefetchWalletDetailApis(wallet.id, isCard, context)}
                onClick={(event) => openDetail(event, wallet)}
                className="block rounded-face outline-none transition-shadow hover:shadow-panel focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <ViewTransition
                  name={
                    vtId === wallet.id
                      ? walletCardViewTransitionName(wallet.id)
                      : undefined
                  }
                  share="morph"
                  default="none"
                >
                  <WalletFlowFace wallet={wallet} />
                </ViewTransition>
              </Link>
              {item ? (
                <span className="pointer-events-none absolute -top-2 right-4 rounded-full border border-status-pending-border bg-card px-2.5 py-0.5 text-caption font-medium text-status-pending shadow-sm">
                  {attentionCaption(item)}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
};
