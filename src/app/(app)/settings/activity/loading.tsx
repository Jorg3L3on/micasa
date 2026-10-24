import { SkeletonExit } from '@/components/view-transition/SuspenseReveal';
import { SettingsPageSkeleton } from '@/components/loading/page-skeletons';

export default function Loading() {
  return (
    <SkeletonExit>
      <SettingsPageSkeleton />
    </SkeletonExit>
  );
}
