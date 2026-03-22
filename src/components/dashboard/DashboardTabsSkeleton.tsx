'use client';

import { cn } from '@/lib/utils';
import { DASHBOARD_GRID_CLASS } from './constants';

export default function DashboardTabsSkeleton() {
  return (
    <div className="w-full space-y-6">
      <div
        className="mb-6 flex h-9 w-full max-w-md gap-1 rounded-lg bg-muted p-1"
        role="presentation"
        aria-hidden
      >
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              'flex-1 rounded-md bg-background/50',
              i === 1 && 'shadow-sm',
            )}
          />
        ))}
      </div>
      <div className={cn(DASHBOARD_GRID_CLASS)}>
        <div className="h-40 animate-pulse rounded-xl border border-border/60 bg-transparent shadow-sm" />
        <div className="h-40 animate-pulse rounded-xl border border-border/60 bg-transparent shadow-sm" />
      </div>
      <div className="max-w-2xl">
        <div className="h-24 animate-pulse rounded-lg bg-muted/50" />
      </div>
    </div>
  );
}
