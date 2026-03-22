'use client';

import { useCallback, useEffect, useState } from 'react';
import FortnightColumn from '@/components/FortnightColumn';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { TransactionRow } from '@/types/catalog';

const LAYOUT_STORAGE_KEY = 'micasa.planificacion.layout';
const PERIOD_STORAGE_KEY = 'micasa.planificacion.period';
const SUMMARY_VISIBLE_STORAGE_KEY = 'micasa.planificacion.summaryVisible';

type LayoutMode = 'single' | 'both';
type FortnightPeriod = 'FIRST' | 'SECOND';

type FortnightSummary = {
  totalIncome: number;
  totalExpense: number;
  totalPaid: number;
  totalUnpaid: number;
  balance: number;
  userIncome?: Array<{
    fortnightId: number;
    userIncome: Array<{ userId: number; userName: string; income: number }>;
  }>;
  incomeItems?: Array<{
    fortnightId: number;
    id: number;
    amount: number;
    source: string | null;
    userName: string | null;
    templateName: string | null;
  }>;
};

type FortnightBundle = {
  label: string;
  transactions: TransactionRow[];
  summary: FortnightSummary;
  fortnightId: number;
};

export type MonthlyFortnightViewProps = {
  ownerKey: string;
  year: number;
  month: number;
  suggestedPeriod: FortnightPeriod;
  first: FortnightBundle;
  second: FortnightBundle;
};

const readStoredLayout = (): LayoutMode | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (raw === 'single' || raw === 'both') return raw;
  } catch {
    return null;
  }
  return null;
};

const readStoredPeriod = (): FortnightPeriod | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PERIOD_STORAGE_KEY);
    if (raw === 'FIRST' || raw === 'SECOND') return raw;
  } catch {
    return null;
  }
  return null;
};

const persistLayout = (layout: LayoutMode) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY, layout);
  } catch {
    /* ignore */
  }
};

const persistPeriod = (period: FortnightPeriod) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PERIOD_STORAGE_KEY, period);
  } catch {
    /* ignore */
  }
};

const readStoredSummaryVisible = (): boolean | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SUMMARY_VISIBLE_STORAGE_KEY);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
  } catch {
    return null;
  }
  return null;
};

const persistSummaryVisible = (visible: boolean) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SUMMARY_VISIBLE_STORAGE_KEY, visible ? 'true' : 'false');
  } catch {
    /* ignore */
  }
};

export default function MonthlyFortnightView({
  ownerKey,
  year,
  month,
  suggestedPeriod,
  first,
  second,
}: MonthlyFortnightViewProps) {
  const [layout, setLayout] = useState<LayoutMode>('single');
  const [period, setPeriod] = useState<FortnightPeriod>(suggestedPeriod);
  const [summaryVisible, setSummaryVisible] = useState(true);

  useEffect(() => {
    const storedLayout = readStoredLayout();
    const storedPeriod = readStoredPeriod();
    const storedSummary = readStoredSummaryVisible();
    if (storedLayout) {
      setLayout(storedLayout);
    }
    if (storedPeriod) {
      setPeriod(storedPeriod);
    }
    if (storedSummary !== null) {
      setSummaryVisible(storedSummary);
    }
  }, []);

  const handleLayoutSingle = useCallback(() => {
    setLayout('single');
    persistLayout('single');
  }, []);

  const handleLayoutBoth = useCallback(() => {
    setLayout('both');
    persistLayout('both');
  }, []);

  const handlePeriodChange = useCallback((value: string) => {
    if (value !== 'FIRST' && value !== 'SECOND') return;
    setPeriod(value);
    persistPeriod(value);
  }, []);

  const handleSummaryShowToolbar = useCallback(() => {
    setSummaryVisible(true);
    persistSummaryVisible(true);
  }, []);

  const handleSummaryHideToolbar = useCallback(() => {
    setSummaryVisible(false);
    persistSummaryVisible(false);
  }, []);

  const handleShowSummaryFromColumn = useCallback(() => {
    setSummaryVisible(true);
    persistSummaryVisible(true);
  }, []);

  const showFirst = layout === 'both' || period === 'FIRST';
  const showSecond = layout === 'both' || period === 'SECOND';

  return (
    <div className="space-y-4">
      <div
        className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
        role="region"
        aria-label="Controles de vista de quincenas"
      >
        <div
          className="flex flex-col gap-1.5"
          role="group"
          aria-label="Modo de vista"
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Vista
          </span>
          <div className="inline-flex rounded-lg bg-muted p-[3px]">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                'h-8 rounded-md px-3 shadow-none',
                layout === 'single' &&
                  'bg-background text-foreground shadow-sm dark:bg-input/30',
              )}
              aria-pressed={layout === 'single'}
              aria-label="Mostrar una sola quincena"
              onClick={handleLayoutSingle}
            >
              Una quincena
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                'h-8 rounded-md px-3 shadow-none',
                layout === 'both' &&
                  'bg-background text-foreground shadow-sm dark:bg-input/30',
              )}
              aria-pressed={layout === 'both'}
              aria-label="Mostrar ambas quincenas"
              onClick={handleLayoutBoth}
            >
              Ambas quincenas
            </Button>
          </div>
        </div>

        {layout === 'single' ? (
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Quincena
            </span>
            <Tabs
              value={period}
              onValueChange={handlePeriodChange}
              className="w-full min-w-0 sm:w-auto"
            >
              <TabsList className="h-auto w-full min-w-0 flex-wrap sm:w-fit">
                <TabsTrigger
                  value="FIRST"
                  className="shrink-0"
                  title={first.label}
                  aria-label={`Primera quincena: ${first.label}`}
                >
                  1ª quincena
                </TabsTrigger>
                <TabsTrigger
                  value="SECOND"
                  className="shrink-0"
                  title={second.label}
                  aria-label={`Segunda quincena: ${second.label}`}
                >
                  2ª quincena
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        ) : null}

        <div
          className="flex flex-col gap-1.5 sm:items-end"
          role="group"
          aria-label="Visibilidad del resumen por quincena"
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Tarjetas de resumen
          </span>
          <div className="inline-flex rounded-lg bg-muted p-[3px]">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                'h-8 rounded-md px-3 shadow-none',
                summaryVisible &&
                  'bg-background text-foreground shadow-sm dark:bg-input/30',
              )}
              aria-pressed={summaryVisible}
              aria-label="Mostrar tarjetas de resumen de cada quincena"
              onClick={handleSummaryShowToolbar}
            >
              Visibles
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                'h-8 rounded-md px-3 shadow-none',
                !summaryVisible &&
                  'bg-background text-foreground shadow-sm dark:bg-input/30',
              )}
              aria-pressed={!summaryVisible}
              aria-label="Ocultar tarjetas de resumen de cada quincena"
              onClick={handleSummaryHideToolbar}
            >
              Ocultas
            </Button>
          </div>
        </div>
      </div>

      <div
        className={cn(
          'grid gap-6',
          layout === 'both' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1',
        )}
      >
        {showFirst ? (
          <FortnightColumn
            key={`${ownerKey}-${year}-${month}-FIRST`}
            label={first.label}
            transactions={first.transactions}
            summary={first.summary}
            fortnightId={first.fortnightId}
            year={year}
            month={month}
            period="FIRST"
            showSummaryCard={summaryVisible}
            onShowSummaryCard={handleShowSummaryFromColumn}
          />
        ) : null}
        {showSecond ? (
          <FortnightColumn
            key={`${ownerKey}-${year}-${month}-SECOND`}
            label={second.label}
            transactions={second.transactions}
            summary={second.summary}
            fortnightId={second.fortnightId}
            year={year}
            month={month}
            period="SECOND"
            showSummaryCard={summaryVisible}
            onShowSummaryCard={handleShowSummaryFromColumn}
          />
        ) : null}
      </div>
    </div>
  );
}
