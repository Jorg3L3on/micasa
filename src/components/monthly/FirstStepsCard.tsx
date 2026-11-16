'use client';

import Link from 'next/link';
import { useCallback, useState, useSyncExternalStore } from 'react';
import { Check, ChevronRight, Sparkles } from 'lucide-react';
import { SectionHeader } from '@/components/section-header';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  MONTHLY_LIQUID_PANEL_CLASS,
  PANEL_INSET_CLASS,
} from '@/components/monthly/monthly-panel-shell';
import {
  firstStepsSubtitle,
  firstStepsTitle,
  getBrowserFirstStepsStorage,
  readFirstStepsDismissed,
  writeFirstStepsDismissed,
  type FirstStepsItem,
} from '@/components/monthly/first-steps';

const subscribeStorage = (onChange: () => void) => {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
};

const ROW_CLASS = cn(
  PANEL_INSET_CLASS,
  'flex min-h-14 items-center gap-3 py-1.5 pl-3 pr-2 text-sm',
);

const DoneRing = () => (
  <span
    aria-hidden
    className="flex size-6 shrink-0 items-center justify-center rounded-full border-[1.5px] border-emerald-500/45 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
  >
    <Check className="size-3" strokeWidth={3} />
  </span>
);

const TodoRing = () => (
  <span
    aria-hidden
    className="size-6 shrink-0 rounded-full border-[1.5px] border-foreground/35"
  />
);

/**
 * Primeros pasos card at the top of Panel financiero. The server decides
 * eligibility (onboarding done, account under 30 days, items left); this
 * component only applies the per-user Ocultar flag from localStorage. It
 * renders nothing until that flag is read, so a dismissed card never flashes.
 */
export const FirstStepsCard = ({
  userId,
  firstName,
  items,
}: {
  userId: number;
  firstName: string | null;
  items: FirstStepsItem[];
}) => {
  const storedDismissed = useSyncExternalStore(
    subscribeStorage,
    () => readFirstStepsDismissed(getBrowserFirstStepsStorage(), userId),
    () => true,
  );
  // Hides the card for this visit even when the storage write fails.
  const [dismissedNow, setDismissedNow] = useState(false);

  const handleDismiss = useCallback(() => {
    writeFirstStepsDismissed(getBrowserFirstStepsStorage(), userId);
    setDismissedNow(true);
  }, [userId]);

  if (storedDismissed || dismissedNow) return null;

  return (
    <section
      aria-labelledby="first-steps-title"
      className={cn(MONTHLY_LIQUID_PANEL_CLASS, 'mb-5 space-y-3 p-3 sm:p-4')}
    >
      <SectionHeader
        id="first-steps-title"
        icon={Sparkles}
        title={firstStepsTitle(firstName)}
        subtitle={firstStepsSubtitle(items)}
        className="items-center"
        actions={
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 px-3 text-muted-foreground"
            onClick={handleDismiss}
          >
            Ocultar
          </Button>
        }
      />
      <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <li key={item.id}>
            {item.done || !item.href ? (
              <div className={cn(ROW_CLASS, 'text-muted-foreground')}>
                {item.done ? <DoneRing /> : <TodoRing />}
                <span className="flex-1">
                  {item.label}
                  {item.done ? <span className="sr-only"> (hecho)</span> : null}
                </span>
              </div>
            ) : (
              <Link
                href={item.href}
                className={cn(
                  ROW_CLASS,
                  'font-medium text-foreground transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
              >
                <TodoRing />
                <span className="flex-1">{item.label}</span>
                <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};
