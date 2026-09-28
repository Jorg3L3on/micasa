import { Skeleton } from '@/components/ui/skeleton';

const Row = ({ className }: { className?: string }) => (
  <Skeleton className={className ?? 'h-12 w-full rounded-xl'} />
);

/** Planner: period band plus two fortnight columns. */
export const PlannerPageSkeleton = () => (
  <div className="space-y-5" aria-busy="true" aria-label="Cargando panel">
    <Skeleton className="h-16 w-full rounded-2xl" />
    <div className="grid gap-4 lg:grid-cols-2">
      <Skeleton className="h-72 rounded-2xl" />
      <Skeleton className="h-72 rounded-2xl" />
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
