import { AppAtmosphere } from '@/components/app-atmosphere';
import { MONTHLY_PANEL_SHELL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** Matches the wizard shell so the card does not jump when it streams in. */
export default function OnboardingLoading() {
  return (
    <div className="relative flex h-dvh flex-col items-center justify-start overflow-hidden bg-background px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:justify-center sm:py-8">
      <AppAtmosphere />
      <div
        className={cn(MONTHLY_PANEL_SHELL_CLASS, 'relative z-10 w-full max-w-xl space-y-4 p-5 sm:p-8')}
        aria-busy="true"
        aria-label="Cargando primeros pasos"
      >
        <Skeleton className="h-1.5 w-full rounded-full" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-44 w-full rounded-xl" />
        <Skeleton className="h-44 w-full rounded-xl" />
        <Skeleton className="ml-auto h-11 w-36 rounded-xl" />
      </div>
    </div>
  );
}
