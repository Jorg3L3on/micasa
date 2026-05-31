'use client';

import { todayCalendarDate } from '@/lib/calendar-dates';
import { useSyncExternalStore } from 'react';

const noopSubscribe = () => () => {};

const getClientSnapshot = () => todayCalendarDate();

/**
 * Mexico City calendar YYYY-MM-DD. Server + hydration use a fixed sentinel so markup
 * matches; then switches to the real date (avoids vencido/pagado drift across SSR vs client).
 */
export function useHydrationSafeTodayYmd(): string {
  return useSyncExternalStore(
    noopSubscribe,
    getClientSnapshot,
    () => '1970-01-01',
  );
}
