'use client';

import { useParams } from 'next/navigation';
import { ViewTransition } from 'react';
import { DirectionalTransition } from '@/components/view-transition/DirectionalTransition';
import { WalletCardVtPlaceholder } from '@/components/wallets/WalletCardVtPlaceholder';
import { Skeleton } from '@/components/ui/skeleton';
import { CreditCardDetailBodySkeleton } from '@/components/wallets/DetailBodySkeletons';
import { walletCardViewTransitionName } from '@/lib/ui/wallet-card-view-transition';

/**
 * Route-level loading for /credit-cards/[id] so list→detail morph keeps the
 * shared wallet-card VT name instead of falling through to AppLoading.
 */
export default function CreditCardDetailLoading() {
  const params = useParams<{ id: string }>();
  const cardId = Number(params?.id);

  return (
    <DirectionalTransition>
      <div className="space-y-0">
        <div className="relative -mx-4 space-y-4 px-4 pb-4 sm:-mx-0">
          {Number.isFinite(cardId) ? (
            <ViewTransition
              name={walletCardViewTransitionName(cardId)}
              share="morph"
              default="none"
            >
              <WalletCardVtPlaceholder walletId={cardId} variant="credit" />
            </ViewTransition>
          ) : (
            <Skeleton className="mx-auto aspect-[1.586] w-full max-w-md rounded-face lg:max-w-lg" />
          )}
          <CreditCardDetailBodySkeleton />
        </div>
      </div>
    </DirectionalTransition>
  );
}
