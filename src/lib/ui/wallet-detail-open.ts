import { isCreditOrStoreCardWalletType, PAYMENT_METHOD_LABELS, type PaymentMethodType } from '@/domain/payment-method';
import {
  getProviderBrandColor,
  getProviderCardStyle,
  getWalletBrandCssVars,
} from '@/lib/provider-card-style';
import { effectiveCreditLimit } from '@/lib/ui/wallet-cover-flow';
import { stashWalletCardVtSnapshot } from '@/lib/ui/wallet-card-view-transition';
import { prefetchWalletDetailApis } from '@/lib/ui/wallet-detail-prefetch';
import type { FinanceContextType } from '@/types/finance-context';
import type { WalletListItem } from '@/types/catalog';

/** Session key: the wallet whose detail was just opened, so the list names it on return. */
export const WALLET_RETURN_KEY = 'micasa.wallets.flow.return';

export const readStoredId = (key: string): number | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key);
    const value = raw == null ? NaN : Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
};

export const writeStoredId = (key: string, value: number | null) => {
  try {
    if (value == null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, String(value));
  } catch {
    /* private mode */
  }
};

/**
 * Everything the list must do before navigating to a wallet's detail: stash
 * the face snapshot (the detail page paints it instantly, so the morph has a
 * target), warm the detail APIs, and remember the wallet for the way back.
 */
export const prepareWalletDetailOpen = (
  wallet: WalletListItem,
  context: FinanceContextType,
): void => {
  const isCard = isCreditOrStoreCardWalletType(wallet.type);
  const amount = Number(wallet.amount);
  const limit = isCard ? effectiveCreditLimit(wallet) : null;
  const brand =
    getProviderBrandColor(wallet.provider_icon_key, wallet.type) ?? '#6366f1';
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
  writeStoredId(WALLET_RETURN_KEY, wallet.id);
};
