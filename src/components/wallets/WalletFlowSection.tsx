'use client';

import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { isCreditOrStoreCardWalletType } from '@/domain/payment-method';
import {
  clampFlowIndex,
  nextAttentionWallet,
  type WalletAttentionItem,
} from '@/lib/ui/wallet-cover-flow';
import { navigateWithTransitionType } from '@/lib/ui/wallet-card-view-transition';
import {
  prepareWalletDetailOpen,
  readStoredId,
  WALLET_RETURN_KEY,
  writeStoredId,
} from '@/lib/ui/wallet-detail-open';
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
  /** Wallets that need attention: a tag on the face, and a jump to the unseen ones. */
  attention?: WalletAttentionItem[];
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

/** Detail page with the "movimientos" tab preselected (both detail pages read `?tab=`). */
export const walletMovementsHref = (
  wallet: WalletListItem,
  ownerQueryString: string,
): string => {
  const base = walletDetailHref(wallet, ownerQueryString);
  return `${base}${base.includes('?') ? '&' : '?'}tab=movimientos`;
};

const selectionKey = (title: string) => `micasa.wallets.flow.${title}`;
export const WalletFlowSection = ({
  title,
  wallets,
  ownerQueryString,
  attention = [],
  hideHeader = false,
  ...actions
}: WalletFlowSectionProps) => {
  const router = useRouter();
  // Coming back from a detail page: the opened card carries the shared name
  // from its first paint so the return morph has a target.
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
  const { context } = useFinanceContext();
  const [activeId, setActiveId] = useState<number | null>(() => {
    const stored = readStoredId(selectionKey(title));
    return stored != null && wallets.some((w) => w.id === stored)
      ? stored
      : (wallets[0]?.id ?? null);
  });
  useEffect(() => {
    writeStoredId(selectionKey(title), activeId);
  }, [title, activeId]);

  // Keep the selection by id so filtering or reloading doesn't jump around.
  const foundIndex = wallets.findIndex((w) => w.id === activeId);
  const activeIndex = clampFlowIndex(foundIndex < 0 ? 0 : foundIndex, wallets.length);

  const active = wallets[activeIndex];
  if (!active) return null;

  const jump = nextAttentionWallet(attention, wallets, active.id);

  const openDetail = (wallet: WalletListItem) => {
    const href = walletDetailHref(wallet, ownerQueryString);
    prepareWalletDetailOpen(wallet, context);
    // Name only the opened card, and only for the hand-off: the list stays
    // mounted behind the detail page, so a lingering name would be a duplicate.
    flushSync(() => setVtId(wallet.id));
    navigateWithTransitionType(href, 'nav-forward', (to) => router.push(to));
    window.setTimeout(() => setVtId(null), 800);
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
        viewTransitionId={vtId}
        attention={attention}
      />
      {/* The row keeps its height while the link is hidden, so swiping onto the
          only flagged wallet does not move the content below. */}
      {attention.length > 0 ? (
        <div className="mb-1 flex min-h-11 items-center justify-center">
          {jump.nextId != null ? (
            <button
              type="button"
              onClick={() => setActiveId(jump.nextId)}
              className="flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-caption font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
            >
              <AlertTriangle className="h-3.5 w-3.5 text-status-pending" aria-hidden />
              {jump.count === 1
                ? '1 billetera más requiere atención'
                : `${jump.count} billeteras más requieren atención`}
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}
      <WalletFlowDetails
        wallet={active}
        detailHref={walletMovementsHref(active, ownerQueryString)}
        {...actions}
      />
    </section>
  );
};
