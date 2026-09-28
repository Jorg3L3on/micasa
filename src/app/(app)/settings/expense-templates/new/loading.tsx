import { SkeletonExit } from '@/components/view-transition/SuspenseReveal';
import { FormPageSkeleton } from '@/components/loading/page-skeletons';

export default function Loading() {
  return (
    <SkeletonExit>
      <FormPageSkeleton />
    </SkeletonExit>
  );
}
