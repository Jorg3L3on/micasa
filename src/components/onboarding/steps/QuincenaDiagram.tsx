'use client';

import { PANEL_INSET_CLASS } from '@/components/monthly/monthly-panel-shell';
import { useOnboarding } from '@/components/onboarding/OnboardingContext';
import { todayQuincenaCaption } from '@/components/onboarding/steps/onboarding-summary';
import { todayCalendarDate } from '@/lib/calendar-dates';
import { cn } from '@/lib/utils';

/** "Tus quincenas": two bars that explain where each quincena starts and ends. */
export function QuincenaDiagram({ className }: { className?: string }) {
  const { startDate } = useOnboarding();
  const today = todayQuincenaCaption(startDate, todayCalendarDate());

  return (
    <section
      aria-label="Cómo funcionan las quincenas"
      className={cn(PANEL_INSET_CLASS, 'flex flex-col gap-2.5 px-4 py-3.5', className)}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Tus quincenas
      </p>
      <div className="flex gap-1" aria-hidden>
        <div className="h-2 flex-1 rounded-full bg-white/[0.22]" />
        <div className="h-2 flex-1 rounded-full bg-gradient-to-r from-primary to-[#911efe]" />
      </div>
      <div className="flex gap-1">
        <div className="flex-1">
          <p className="text-[13px] font-semibold text-foreground">1ª quincena</p>
          <p className="text-xs leading-[1.45] text-muted-foreground">
            Último día del mes anterior al 14
          </p>
        </div>
        <div className="flex-1">
          <p className="text-[13px] font-semibold text-foreground">2ª quincena</p>
          <p className="text-xs leading-[1.45] text-muted-foreground">Del 15 al penúltimo día</p>
        </div>
      </div>
      <p className="text-xs leading-[1.45] text-muted-foreground">
        Cada quincena empieza el día que cobras.{today ? ` ${today}` : ''}
      </p>
    </section>
  );
}
