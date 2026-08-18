'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getMonthlyPreferenceScope } from '@/lib/planner/monthly-page';

const LAYOUT_STORAGE_KEY = 'micasa.planificacion.layout';
/** Legacy key — period is no longer persisted so opening Panel financiero uses the current quincena. */
const PERIOD_STORAGE_KEY = 'micasa.planificacion.period';
/** Legacy key — summary visibility toggle was removed; summary is always shown. */
const SUMMARY_VISIBLE_STORAGE_KEY = 'micasa.planificacion.summaryVisible';

type FortnightPeriod = 'FIRST' | 'SECOND';

type MonthlyPanelPreferencesValue = {
  prefsReady: boolean;
  period: FortnightPeriod;
  setPeriod: (period: FortnightPeriod) => void;
};

const MonthlyPanelPreferencesContext =
  createContext<MonthlyPanelPreferencesValue | null>(null);

const storageKey = (base: string, scope: string) => `${base}:${scope}`;

const migrateStoredLayout = (scope: string) => {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(storageKey(LAYOUT_STORAGE_KEY, scope));
    if (raw === 'both') {
      localStorage.setItem(storageKey(LAYOUT_STORAGE_KEY, scope), 'single');
    }
    // Drop stale period so a previous quincena choice cannot override the calendar default.
    localStorage.removeItem(storageKey(PERIOD_STORAGE_KEY, scope));
    localStorage.removeItem(storageKey(SUMMARY_VISIBLE_STORAGE_KEY, scope));
  } catch {
    /* ignore */
  }
};

type MonthlyPanelPreferencesProviderProps = {
  ownerKey: string;
  year: number;
  month: number;
  suggestedPeriod: FortnightPeriod;
  children: ReactNode;
};

export const MonthlyPanelPreferencesProvider = ({
  ownerKey,
  year,
  month,
  suggestedPeriod,
  children,
}: MonthlyPanelPreferencesProviderProps) => {
  const [period, setPeriodState] = useState<FortnightPeriod>(suggestedPeriod);
  const preferenceScope = getMonthlyPreferenceScope(ownerKey, year, month);

  useEffect(() => {
    migrateStoredLayout(preferenceScope);
  }, [preferenceScope]);

  useEffect(() => {
    setPeriodState(suggestedPeriod);
  }, [preferenceScope, suggestedPeriod]);

  const setPeriod = useCallback((value: FortnightPeriod) => {
    setPeriodState(value);
  }, []);

  const value = useMemo(
    () => ({
      prefsReady: true,
      period,
      setPeriod,
    }),
    [period, setPeriod],
  );

  return (
    <MonthlyPanelPreferencesContext.Provider value={value}>
      {children}
    </MonthlyPanelPreferencesContext.Provider>
  );
};

export const useMonthlyPanelPreferences = () => {
  const ctx = useContext(MonthlyPanelPreferencesContext);
  if (!ctx) {
    throw new Error(
      'useMonthlyPanelPreferences must be used within MonthlyPanelPreferencesProvider',
    );
  }
  return ctx;
};
