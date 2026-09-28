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
import { LiquidityAccountsToday } from '@/components/wallets/liquidity/LiquidityAccountsToday';
import { LiquiditySpendingCategories } from '@/components/wallets/liquidity/LiquiditySpendingCategories';
import { LiquidityFundingWalletsMenu } from '@/components/wallets/liquidity/LiquidityFundingWalletsMenu';
import { buildLiquidityPayoffProgress } from '@/components/wallets/liquidity/liquidity-payoff-progress';
import {
  resolveInitialMonthKey,
  type LiquidityChartRangeId,
  type LiquidityCustomChartRange,
} from '@/components/wallets/liquidity/liquidity-personalization';
import {
  MONTHLY_PANEL_CONTENT_GRID_CLASS,
  MONTHLY_PANEL_MAIN_COLUMN_CLASS,
} from '@/components/monthly/MonthlyPanelLayout';
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
} from '@/lib/finance/liquidity-chart-range';
import { monthDebtPaymentsTotal } from '@/lib/finance/liquidity-month-debt-items';
import { cn } from '@/lib/utils';

const CHROME_SHELL_CLASS = cn(
  '@container',
  MONTHLY_LIQUID_PANEL_CLASS,
  MONTHLY_CHROME_PADDING_CLASS,
  'mb-5',
);

/** Always-visible aside: stacks under the main column until `xl`, then docks right like Panel financiero. */
const LIQUIDITY_ASIDE_CLASS = 'flex min-w-0 flex-col gap-5';

export type LiquidityProjectionTabProps = {
  data: LiquidityProjectionResponse | null;
  loading: boolean;
  error: string | null;
  onReload: () => void;
  selectedMonthKey: string;
  onSelectedMonthKeyChange: (monthKey: string) => void;
  /** Bumped after a pull-to-refresh so self-loading sections reload too. */
  refreshToken?: number;
};

export function LiquidityProjectionTab({
  data,
  loading,
  error,
  onReload,
  selectedMonthKey,
  onSelectedMonthKeyChange,
  refreshToken = 0,
}: LiquidityProjectionTabProps) {
  const [chartRange, setChartRange] = useState<LiquidityChartRangeId>(
    DEFAULT_LIQUIDITY_CHART_RANGE,
  );
  const [customRange, setCustomRange] = useState<LiquidityCustomChartRange | null>(null);

  const handleChartRangeChange = (next: LiquidityChartRangeId) => {
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

  const chartMonthKeys = useMemo(
    () =>
      new Set(
        visibleRange
          ? availableMonthKeys.filter(
              (monthKey) =>
                monthKey >= visibleRange.fromMonthKey && monthKey <= visibleRange.toMonthKey,
            )
          : [],
      ),
    [availableMonthKeys, visibleRange],
  );

  const chartMonths = useMemo(
    () => data?.monthly_series.filter((month) => chartMonthKeys.has(month.month_key)) ?? [],
    [chartMonthKeys, data?.monthly_series],
  );

  const monthKeys = useMemo(() => chartMonths.map((month) => month.month_key), [chartMonths]);

  useEffect(() => {
    if (!data || monthKeys.length === 0) return;
    if (selectedMonthKey && monthKeys.includes(selectedMonthKey)) return;
    onSelectedMonthKeyChange(resolveInitialMonthKey(monthKeys, data.as_of));
  }, [data, monthKeys, onSelectedMonthKeyChange, selectedMonthKey]);

  const resolvedMonthKey =
    selectedMonthKey && monthKeys.includes(selectedMonthKey)
      ? selectedMonthKey
      : resolveInitialMonthKey(monthKeys, data?.as_of ?? '');
  const selectedMonth =
    chartMonths.find((month) => month.month_key === resolvedMonthKey) ?? null;
  const selectedEvents = (data?.projection_events ?? []).filter(
    (event) => event.month_key === resolvedMonthKey,
  );
  const fundingTotal = data?.summary.funding_total ?? 0;
  const currentMonthKey = data?.as_of.slice(0, 7) ?? '';
  const isRefreshing = loading && data !== null;

  const payoff = useMemo(
    () =>
      buildLiquidityPayoffProgress({
        months: data?.monthly_series ?? [],
        currentMonthKey,
        selectedMonthKey: resolvedMonthKey,
        payoffMonthKey,
      }),
    [currentMonthKey, data?.monthly_series, payoffMonthKey, resolvedMonthKey],
  );

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
              monthKeys={monthKeys}
              selectedMonthKey={resolvedMonthKey}
              currentMonthKey={currentMonthKey}
              onSelectMonth={onSelectedMonthKeyChange}
              chartRange={chartRange}
              onChartRangeChange={handleChartRangeChange}
              payoff={payoff}
            />
          </div>

          <div className={MONTHLY_PANEL_CONTENT_GRID_CLASS}>
            <div
              className={cn(
                MONTHLY_PANEL_MAIN_COLUMN_CLASS,
                'space-y-4',
                isRefreshing && 'opacity-60 transition-opacity',
              )}
              aria-busy={isRefreshing}
            >
              {selectedMonth ? <LiquidityMonthMetrics month={selectedMonth} /> : null}

              <LiquidityFutureTimeline
                months={data.monthly_series}
                events={data.projection_events ?? []}
                visibleRange={visibleRange}
                onVisibleRangeChange={handleCustomRangeChange}
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

            <aside className={LIQUIDITY_ASIDE_CLASS} aria-label="Cuentas y gastos">
              <LiquidityAccountsToday
                fundingTotal={fundingTotal}
                onChanged={onReload}
                actions={<LiquidityFundingWalletsMenu onChanged={onReload} />}
                refreshToken={refreshToken}
              />
              <LiquiditySpendingCategories refreshToken={refreshToken} />
            </aside>
          </div>
        </>
      ) : null}
    </div>
  );
}
