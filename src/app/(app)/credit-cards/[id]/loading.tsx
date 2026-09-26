'use client';

import { useParams } from 'next/navigation';
import { ViewTransition } from 'react';
import { DirectionalTransition } from '@/components/view-transition/DirectionalTransition';
import { WalletCardVtPlaceholder } from '@/components/wallets/WalletCardVtPlaceholder';
import { Skeleton } from '@/components/ui/skeleton';
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
            <Skeleton className="mx-auto h-[12rem] w-full max-w-md rounded-[1.375rem] sm:h-[13.5rem]" />
          )}
          <Skeleton className="h-14 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
        <div className="rounded-t-[1.75rem] border border-border/60 bg-card px-4 pt-3 pb-4">
          <Skeleton className="mb-3 h-10 w-full rounded-xl" />
          <Skeleton className="mt-4 h-48 w-full rounded-2xl" />
        </div>
      </div>
    </DirectionalTransition>
  );
}
