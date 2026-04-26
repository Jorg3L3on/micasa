'use client';

import { useEffect } from 'react';
import { useOnboarding } from '@/components/onboarding/OnboardingContext';

type Props = {
  setCanProceed?: (value: boolean) => void;
};

const PREVIEW_COUNT = 4;

const dateFormatter = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short',
});

function formatFortnightRange(start: Date, end: Date): string {
  return `${dateFormatter.format(start)} → ${dateFormatter.format(end)}`;
}

export default function StepFortnights({
  setCanProceed: setCanProceedProp,
}: Props) {
  const { setCanProceed: contextSetCanProceed, startDate } = useOnboarding();
  const setCanProceed = setCanProceedProp ?? contextSetCanProceed;

  useEffect(() => {
    setCanProceed(true);
  }, [setCanProceed]);

  function generateFortnights(
    start: Date,
    count: number,
  ): { index: number; start: Date; end: Date }[] {
    const result: { index: number; start: Date; end: Date }[] = [];

    // Base month/year from the provided start date
    const baseMonth = start.getMonth();
    const baseYear = start.getFullYear();

    for (let i = 0; i < count; i++) {
      const monthOffset = Math.floor(i / 2);
      const periodIndex = i % 2; // 0 = first, 1 = second

      const monthDate = new Date(baseYear, baseMonth + monthOffset, 1);
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();

      let periodStart: Date;
      let periodEnd: Date;

      if (periodIndex === 0) {
        // 1–14 of the month
        periodStart = new Date(year, month, 1);
        periodEnd = new Date(year, month, 14);
      } else {
        // 15–end of the month
        periodStart = new Date(year, month, 15);
        // Day 0 of next month is the last day of this month
        periodEnd = new Date(year, month + 1, 0);
      }

      periodStart.setHours(0, 0, 0, 0);
      periodEnd.setHours(0, 0, 0, 0);

      result.push({
        index: i + 1,
        start: periodStart,
        end: periodEnd,
      });
    }

    return result;
  }

  const startDateParsed = startDate ? new Date(`${startDate}T00:00:00`) : null;
  const fortnights =
    startDateParsed && !Number.isNaN(startDateParsed.getTime())
      ? generateFortnights(startDateParsed, PREVIEW_COUNT)
      : [];

  return (
    <div className="space-y-6">
      {/* Section 2 — Start date info */}
      <div className="space-y-2">
        <p className="text-foreground text-sm font-medium">
          Tus ciclos comenzarán el primer día del mes actual.
        </p>
        <p className="text-muted-foreground text-sm">
          A partir de esa fecha generaremos quincenas del 1 al 14 y del 15 al
          final de cada mes.
        </p>
      </div>

      {/* Section 3 — Fortnights preview */}
      {startDate && fortnights.length > 0 && (
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm font-medium">
            Vista previa de tus próximas quincenas
          </p>
          <ul className="flex flex-col gap-3" role="list">
            {fortnights.map((fn) => (
              <li
                key={fn.index}
                className="rounded-lg border p-4"
                role="listitem"
              >
                <p className="text-foreground font-medium">
                  Quincena {fn.index}
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {formatFortnightRange(fn.start, fn.end)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
