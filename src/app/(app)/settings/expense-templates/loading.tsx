import { SkeletonExit } from '@/components/view-transition/SuspenseReveal';
import { ScheduledListSkeleton } from '@/components/loading/page-skeletons';

export default function Loading() {
  return (
    <SkeletonExit>
      <ScheduledListSkeleton label="Cargando gastos programados" />
    </SkeletonExit>
  );
}
