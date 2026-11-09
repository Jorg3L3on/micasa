'use client';

import { useParams } from 'next/navigation';
import { ViewTransition } from 'react';
import { DirectionalTransition } from '@/components/view-transition/DirectionalTransition';
import { WalletCardVtPlaceholder } from '@/components/wallets/WalletCardVtPlaceholder';
import { Skeleton } from '@/components/ui/skeleton';
import { WalletDetailBodySkeleton } from '@/components/wallets/DetailBodySkeletons';
import { walletCardViewTransitionName } from '@/lib/ui/wallet-card-view-transition';

/**
 * Route-level loading for /wallets/[id] so the shared-element morph pairs with
 * the list card instead of the generic wallets list skeleton / AppLoading.
 */
export default function WalletDetailLoading() {
  const params = useParams<{ id: string }>();
  const walletId = Number(params?.id);

  return (
    <DirectionalTransition>
      <div className="space-y-0">
        <div className="relative -mx-4 space-y-5 px-4 pb-2 sm:-mx-0 sm:pb-3">
          {Number.isFinite(walletId) ? (
            <ViewTransition
              name={walletCardViewTransitionName(walletId)}
              share="morph"
              default="none"
            >
              <WalletCardVtPlaceholder walletId={walletId} variant="funding" />
            </ViewTransition>
          ) : (
            <Skeleton className="mx-auto aspect-[1.586] w-full max-w-md rounded-face lg:max-w-lg" />
          )}
        </div>
        <WalletDetailBodySkeleton />
      </div>
    </DirectionalTransition>
  );
}
