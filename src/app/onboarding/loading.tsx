import { AppAtmosphere } from '@/components/app-atmosphere';
import { MONTHLY_PANEL_SHELL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { ONBOARDING_DISPLAY_TOTAL_STEPS } from '@/components/onboarding/OnboardingStepper';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const STEPPER_ROWS = Array.from({ length: ONBOARDING_DISPLAY_TOTAL_STEPS });

/**
 * Same boxes as `OnboardingWizard` on its first step (aside and stepper from
 * 781px, segmented bar on phones, two wallet rows, footer), so nothing moves
 * when the wizard streams in.
 */
export default function OnboardingLoading() {
  return (
    <div className="relative flex h-dvh flex-col items-center justify-start overflow-hidden bg-background px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:justify-center sm:py-8">
      <AppAtmosphere />
      <div
        className={cn(
          MONTHLY_PANEL_SHELL_CLASS,
          'relative z-10 flex max-h-full min-h-0 w-full max-w-[1000px] overflow-hidden min-[781px]:h-[min(820px,100%)]',
        )}
        aria-busy="true"
        aria-label="Cargando primeros pasos"
      >
        <div className="hidden w-[300px] shrink-0 flex-col gap-6 border-r border-border/60 bg-primary/[0.05] p-8 min-[781px]:flex dark:border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-7 rounded-lg" />
            <Skeleton className="h-5 w-20" />
          </div>
          <div className="flex flex-col gap-0.5">
            {STEPPER_ROWS.map((_, index) => (
              <div key={index} className="flex min-h-10 items-center gap-3">
                <Skeleton className="size-7 shrink-0 rounded-full" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </div>
          <Skeleton className="mt-auto h-[104px] w-full rounded-xl" />
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="shrink-0 space-y-4 px-5 pt-5 pb-4 min-[781px]:px-9 min-[781px]:pt-8">
            <div className="flex flex-col gap-2 min-[781px]:hidden">
              <div className="flex gap-1">
                {STEPPER_ROWS.map((_, index) => (
                  <Skeleton key={index} className="h-1 flex-1 rounded-full" />
                ))}
              </div>
              <Skeleton className="h-4 w-44" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-8 w-3/4 max-w-80" />
              <Skeleton className="h-5 w-full max-w-md" />
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-5 pt-1 pb-6 min-[781px]:px-9">
            <Skeleton className="h-16 w-full shrink-0 rounded-xl" />
            <Skeleton className="h-40 w-full shrink-0 rounded-xl" />
            <div className="flex flex-wrap gap-3">
              <Skeleton className="h-11 flex-1 basis-48 rounded-xl" />
              <Skeleton className="h-11 flex-1 basis-48 rounded-xl" />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3 border-t border-border/60 px-5 py-4 min-[781px]:px-9">
            <Skeleton className="h-4 w-40 max-w-[50%]" />
            <Skeleton className="ml-auto h-11 w-24 shrink-0 rounded-xl min-[360px]:w-32 min-[400px]:w-36" />
          </div>
        </div>
      </div>
    </div>
  );
}
