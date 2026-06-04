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
import type { ExpenseTableDensity } from '@/components/ExpenseTable';

const LAYOUT_STORAGE_KEY = 'micasa.planificacion.layout';
const PERIOD_STORAGE_KEY = 'micasa.planificacion.period';
const SUMMARY_VISIBLE_STORAGE_KEY = 'micasa.planificacion.summaryVisible';
const TABLE_DENSITY_STORAGE_KEY = 'micasa.planificacion.tableDensity';

type FortnightPeriod = 'FIRST' | 'SECOND';

type MonthlyPanelPreferencesValue = {
  prefsReady: boolean;
  period: FortnightPeriod;
  summaryVisible: boolean;
  tableDensity: ExpenseTableDensity;
  setPeriod: (period: FortnightPeriod) => void;
  setSummaryVisible: (visible: boolean) => void;
  setTableDensity: (density: ExpenseTableDensity) => void;
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
  const [prefsReady, setPrefsReady] = useState(false);
  const [period, setPeriodState] = useState<FortnightPeriod>(suggestedPeriod);
  const [summaryVisible, setSummaryVisibleState] = useState(true);
  const [tableDensity, setTableDensityState] =
    useState<ExpenseTableDensity>('comfortable');
  const preferenceScope = getMonthlyPreferenceScope(ownerKey, year, month);

  useEffect(() => {
    migrateStoredLayout(preferenceScope);
    try {
      const storedPeriod = localStorage.getItem(
        storageKey(PERIOD_STORAGE_KEY, preferenceScope),
      );
      if (storedPeriod === 'FIRST' || storedPeriod === 'SECOND') {
        setPeriodState(storedPeriod);
      }
      const storedSummary = localStorage.getItem(
        storageKey(SUMMARY_VISIBLE_STORAGE_KEY, preferenceScope),
      );
      if (storedSummary === 'true') setSummaryVisibleState(true);
      if (storedSummary === 'false') setSummaryVisibleState(false);
      const storedDensity = localStorage.getItem(
        storageKey(TABLE_DENSITY_STORAGE_KEY, preferenceScope),
      );
      if (storedDensity === 'comfortable' || storedDensity === 'compact') {
        setTableDensityState(storedDensity);
      }
    } catch {
      /* ignore */
    }
    setPrefsReady(true);
  }, [preferenceScope]);

  const setPeriod = useCallback(
    (value: FortnightPeriod) => {
      setPeriodState(value);
      try {
        localStorage.setItem(storageKey(PERIOD_STORAGE_KEY, preferenceScope), value);
      } catch {
        /* ignore */
      }
    },
    [preferenceScope],
  );

  const setSummaryVisible = useCallback(
    (visible: boolean) => {
      setSummaryVisibleState(visible);
      try {
        localStorage.setItem(
          storageKey(SUMMARY_VISIBLE_STORAGE_KEY, preferenceScope),
          visible ? 'true' : 'false',
        );
      } catch {
        /* ignore */
      }
    },
    [preferenceScope],
  );

  const setTableDensity = useCallback(
    (density: ExpenseTableDensity) => {
      setTableDensityState(density);
      try {
        localStorage.setItem(
          storageKey(TABLE_DENSITY_STORAGE_KEY, preferenceScope),
          density,
        );
      } catch {
        /* ignore */
      }
    },
    [preferenceScope],
  );

  const value = useMemo(
    () => ({
      prefsReady,
      period,
      summaryVisible,
      tableDensity,
      setPeriod,
      setSummaryVisible,
      setTableDensity,
    }),
    [
      prefsReady,
      period,
      summaryVisible,
      tableDensity,
      setPeriod,
      setSummaryVisible,
      setTableDensity,
    ],
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
