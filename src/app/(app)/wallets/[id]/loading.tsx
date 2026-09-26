'use client';

import { useParams } from 'next/navigation';
import { ViewTransition } from 'react';
import { DirectionalTransition } from '@/components/view-transition/DirectionalTransition';
import { WalletCardVtPlaceholder } from '@/components/wallets/WalletCardVtPlaceholder';
import { Skeleton } from '@/components/ui/skeleton';
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
            <Skeleton className="mx-auto h-[12rem] w-full max-w-md rounded-[1.375rem] sm:h-[13.5rem]" />
          )}
        </div>
        <div className="space-y-3 px-1 py-7 sm:py-9">
          <Skeleton className="h-12 w-full rounded-full" />
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[4.5rem] rounded-2xl" />
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-card px-4 py-4 shadow-sm">
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    </DirectionalTransition>
  );
}
