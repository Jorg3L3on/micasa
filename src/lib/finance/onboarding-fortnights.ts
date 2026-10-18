import { isValidCalendarDateString } from '@/lib/calendar-dates';
import { getCanonicalFortnightBounds } from '@/lib/finance/budget-period-windows';

export type OnboardingFortnight = {
  startDate: Date;
  endDate: Date;
  month: number;
  year: number;
  period: 'FIRST' | 'SECOND';
};

/** Fortnights created when onboarding finishes. */
export const ONBOARDING_FORTNIGHT_COUNT = 4;

/**
 * Consecutive payday-aligned fortnights starting with FIRST of the month in
 * `startYmd`. Shared by the onboarding preview and POST /api/onboarding/complete
 * so the user sees exactly what gets created.
 */
export function generateOnboardingFortnights(
  startYmd: string,
  count: number = ONBOARDING_FORTNIGHT_COUNT,
): OnboardingFortnight[] {
  if (!isValidCalendarDateString(startYmd)) return [];

  const [baseYear, baseMonth] = startYmd.split('-').map(Number);
  const result: OnboardingFortnight[] = [];

  for (let i = 0; i < count; i++) {
    const period = i % 2 === 0 ? 'FIRST' : 'SECOND';
    const absoluteMonth = baseMonth + Math.floor(i / 2);
    const year = baseYear + Math.floor((absoluteMonth - 1) / 12);
    const month = ((absoluteMonth - 1) % 12) + 1;
    const bounds = getCanonicalFortnightBounds(year, month, period);

    result.push({
      startDate: bounds.start_date,
      endDate: bounds.end_date,
      month,
      year,
      period,
    });
  }

  return result;
}
