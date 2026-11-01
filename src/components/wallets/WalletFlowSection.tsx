'use client';

import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { useRouter } from 'next/navigation';
import { isCreditOrStoreCardWalletType } from '@/domain/payment-method';
import { clampFlowIndex } from '@/lib/ui/wallet-cover-flow';
import {
  navigateWithTransitionType,
  stashWalletCardVtSnapshot,
} from '@/lib/ui/wallet-card-view-transition';
import { prefetchWalletDetailApis } from '@/lib/ui/wallet-detail-prefetch';
import { useFinanceContext } from '@/context/finance-context';
import { PAYMENT_METHOD_LABELS, type PaymentMethodType } from '@/domain/payment-method';
import { effectiveCreditLimit } from '@/lib/ui/wallet-cover-flow';
import {
  getProviderBrandColor,
  getProviderCardStyle,
  getWalletBrandCssVars,
} from '@/lib/provider-card-style';
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

/** Detail page with the "movimientos" tab preselected (both detail pages read `?tab=`). */
export const walletMovementsHref = (
  wallet: WalletListItem,
  ownerQueryString: string,
): string => {
  const base = walletDetailHref(wallet, ownerQueryString);
  return `${base}${base.includes('?') ? '&' : '?'}tab=movimientos`;
};

const selectionKey = (title: string) => `micasa.wallets.flow.${title}`;
const RETURN_KEY = 'micasa.wallets.flow.return';

const readStored = (key: string): number | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key);
    const value = raw == null ? NaN : Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
};

const writeStored = (key: string, value: number | null) => {
  try {
    if (value == null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, String(value));
  } catch {
    /* private mode */
  }
};

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
  // Coming back from a detail page: the opened card carries the shared name
  // from its first paint so the return morph has a target.
  const [vtId, setVtId] = useState<number | null>(() => {
    const returning = readStored(RETURN_KEY);
    return returning != null && wallets.some((w) => w.id === returning)
      ? returning
      : null;
  });
  useEffect(() => {
    if (readStored(RETURN_KEY) == null) return;
    writeStored(RETURN_KEY, null);
    const timer = window.setTimeout(() => setVtId(null), 800);
    return () => window.clearTimeout(timer);
  }, []);
  const { context } = useFinanceContext();
  const [activeId, setActiveId] = useState<number | null>(() => {
    const stored = readStored(selectionKey(title));
    return stored != null && wallets.some((w) => w.id === stored)
      ? stored
      : (wallets[0]?.id ?? null);
  });
  useEffect(() => {
    writeStored(selectionKey(title), activeId);
  }, [title, activeId]);

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
    const isCard = isCreditOrStoreCardWalletType(wallet.type);
    const amount = Number(wallet.amount);
    const limit = isCard ? effectiveCreditLimit(wallet) : null;
    const brand =
      getProviderBrandColor(wallet.provider_icon_key, wallet.type) ?? '#6366f1';
    // The detail page paints this face instantly so the morph has a target.
    stashWalletCardVtSnapshot({
      id: wallet.id,
      name: wallet.name,
      typeLabel: PAYMENT_METHOD_LABELS[wallet.type as PaymentMethodType],
      amount,
      isCredit: isCard,
      providerIconKey: wallet.provider_icon_key ?? null,
      cycleLabel:
        isCard && wallet.cutoff_day != null && wallet.due_day != null
          ? `Corte ${wallet.cutoff_day} · Pago ${wallet.due_day}`
          : null,
      availableCredit: limit != null && limit > 0 ? limit - amount : null,
      creditLimit: limit != null && limit > 0 ? limit : null,
      utilizationPct:
        limit != null && limit > 0
          ? Math.min(100, Math.max(0, (amount / limit) * 100))
          : null,
      style: {
        ...getProviderCardStyle(wallet.provider_icon_key, wallet.type, 'wow'),
        ...getWalletBrandCssVars(brand),
      },
    });
    prefetchWalletDetailApis(wallet.id, isCard, context);
    // Name only the opened card, and only for the hand-off: the list stays
    // mounted behind the detail page, so a lingering name would be a duplicate.
    writeStored(RETURN_KEY, wallet.id);
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
      />
      <WalletFlowDetails
        wallet={active}
        detailHref={walletMovementsHref(active, ownerQueryString)}
        isHouseContext={isHouseContext}
        direction={direction}
        {...actions}
      />
    </section>
  );
};
