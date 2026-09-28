import { SkeletonExit } from '@/components/view-transition/SuspenseReveal';
import { CollectionCardsSkeleton } from '@/components/loading/page-skeletons';

export default function Loading() {
  return (
    <SkeletonExit>
      <CollectionCardsSkeleton />
    </SkeletonExit>
  );
}
