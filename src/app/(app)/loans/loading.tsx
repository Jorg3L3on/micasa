import { SkeletonExit } from '@/components/view-transition/SuspenseReveal';
import { LoansListSkeleton } from '@/components/loading/page-skeletons';

export default function Loading() {
  return (
    <SkeletonExit>
      <LoansListSkeleton />
    </SkeletonExit>
  );
}
