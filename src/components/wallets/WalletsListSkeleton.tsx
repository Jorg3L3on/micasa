import { Skeleton } from '@/components/ui/skeleton';

const FlowSkeleton = () => (
  <div className="space-y-4">
    <Skeleton className="h-5 w-40" />
    <div className="relative mx-auto h-40 w-full md:h-44">
      <Skeleton className="absolute left-[4%] top-4 h-32 w-[22%] rounded-face md:h-36" />
      <Skeleton className="absolute left-1/2 top-0 h-40 w-[62%] max-w-72 -translate-x-1/2 rounded-face md:h-44" />
      <Skeleton className="absolute right-[4%] top-4 h-32 w-[22%] rounded-face md:h-36" />
    </div>
    <Skeleton className="mx-auto h-5 w-44" />
    <div className="flex justify-center gap-2">
      <Skeleton className="h-1.5 w-1.5 rounded-full" />
      <Skeleton className="h-1.5 w-6 rounded-full" />
      <Skeleton className="h-1.5 w-1.5 rounded-full" />
    </div>
    <div className="grid grid-cols-3 gap-4">
      <Skeleton className="h-10" />
      <Skeleton className="h-10" />
      <Skeleton className="h-10" />
    </div>
    <div className="grid grid-cols-2 gap-2 md:flex md:justify-end">
      <Skeleton className="h-11 rounded-full md:w-32" />
      <Skeleton className="h-11 rounded-full md:w-32" />
      <Skeleton className="h-11 rounded-full md:w-32" />
      <Skeleton className="h-11 rounded-full md:w-32" />
    </div>
  </div>
);

/** Placeholder matching the cover flow sections. */
export function WalletsListSkeleton() {
  return (
    <div
      className="mx-auto w-full min-w-0 max-w-3xl space-y-8"
      aria-busy="true"
      aria-label="Cargando billeteras"
    >
      <Skeleton className="hidden h-20 w-full rounded-2xl md:block" />
      <FlowSkeleton />
      <FlowSkeleton />
    </div>
  );
}
