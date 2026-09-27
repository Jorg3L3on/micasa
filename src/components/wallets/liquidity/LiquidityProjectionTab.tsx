'use client';

import { useEffect, useMemo, useState } from 'react';
import { CreditCard, PieChart } from 'lucide-react';
import type { LiquidityProjectionResponse } from '@/types/catalog';
import { LiquidityFutureTimeline } from '@/components/wallets/liquidity/LiquidityFutureTimeline';
import { LiquidityMonthFocus } from '@/components/wallets/liquidity/LiquidityMonthFocus';
import { LiquidityAccountsToday } from '@/components/wallets/liquidity/LiquidityAccountsToday';
import { LiquiditySpendingCategories } from '@/components/wallets/liquidity/LiquiditySpendingCategories';
import { LiquidityFundingWalletsMenu } from '@/components/wallets/liquidity/LiquidityFundingWalletsMenu';
import {
  LiquidityPanelConnector,
  LiquiditySectionGroup,
} from '@/components/wallets/liquidity/liquidity-section';
import {
  resolveInitialMonthKey,
  shiftSelectedMonthKey,
  type LiquidityChartRangeId,
  type LiquidityCustomChartRange,
} from '@/components/wallets/liquidity/liquidity-personalization';
import {
  clampCustomChartRangeToAvailable,
  DEFAULT_LIQUIDITY_CHART_RANGE,
  defaultCustomChartRange,
  resolveDebtPayoffMonthKey,
  resolveLiquidityChartRange,
} from '@/lib/finance/liquidity-chart-range';
import { monthDebtPaymentsTotal } from '@/lib/finance/liquidity-month-debt-items';

function LoadingSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="space-y-4">
        <div className="h-5 w-48 rounded-lg bg-muted/40" />
        <div className="h-80 rounded-2xl border border-border/30 bg-muted/30 dark:border-white/[0.06] dark:bg-[#0d1327]/40" />
        <div className="h-56 rounded-2xl border border-border/30 bg-muted/30 dark:border-white/[0.06] dark:bg-[#0d1327]/40" />
      </div>
    </div>
  );
}

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

  const projectionEvents = useMemo(
    () =>
      (data?.projection_events ?? []).filter((event) => chartMonthKeys.has(event.month_key)),
    [chartMonthKeys, data?.projection_events],
  );

  const monthKeys = chartMonths.map((month) => month.month_key);
  const monthKeyList = monthKeys.join('|');

  useEffect(() => {
    if (!data || monthKeys.length === 0) return;
    if (selectedMonthKey && monthKeys.includes(selectedMonthKey)) return;
    onSelectedMonthKeyChange(resolveInitialMonthKey(monthKeys, data.as_of));
  }, [data, monthKeyList, monthKeys, onSelectedMonthKeyChange, selectedMonthKey]);

  const resolvedMonthKey =
    selectedMonthKey && monthKeys.includes(selectedMonthKey)
      ? selectedMonthKey
      : resolveInitialMonthKey(monthKeys, data?.as_of ?? '');
  const selectedMonth =
    chartMonths.find((month) => month.month_key === resolvedMonthKey) ??
    null;
  const selectedIndex = monthKeys.indexOf(resolvedMonthKey);
  const selectedEvents = projectionEvents.filter(
    (event) => event.month_key === resolvedMonthKey,
  );
  const fundingTotal = data?.summary.funding_total ?? 0;
  const currentMonthKey = data?.as_of.slice(0, 7) ?? '';
  const isChartRefreshing = loading && data !== null;

  const handleShiftMonth = (delta: number) => {
    onSelectedMonthKeyChange(shiftSelectedMonthKey(monthKeys, resolvedMonthKey, delta));
  };

  return (
    <div className="space-y-10">
      {error ? (
        <div
          className="rounded-xl border border-l-[3px] border-l-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {loading && !data ? <LoadingSkeleton /> : null}

      {data ? (
        <>
          <LiquiditySectionGroup aria-label="Proyección mensual">
            <LiquidityPanelConnector>
              <LiquidityFutureTimeline
                months={data.monthly_series}
                events={data.projection_events ?? []}
                visibleRange={visibleRange}
                chartRange={chartRange}
                onChartRangeChange={handleChartRangeChange}
                onVisibleRangeChange={handleCustomRangeChange}
                selectedMonthKey={resolvedMonthKey}
                onSelectMonth={onSelectedMonthKeyChange}
                isRefreshing={false}
                embedded
              />

              <div className="border-t border-border/50 dark:border-white/[0.06]">
                <LiquidityMonthFocus
                  month={selectedMonth}
                  events={selectedEvents}
                  isCurrentMonth={selectedMonth?.month_key === currentMonthKey}
                  canPrev={selectedIndex > 0}
                  canNext={selectedIndex >= 0 && selectedIndex < monthKeys.length - 1}
                  onPrevMonth={() => handleShiftMonth(-1)}
                  onNextMonth={() => handleShiftMonth(1)}
                  isRefreshing={isChartRefreshing}
                  embedded
                />
              </div>
            </LiquidityPanelConnector>
          </LiquiditySectionGroup>

          <LiquiditySectionGroup aria-label="Cuentas">
            <LiquidityAccountsToday
              fundingTotal={fundingTotal}
              onChanged={onReload}
              actions={<LiquidityFundingWalletsMenu onChanged={onReload} />}
              sectionIcon={CreditCard}
              refreshToken={refreshToken}
            />
          </LiquiditySectionGroup>

          <LiquiditySectionGroup aria-label="Gastos por categoría">
            <LiquiditySpendingCategories sectionIcon={PieChart} refreshToken={refreshToken} />
          </LiquiditySectionGroup>
        </>
      ) : null}
    </div>
  );
}
