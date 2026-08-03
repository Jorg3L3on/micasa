'use client';

import { useEffect } from 'react';
import { useOnboarding } from '@/components/onboarding/OnboardingContext';
import {
  formatCalendarDate,
  isValidCalendarDateString,
} from '@/lib/calendar-dates';
import { getCanonicalFortnightBounds } from '@/lib/finance/budget-period-windows';

type Props = {
  setCanProceed?: (value: boolean) => void;
};

const PREVIEW_COUNT = 4;

const dateFormatter = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short',
  timeZone: 'America/Mexico_City',
});

function formatFortnightRange(start: Date, end: Date): string {
  return `${dateFormatter.format(start)} → ${dateFormatter.format(end)}`;
}

function generateFortnights(
  startYmd: string,
  count: number,
): { index: number; start: Date; end: Date }[] {
  if (!isValidCalendarDateString(startYmd)) return [];

  const result: { index: number; start: Date; end: Date }[] = [];
  const [baseYear, baseMonth] = startYmd.split('-').map(Number);

  for (let i = 0; i < count; i++) {
    const monthOffset = Math.floor(i / 2);
    const period = i % 2 === 0 ? 'FIRST' : 'SECOND';
    const absoluteMonth = baseMonth + monthOffset;
    const year = baseYear + Math.floor((absoluteMonth - 1) / 12);
    const month = ((absoluteMonth - 1) % 12) + 1;
    const bounds = getCanonicalFortnightBounds(year, month, period);

    result.push({
      index: i + 1,
      start: bounds.start_date,
      end: bounds.end_date,
    });
  }

  return result;
}

export default function StepFortnights({
  setCanProceed: setCanProceedProp,
}: Props) {
  const { setCanProceed: contextSetCanProceed, startDate } = useOnboarding();
  const setCanProceed = setCanProceedProp ?? contextSetCanProceed;

  useEffect(() => {
    setCanProceed(true);
  }, [setCanProceed]);

  const fortnights =
    startDate && isValidCalendarDateString(startDate)
      ? generateFortnights(startDate, PREVIEW_COUNT)
      : [];

  return (
    <div className="space-y-6">
      {/* Section 2 — Start date info */}
      <div className="space-y-2">
        <p className="text-foreground text-sm font-medium">
          Tus ciclos comenzarán el primer día del mes actual.
        </p>
        <p className="text-muted-foreground text-sm">
          A partir de esa fecha generaremos quincenas del 1 al 15 y del 16 al
          final de cada mes.
        </p>
      </div>

      {/* Section 3 — Fortnights preview */}
      {startDate && fortnights.length > 0 && (
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm font-medium">
            Vista previa de tus próximas quincenas
          </p>
          <ul className="space-y-1.5">
            {fortnights.map((fortnight) => (
              <li
                key={`${formatCalendarDate(fortnight.start)}-${formatCalendarDate(fortnight.end)}`}
                className="text-sm text-foreground"
              >
                Quincena {fortnight.index}:{' '}
                {formatFortnightRange(fortnight.start, fortnight.end)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
