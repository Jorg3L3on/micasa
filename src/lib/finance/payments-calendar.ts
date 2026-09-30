import type { PaymentsCalendarItem } from '@/types/payments-calendar';

export type CalendarYearMonth = { year: number; month: number };

/** Unique civil days that have at least one pending calendar item. */
export function pendingDatesFromCalendarItems(
  items: PaymentsCalendarItem[],
): string[] {
  const dates = new Set<string>();
  for (const item of items) {
    dates.add(item.date);
  }
  return [...dates].sort();
}

export function itemsForCalendarDate(
  items: PaymentsCalendarItem[],
  ymd: string,
): PaymentsCalendarItem[] {
  return items.filter((item) => item.date === ymd);
}

/**
 * Default selected day: today when viewing the current month; otherwise the
 * first day with pending items, or the 1st of the month when none.
 */
export function defaultSelectedCalendarDay(params: {
  year: number;
  month: number;
  isCurrentMonth: boolean;
  todayYmd: string;
  pendingDates: string[];
}): string {
  const mm = String(params.month).padStart(2, '0');
  const firstOfMonth = `${params.year}-${mm}-01`;

  if (params.isCurrentMonth) {
    return params.todayYmd;
  }
  return params.pendingDates[0] ?? firstOfMonth;
}

/** True when the widget's viewed month is the civil month of `todayYmd`. */
export function isViewedCivilCurrentMonth(
  viewYear: number,
  viewMonth: number,
  todayYmd: string,
): boolean {
  const ty = Number(todayYmd.slice(0, 4));
  const tm = Number(todayYmd.slice(5, 7));
  return viewYear === ty && viewMonth === tm;
}

export function compareYearMonth(
  a: CalendarYearMonth,
  b: CalendarYearMonth,
): number {
  return a.year !== b.year ? a.year - b.year : a.month - b.month;
}

/**
 * Adjacent month that already has both fortnights, or null at the bound.
 * If `current` is missing from the list, finds the nearest month in `direction`.
 */
export function neighborCreatedMonth(
  createdMonths: CalendarYearMonth[],
  current: CalendarYearMonth,
  direction: -1 | 1,
): CalendarYearMonth | null {
  const sorted = [...createdMonths].sort(compareYearMonth);
  const idx = sorted.findIndex(
    (m) => m.year === current.year && m.month === current.month,
  );

  if (idx >= 0) {
    return sorted[idx + direction] ?? null;
  }

  if (direction === 1) {
    return sorted.find((m) => compareYearMonth(m, current) > 0) ?? null;
  }

  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    if (compareYearMonth(sorted[i]!, current) < 0) {
      return sorted[i]!;
    }
  }
  return null;
}
