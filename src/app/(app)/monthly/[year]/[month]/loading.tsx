import { SkeletonExit } from '@/components/view-transition/SuspenseReveal';
import { PlannerPageSkeleton } from '@/components/loading/page-skeletons';

export default function Loading() {
  return (
    <SkeletonExit>
      <PlannerPageSkeleton />
    </SkeletonExit>
  );
}
