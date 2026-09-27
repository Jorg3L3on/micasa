'use client';

import { useEffect, useSyncExternalStore } from 'react';

type FortnightPeriod = 'FIRST' | 'SECOND';

let headerPeriod: FortnightPeriod | null = null;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => headerPeriod;
const getServerSnapshot = () => null;

const setHeaderPeriod = (period: FortnightPeriod | null) => {
  if (headerPeriod === period) return;
  headerPeriod = period;
  listeners.forEach((listener) => listener());
};

/** Panel financiero publishes the quincena on screen so the app toolbar title can show it. */
export const usePublishMonthlyHeaderPeriod = (period: FortnightPeriod | null) => {
  useEffect(() => {
    setHeaderPeriod(period);
    return () => setHeaderPeriod(null);
  }, [period]);
};

export const useMonthlyHeaderPeriod = (): FortnightPeriod | null =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

export const monthlyHeaderPeriodLabel = (period: FortnightPeriod): string =>
  period === 'FIRST' ? '1ª quincena' : '2ª quincena';

/** Narrow toolbar keeps the month and year visible. */
export const monthlyHeaderPeriodShortLabel = (period: FortnightPeriod): string =>
  period === 'FIRST' ? '1ª Qna' : '2ª Qna';
