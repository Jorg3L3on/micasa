import { SkeletonExit } from '@/components/view-transition/SuspenseReveal';
import { WalletsListSkeleton } from '@/components/wallets/WalletsListSkeleton';

export default function WalletsLoading() {
  return (
    <SkeletonExit>
      <WalletsListSkeleton />
    </SkeletonExit>
  );
}
