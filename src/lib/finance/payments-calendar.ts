import { addCalendarDays } from '@/lib/calendar-dates';
import {
  getCalendarFortnightRefForYmd,
  getDaysInCalendarMonth,
  getFortnightYmdBounds,
  shiftCalendarMonth,
  type CalendarFortnightPeriod,
  type CalendarFortnightRef,
} from '@/lib/fortnight-calendar';
import type { PaymentsCalendarItem } from '@/types/payments-calendar';

export type CalendarYearMonth = { year: number; month: number };

export type CalendarViewMode = 'week' | 'fortnight' | 'month';

export type CalendarWindowBounds = {
  startYmd: string;
  endYmd: string;
};

const pad2 = (value: number): string => String(value).padStart(2, '0');

const toYmd = (year: number, month: number, day: number): string =>
  `${year}-${pad2(month)}-${pad2(day)}`;

const parseYmdParts = (
  ymd: string,
): { year: number; month: number; day: number } => {
  const [year, month, day] = ymd.split('-').map(Number);
  return { year, month, day };
};

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

/**
 * Default selected day inside a clipped view window: today when it falls in
 * the window; otherwise the first pending day in range, or the window start.
 */
export function defaultSelectedDayInWindow(params: {
  startYmd: string;
  endYmd: string;
  todayYmd: string;
  pendingDates: string[];
}): string {
  const { startYmd, endYmd, todayYmd, pendingDates } = params;
  if (todayYmd >= startYmd && todayYmd <= endYmd) {
    return todayYmd;
  }
  const pendingInWindow = pendingDates.filter(
    (d) => d >= startYmd && d <= endYmd,
  );
  return pendingInWindow[0] ?? startYmd;
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

const yearMonthKey = (m: CalendarYearMonth): string =>
  `${m.year}-${pad2(m.month)}`;

const hasCreatedMonth = (
  created: ReadonlySet<string>,
  year: number,
  month: number,
): boolean => created.has(yearMonthKey({ year, month }));

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

/** Monday–Sunday civil window containing `ymd`. */
export function weekBoundsContaining(ymd: string): CalendarWindowBounds {
  const { year, month, day } = parseYmdParts(ymd);
  // Monday-first: Sun=6 … Mon=0
  const mondayOffset = (new Date(year, month - 1, day).getDay() + 6) % 7;
  const startYmd = addCalendarDays(ymd, -mondayOffset);
  return { startYmd, endYmd: addCalendarDays(startYmd, 6) };
}

/** MiCasa fortnight window containing `ymd`. */
export function fortnightBoundsContaining(ymd: string): CalendarWindowBounds {
  const ref = getCalendarFortnightRefForYmd(ymd);
  return getFortnightYmdBounds(ref.year, ref.month, ref.period);
}

export function monthBounds(
  year: number,
  month: number,
): CalendarWindowBounds {
  return {
    startYmd: toYmd(year, month, 1),
    endYmd: toYmd(year, month, getDaysInCalendarMonth(year, month)),
  };
}

export function boundsForViewMode(
  mode: CalendarViewMode,
  anchorYmd: string,
): CalendarWindowBounds {
  if (mode === 'week') return weekBoundsContaining(anchorYmd);
  if (mode === 'fortnight') return fortnightBoundsContaining(anchorYmd);
  const { year, month } = parseYmdParts(anchorYmd);
  return monthBounds(year, month);
}

/** Distinct civil months touched by an inclusive YYYY-MM-DD range. */
export function windowMonths(
  startYmd: string,
  endYmd: string,
): CalendarYearMonth[] {
  const start = parseYmdParts(startYmd);
  const end = parseYmdParts(endYmd);
  const months: CalendarYearMonth[] = [];
  let cursor: CalendarYearMonth = { year: start.year, month: start.month };
  const last: CalendarYearMonth = { year: end.year, month: end.month };

  while (compareYearMonth(cursor, last) <= 0) {
    months.push(cursor);
    cursor = shiftCalendarMonth(cursor.year, cursor.month, 1);
  }
  return months;
}

/** True when every civil day in the window falls in a created month. */
export function isWindowFullyCreated(
  startYmd: string,
  endYmd: string,
  createdMonths: CalendarYearMonth[],
): boolean {
  if (createdMonths.length === 0) return false;
  const created = new Set(createdMonths.map(yearMonthKey));
  return windowMonths(startYmd, endYmd).every((m) =>
    hasCreatedMonth(created, m.year, m.month),
  );
}

const shiftFortnightRef = (
  ref: CalendarFortnightRef,
  direction: -1 | 1,
): CalendarFortnightRef => {
  if (direction === 1) {
    if (ref.period === 'FIRST') {
      return { year: ref.year, month: ref.month, period: 'SECOND' };
    }
    const next = shiftCalendarMonth(ref.year, ref.month, 1);
    return { year: next.year, month: next.month, period: 'FIRST' };
  }
  if (ref.period === 'SECOND') {
    return { year: ref.year, month: ref.month, period: 'FIRST' };
  }
  const prev = shiftCalendarMonth(ref.year, ref.month, -1);
  return { year: prev.year, month: prev.month, period: 'SECOND' };
};

const uncheckedNeighborBounds = (
  mode: CalendarViewMode,
  current: CalendarWindowBounds,
  direction: -1 | 1,
): CalendarWindowBounds => {
  if (mode === 'week') {
    const startYmd = addCalendarDays(current.startYmd, direction * 7);
    return { startYmd, endYmd: addCalendarDays(startYmd, 6) };
  }
  if (mode === 'fortnight') {
    const ref = getCalendarFortnightRefForYmd(current.startYmd);
    // FIRST starts on last day of previous month — ref from startYmd is correct.
    const next = shiftFortnightRef(ref, direction);
    return getFortnightYmdBounds(next.year, next.month, next.period);
  }
  const { year, month } = parseYmdParts(current.startYmd);
  const next = shiftCalendarMonth(year, month, direction);
  return monthBounds(next.year, next.month);
};

/**
 * Adjacent valid view window, or null when none exists within created months.
 * Walks up to a safe max of steps so spillover fortnights/weeks are skipped.
 */
export function neighborWindow(
  mode: CalendarViewMode,
  current: CalendarWindowBounds,
  direction: -1 | 1,
  createdMonths: CalendarYearMonth[],
): CalendarWindowBounds | null {
  if (createdMonths.length === 0) return null;

  if (mode === 'month') {
    const { year, month } = parseYmdParts(current.startYmd);
    const neighbor = neighborCreatedMonth(
      createdMonths,
      { year, month },
      direction,
    );
    return neighbor ? monthBounds(neighbor.year, neighbor.month) : null;
  }

  let cursor = current;
  // Enough to skip across gaps between sparse created months.
  for (let step = 0; step < 48; step += 1) {
    cursor = uncheckedNeighborBounds(mode, cursor, direction);
    if (isWindowFullyCreated(cursor.startYmd, cursor.endYmd, createdMonths)) {
      return cursor;
    }
  }
  return null;
}

const daysBetween = (a: string, b: string): number => {
  const aParts = parseYmdParts(a);
  const bParts = parseYmdParts(b);
  const aUtc = Date.UTC(aParts.year, aParts.month - 1, aParts.day);
  const bUtc = Date.UTC(bParts.year, bParts.month - 1, bParts.day);
  return Math.round((bUtc - aUtc) / 86_400_000);
};

/**
 * Window for `mode` anchored on today when valid; otherwise the nearest valid
 * window (prefer future on distance ties). Null when no valid window exists.
 */
export function resolveInitialWindow(
  mode: CalendarViewMode,
  todayYmd: string,
  createdMonths: CalendarYearMonth[],
): CalendarWindowBounds | null {
  if (createdMonths.length === 0) return null;

  if (mode === 'month') {
    const { year, month } = parseYmdParts(todayYmd);
    if (
      createdMonths.some((m) => m.year === year && m.month === month)
    ) {
      return monthBounds(year, month);
    }
    const sorted = [...createdMonths].sort(compareYearMonth);
    // Prefer nearest month; on tie prefer future.
    let best: CalendarYearMonth | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const m of sorted) {
      const mid = toYmd(m.year, m.month, 15);
      const dist = Math.abs(daysBetween(todayYmd, mid));
      const isFuture = mid >= todayYmd;
      if (
        dist < bestDist ||
        (dist === bestDist &&
          isFuture &&
          best != null &&
          toYmd(best.year, best.month, 15) < todayYmd)
      ) {
        bestDist = dist;
        best = m;
      }
    }
    return best ? monthBounds(best.year, best.month) : null;
  }

  const candidate = boundsForViewMode(mode, todayYmd);
  if (
    isWindowFullyCreated(candidate.startYmd, candidate.endYmd, createdMonths)
  ) {
    return candidate;
  }

  let forward: CalendarWindowBounds | null = null;
  let backward: CalendarWindowBounds | null = null;
  let cursorFwd = candidate;
  let cursorBack = candidate;

  for (let step = 0; step < 48; step += 1) {
    if (!forward) {
      cursorFwd = uncheckedNeighborBounds(mode, cursorFwd, 1);
      if (
        isWindowFullyCreated(
          cursorFwd.startYmd,
          cursorFwd.endYmd,
          createdMonths,
        )
      ) {
        forward = cursorFwd;
      }
    }
    if (!backward) {
      cursorBack = uncheckedNeighborBounds(mode, cursorBack, -1);
      if (
        isWindowFullyCreated(
          cursorBack.startYmd,
          cursorBack.endYmd,
          createdMonths,
        )
      ) {
        backward = cursorBack;
      }
    }
    if (forward && backward) break;
  }

  if (forward && backward) {
    const distFwd = Math.abs(daysBetween(todayYmd, forward.startYmd));
    const distBack = Math.abs(daysBetween(todayYmd, backward.startYmd));
    if (distFwd < distBack) return forward;
    if (distBack < distFwd) return backward;
    return forward; // prefer future on tie
  }
  return forward ?? backward;
}

/** Fortnight ref for a window start (for titles). */
export function fortnightRefForWindow(
  bounds: CalendarWindowBounds,
): CalendarFortnightRef {
  return getCalendarFortnightRefForYmd(bounds.startYmd);
}

export type { CalendarFortnightPeriod, CalendarFortnightRef };
