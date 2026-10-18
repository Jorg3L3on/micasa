import { Skeleton } from '@/components/ui/skeleton';
import { MONTHLY_LIQUID_PANEL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { cn } from '@/lib/utils';

/**
 * Silhouette of a planner card: glass shell, icon pill, two header lines and
 * a body. Every Panel financiero loading state uses it so nothing jumps when
 * the real card lands.
 */
export const PanelCardSkeleton = ({
  bodyClassName = 'h-24',
  className,
}: {
  bodyClassName?: string;
  className?: string;
}) => (
  <div
    className={cn(MONTHLY_LIQUID_PANEL_CLASS, 'space-y-4 p-3 sm:p-4', className)}
    aria-hidden
  >
    <div className="flex items-center gap-2.5">
      <Skeleton className="size-8 shrink-0 rounded-xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-32 rounded-full" />
        <Skeleton className="h-2.5 w-48 rounded-full" />
      </div>
    </div>
    <Skeleton className={cn('w-full rounded-xl', bodyClassName)} />
  </div>
);

const Row = ({ className }: { className?: string }) => (
  <Skeleton className={className ?? 'h-12 w-full rounded-xl'} />
);

/** Planner: period band plus two fortnight columns. */
export const PlannerPageSkeleton = () => (
  <div className="space-y-5" aria-busy="true" aria-label="Cargando panel">
    <Skeleton className="h-16 w-full rounded-2xl" />
    <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] xl:items-start">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <PanelCardSkeleton bodyClassName="h-8" />
          <PanelCardSkeleton bodyClassName="h-8" />
        </div>
        <PanelCardSkeleton bodyClassName="h-28" />
        <PanelCardSkeleton bodyClassName="h-64" />
      </div>
      <div className="flex flex-col gap-5">
        <PanelCardSkeleton bodyClassName="h-56" />
        <PanelCardSkeleton bodyClassName="h-40" />
        <PanelCardSkeleton bodyClassName="h-36" />
      </div>
    </div>
  </div>
);

/** Collection of cards (billeteras, metas, préstamos). */
export const CollectionCardsSkeleton = () => (
  <div className="space-y-5" aria-busy="true" aria-label="Cargando lista">
    <Skeleton className="h-10 w-full max-w-md rounded-full" />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-56 rounded-2xl" />
      ))}
    </div>
  </div>
);

/** Collection table (operaciones, plantillas). */
export const CollectionTableSkeleton = () => (
  <div className="space-y-4" aria-busy="true" aria-label="Cargando tabla">
    <Skeleton className="h-10 w-64 rounded-full" />
    <div className="space-y-2 rounded-xl border border-border/60 bg-card p-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <Row key={index} />
      ))}
    </div>
  </div>
);

/** One object: hero then sections. */
export const DetailPageSkeleton = () => (
  <div className="space-y-5" aria-busy="true" aria-label="Cargando detalle">
    <Skeleton className="mx-auto h-48 w-full max-w-md rounded-2xl" />
    <Skeleton className="h-24 w-full rounded-2xl" />
    <Skeleton className="h-40 w-full rounded-2xl" />
  </div>
);

/** Settings catalogs. */
export const SettingsPageSkeleton = () => (
  <div className="space-y-4" aria-busy="true" aria-label="Cargando configuración">
    <Skeleton className="h-9 w-48 rounded-full" />
    <div className="space-y-2 rounded-xl border border-border/60 bg-card p-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <Row key={index} className="h-14 w-full rounded-xl" />
      ))}
    </div>
  </div>
);

/** Create / edit form. */
export const FormPageSkeleton = () => (
  <div className="space-y-4" aria-busy="true" aria-label="Cargando formulario">
    <Skeleton className="h-64 w-full rounded-2xl" />
    <Skeleton className="h-11 w-full rounded-xl" />
  </div>
);
