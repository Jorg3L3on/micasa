'use client';

import Link from 'next/link';
import { isCreditOrStoreCardWalletType } from '@/domain/payment-method';
import { WalletFlowFace } from '@/components/wallets/WalletFlowFace';
import { walletDetailHref } from '@/components/wallets/WalletFlowSection';
import { useFinanceContext } from '@/context/finance-context';
import { prefetchWalletDetailApis } from '@/lib/ui/wallet-detail-prefetch';
import type { WalletAttentionItem } from '@/lib/ui/wallet-cover-flow';
import type { WalletListItem } from '@/types/catalog';

type WalletsGalleryProps = {
  funding: WalletListItem[];
  credit: WalletListItem[];
  attention: WalletAttentionItem[];
  ownerQueryString: string;
};

const attentionCaption = (item: WalletAttentionItem): string => {
  switch (item.reason) {
    case 'due-soon':
      return item.daysUntilDue === 0
        ? 'Vence hoy'
        : `Vence en ${item.daysUntilDue} ${item.daysUntilDue === 1 ? 'día' : 'días'}`;
    case 'missing-due-day':
      return 'Falta fecha de pago';
    case 'over-limit':
      return 'Sobre el límite';
    default:
      return 'Saldo negativo';
  }
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
  const { context } = useFinanceContext();
  const wallets = [...funding, ...credit];
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
                className="block rounded-face outline-none transition-shadow hover:shadow-panel focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <WalletFlowFace wallet={wallet} />
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
