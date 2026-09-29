import { Skeleton } from '@/components/ui/skeleton';
import { WALLET_DECK_OVERLAP_CLASS } from '@/lib/ui/wallet-deck';
import { cn } from '@/lib/utils';

/** Placeholder matching the mobile deck and the desktop card grid. */
export function WalletsListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className="@container w-full min-w-0"
      aria-busy="true"
      aria-label="Cargando billeteras"
    >
      <div className="mx-auto w-full max-w-full space-y-5 md:max-w-[min(100%,calc(32rem*2+1.25rem))] @min-[1045px]:!max-w-[min(100%,calc(32rem*3+1.25rem*2))]">
        <ul
          className="isolate flex w-full list-none flex-col p-0 md:grid md:grid-cols-2 md:gap-5 md:py-1 @min-[1045px]:!grid-cols-3"
          role="presentation"
        >
          {Array.from({ length: count }).map((_, index) => {
            const isLast = index === count - 1;
            return (
              <li
                key={index}
                className={cn(
                  'relative min-w-0 md:mt-0',
                  index > 0 && WALLET_DECK_OVERLAP_CLASS,
                )}
                style={{ zIndex: index + 1 }}
              >
                <Skeleton
                  className={cn(
                    'w-full rounded-face border border-border/40',
                    isLast
                      ? 'min-h-[12rem] sm:min-h-[13.5rem]'
                      : 'h-36 md:h-auto md:min-h-[13.5rem]',
                  )}
                />
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
