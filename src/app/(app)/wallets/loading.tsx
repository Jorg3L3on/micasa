import { SkeletonExit } from '@/components/view-transition/SuspenseReveal';
import { WalletsToolbarPlaceholder } from '@/components/wallets/WalletsToolbarPlaceholder';
import { WalletsListSkeleton } from '@/components/wallets/WalletsListSkeleton';

export default function WalletsLoading() {
  return (
    <>
      <WalletsToolbarPlaceholder />
      <SkeletonExit>
        <WalletsListSkeleton />
      </SkeletonExit>
    </>
  );
}
