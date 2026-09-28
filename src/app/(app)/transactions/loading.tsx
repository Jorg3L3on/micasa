import { SkeletonExit } from '@/components/view-transition/SuspenseReveal';
import { CollectionTableSkeleton } from '@/components/loading/page-skeletons';

export default function Loading() {
  return (
    <SkeletonExit>
      <CollectionTableSkeleton />
    </SkeletonExit>
  );
}
