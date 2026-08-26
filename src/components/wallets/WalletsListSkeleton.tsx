import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { WALLET_LIST_STACK_OVERLAP_CLASS } from '@/lib/ui/wallet-card-view-transition';

/** Card-grid placeholder matching `WalletListCard` min-height shell and list layout. */
export function WalletsListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className="@container w-full min-w-0"
      aria-busy="true"
      aria-label="Cargando billeteras"
    >
      <div className="mx-auto w-full max-w-[22.5rem] space-y-5 md:max-w-[min(100%,calc(32rem*2+1.25rem))] @min-[1045px]:!max-w-[min(100%,calc(32rem*3+1.25rem*2))]">
        <ul
          className="isolate flex w-full list-none flex-col p-0 md:grid md:grid-cols-2 md:gap-5 md:py-1 @min-[1045px]:!grid-cols-3"
          role="presentation"
        >
          {Array.from({ length: count }).map((_, index) => (
            <li
              key={index}
              className={cn(
                'relative min-w-0 md:mt-0',
                index > 0 && WALLET_LIST_STACK_OVERLAP_CLASS,
              )}
              style={{ zIndex: index + 1 }}
            >
              <Skeleton className="min-h-[12rem] w-full rounded-[1.375rem] border border-border/40 sm:min-h-[13.5rem]" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
