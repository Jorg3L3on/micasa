import { Skeleton } from '@/components/ui/skeleton';

/** Placeholder matching the mobile row list and the desktop card grid. */
export function WalletsListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className="@container w-full min-w-0"
      aria-busy="true"
      aria-label="Cargando billeteras"
    >
      <div className="mx-auto w-full max-w-full space-y-5 md:max-w-[min(100%,calc(32rem*2+1.25rem))] @min-[1045px]:!max-w-[min(100%,calc(32rem*3+1.25rem*2))]">
        <ul
          className="flex w-full list-none flex-col gap-2 p-0 md:hidden"
          role="presentation"
        >
          {Array.from({ length: count }).map((_, index) => (
            <li key={index}>
              <Skeleton className="h-20 w-full rounded-xl" />
            </li>
          ))}
        </ul>
        <ul
          className="hidden w-full list-none grid-cols-2 gap-5 p-0 md:grid @min-[1045px]:!grid-cols-3"
          role="presentation"
        >
          {Array.from({ length: count }).map((_, index) => (
            <li key={index} className="min-w-0">
              <Skeleton className="min-h-[12rem] w-full rounded-face border border-border/40 sm:min-h-[13.5rem]" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
