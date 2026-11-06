import { Skeleton } from '@/components/ui/skeleton';
import { MONTHLY_PANEL_SHELL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { cn } from '@/lib/utils';

const SHELL_CLASS = cn(MONTHLY_PANEL_SHELL_CLASS, 'px-3 py-3 sm:px-4 sm:py-4');

/** Silhouette of the wallet detail shell, so the page does not jump on load. */
export const WalletDetailBodySkeleton = () => (
  <div className={cn(SHELL_CLASS, 'space-y-4')} role="status" aria-label="Cargando movimientos">
    <Skeleton className="h-14 w-full rounded-2xl" />
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </div>
    <Skeleton className="h-12 w-full rounded-full" />
    <Skeleton className="h-64 w-full rounded-xl" />
  </div>
);

/** Strips above the card tabs, while the statement loads. */
export const CreditCardCycleSkeleton = () => (
  <div className="space-y-4" role="status" aria-label="Cargando ciclo">
    <Skeleton className="h-20 w-full rounded-2xl" />
    <Skeleton className="h-24 w-full rounded-2xl" />
    <Skeleton className="h-14 w-full rounded-2xl" />
  </div>
);

/** Silhouette of the card detail below the face. */
export const CreditCardDetailBodySkeleton = () => (
  <div className="space-y-4">
    <CreditCardCycleSkeleton />
    <Skeleton className="h-12 w-full rounded-full" />
    <div className={SHELL_CLASS}>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  </div>
);
