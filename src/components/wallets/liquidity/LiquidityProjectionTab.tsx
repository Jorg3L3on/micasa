'use client';

import { useEffect, useMemo, useState } from 'react';
import type { LiquidityProjectionResponse } from '@/types/catalog';
import { LiquidityChromeHeader } from '@/components/wallets/liquidity/LiquidityChromeHeader';
import { LiquidityFutureTimeline } from '@/components/wallets/liquidity/LiquidityFutureTimeline';
import {
  LiquidityMonthEvents,
  LiquidityMonthMetrics,
} from '@/components/wallets/liquidity/LiquidityMonthFocus';
import { LiquidityMonthDebtTabs } from '@/components/wallets/liquidity/LiquidityMonthDebtTabs';
import {
  resolveInitialMonthKey,
  type LiquidityChartRangeId,
  type LiquidityCustomChartRange,
} from '@/components/wallets/liquidity/liquidity-personalization';
import { MONTHLY_PANEL_MAIN_COLUMN_CLASS } from '@/components/monthly/MonthlyPanelLayout';
import {
  MONTHLY_CHROME_PADDING_CLASS,
  MONTHLY_LIQUID_PANEL_CLASS,
} from '@/components/monthly/monthly-panel-shell';
import { ErrorBanner } from '@/components/error-banner';
import { PlannerPageSkeleton } from '@/components/loading/page-skeletons';
import { Button } from '@/components/ui/button';
import {
  clampCustomChartRangeToAvailable,
  DEFAULT_LIQUIDITY_CHART_RANGE,
  defaultCustomChartRange,
  resolveDebtPayoffMonthKey,
  resolveLiquidityChartRange,
  type LiquidityChartPresetId,
} from '@/lib/finance/liquidity-chart-range';
import { monthDebtPaymentsTotal } from '@/lib/finance/liquidity-month-debt-items';
import { cn } from '@/lib/utils';

const CHROME_SHELL_CLASS = cn(
  '@container',
  MONTHLY_LIQUID_PANEL_CLASS,
  MONTHLY_CHROME_PADDING_CLASS,
  'mb-5',
);

export type LiquidityProjectionTabProps = {
  data: LiquidityProjectionResponse | null;
  loading: boolean;
  error: string | null;
  onReload: () => void;
  selectedMonthKey: string;
  onSelectedMonthKeyChange: (monthKey: string) => void;
};

export function LiquidityProjectionTab({
  data,
  loading,
  error,
  onReload,
  selectedMonthKey,
  onSelectedMonthKeyChange,
}: LiquidityProjectionTabProps) {
  const [chartRange, setChartRange] = useState<LiquidityChartRangeId>(
    DEFAULT_LIQUIDITY_CHART_RANGE,
  );
  const [customRange, setCustomRange] = useState<LiquidityCustomChartRange | null>(null);
  const [lastPreset, setLastPreset] = useState<LiquidityChartPresetId>(
    DEFAULT_LIQUIDITY_CHART_RANGE,
  );

  const handleChartRangeChange = (next: LiquidityChartRangeId) => {
    if (next !== 'custom') setLastPreset(next);
    setChartRange(next);
  };

  const handleCustomRangeChange = (range: LiquidityCustomChartRange) => {
    const available = data?.monthly_series.map((month) => month.month_key) ?? [];
    setCustomRange(clampCustomChartRangeToAvailable(range, available));
    setChartRange('custom');
  };

  const availableMonthKeys = useMemo(
    () => data?.monthly_series.map((month) => month.month_key) ?? [],
    [data],
  );

  const payoffMonthKey = useMemo(
    () =>
      resolveDebtPayoffMonthKey(
        (data?.monthly_series ?? []).map((month) => ({
          monthKey: month.month_key,
          paymentsDue: monthDebtPaymentsTotal(month.debt_items ?? []),
        })),
      ),
    [data?.monthly_series],
  );

  const visibleRange = useMemo<LiquidityCustomChartRange | null>(() => {
    if (!data || availableMonthKeys.length === 0) return null;
    const custom =
      chartRange === 'custom'
        ? (customRange ?? defaultCustomChartRange(data.as_of, availableMonthKeys))
        : null;
    const bounds = resolveLiquidityChartRange(chartRange, data.as_of, custom, payoffMonthKey);
    return clampCustomChartRangeToAvailable(bounds, availableMonthKeys);
  }, [availableMonthKeys, chartRange, customRange, data, payoffMonthKey]);

  useEffect(() => {
    if (!data || availableMonthKeys.length === 0) return;
    if (selectedMonthKey && availableMonthKeys.includes(selectedMonthKey)) return;
    onSelectedMonthKeyChange(resolveInitialMonthKey(availableMonthKeys, data.as_of));
  }, [availableMonthKeys, data, onSelectedMonthKeyChange, selectedMonthKey]);

  const resolvedMonthKey =
    selectedMonthKey && availableMonthKeys.includes(selectedMonthKey)
      ? selectedMonthKey
      : resolveInitialMonthKey(availableMonthKeys, data?.as_of ?? '');
  const selectedMonth =
    data?.monthly_series.find((month) => month.month_key === resolvedMonthKey) ?? null;

  /**
   * The month stepper walks every projected month. When the pick lands outside
   * the chart window, the window grows to include it (as a custom range) so the
   * user never has to change the range first.
   */
  const handleSelectMonth = (monthKey: string) => {
    onSelectedMonthKeyChange(monthKey);
    if (!visibleRange) return;
    if (monthKey >= visibleRange.fromMonthKey && monthKey <= visibleRange.toMonthKey) return;
    setCustomRange(
      clampCustomChartRangeToAvailable(
        {
          fromMonthKey:
            monthKey < visibleRange.fromMonthKey ? monthKey : visibleRange.fromMonthKey,
          toMonthKey: monthKey > visibleRange.toMonthKey ? monthKey : visibleRange.toMonthKey,
        },
        availableMonthKeys,
      ),
    );
    setChartRange('custom');
  };
  const selectedEvents = (data?.projection_events ?? []).filter(
    (event) => event.month_key === resolvedMonthKey,
  );
  const currentMonthKey = data?.as_of.slice(0, 7) ?? '';
  const isRefreshing = loading && data !== null;

  return (
    <div>
      {error ? (
        <div className="mb-5 space-y-3">
          <ErrorBanner>{error}</ErrorBanner>
          <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={onReload}>
            Reintentar
          </Button>
        </div>
      ) : null}

      {loading && !data ? <PlannerPageSkeleton /> : null}

      {data ? (
        <>
          <div className={CHROME_SHELL_CLASS}>
            <LiquidityChromeHeader
              monthKeys={availableMonthKeys}
              selectedMonthKey={resolvedMonthKey}
              currentMonthKey={currentMonthKey}
              onSelectMonth={handleSelectMonth}
            />
            {selectedMonth ? (
              <>
                <div className="my-2.5 h-px w-full bg-border/50 sm:my-3" aria-hidden />
                <LiquidityMonthMetrics month={selectedMonth} />
              </>
            ) : null}
          </div>

          <div
            className={cn(
              MONTHLY_PANEL_MAIN_COLUMN_CLASS,
              'space-y-4',
              isRefreshing && 'opacity-60 transition-opacity',
            )}
            aria-busy={isRefreshing}
          >
              <LiquidityFutureTimeline
                months={data.monthly_series}
                events={data.projection_events ?? []}
                visibleRange={visibleRange}
                onVisibleRangeChange={handleCustomRangeChange}
                chartRange={chartRange}
                customRange={chartRange === 'custom' ? visibleRange : null}
                lastPreset={lastPreset}
                onChartRangeChange={handleChartRangeChange}
                selectedMonthKey={resolvedMonthKey}
                onSelectMonth={onSelectedMonthKeyChange}
              />

              <LiquidityMonthEvents events={selectedEvents} />

              {selectedMonth ? (
                <LiquidityMonthDebtTabs
                  items={selectedMonth.debt_items ?? []}
                  outstandingTotal={selectedMonth.outstanding_debt_total ?? 0}
                />
              ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
