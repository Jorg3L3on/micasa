import { SkeletonExit } from '@/components/view-transition/SuspenseReveal';
import { DetailPageSkeleton } from '@/components/loading/page-skeletons';

export default function Loading() {
  return (
    <SkeletonExit>
      <DetailPageSkeleton />
    </SkeletonExit>
  );
}
