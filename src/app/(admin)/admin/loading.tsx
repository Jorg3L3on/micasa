import { Skeleton } from '@/components/ui/skeleton';

export default function AdminLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Cargando usuarios">
      <div>
        <Skeleton className="h-6 w-28" />
        <Skeleton className="mt-2 h-4 w-full max-w-md" />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 w-24 shrink-0" />
      </div>

      <div className="overflow-hidden rounded-lg border border-border/60">
        <div className="space-y-0">
          <div className="flex gap-4 border-b border-border/60 bg-muted/30 px-3 py-2.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="hidden h-3 w-16 sm:block" />
            <Skeleton className="hidden h-3 w-12 md:block" />
          </div>
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-4 border-t border-border/60 px-3 py-3"
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="hidden h-5 w-14 sm:block" />
              <Skeleton className="hidden h-3 w-20 md:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
