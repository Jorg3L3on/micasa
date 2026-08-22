'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CreditCard, PieChart } from 'lucide-react';
import { useFinanceContext } from '@/context/finance-context';
import { todayCalendarDate } from '@/lib/calendar-dates';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import { fetchLiquidityProjection } from '@/lib/api/liquidity';
import type { MonthlySummaryItem } from '@/app/api/wallets/liquidity/monthly-summary/route';
import type { ReportSummaryResult } from '@/lib/finance/report-summary.service';
import type { LiquidityProjectionResponse } from '@/types/catalog';
import { LiquidityFutureTimeline } from '@/components/wallets/liquidity/LiquidityFutureTimeline';
import { LiquidityFinancialBrief } from '@/components/wallets/liquidity/LiquidityFinancialBrief';
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
} from '@/components/wallets/liquidity/liquidity-personalization';
import {
  isLiquidityChartRangeId,
  resolveLiquidityChartRange,
} from '@/lib/finance/liquidity-chart-range';
import {
  buildLiquidityYtdContext,
  type LiquidityYtdContext,
} from '@/lib/finance/liquidity-ytd-context';

const CHART_RANGE_STORAGE_KEY = 'micasa.liquidity.chartRange';

const readStoredChartRange = (): LiquidityChartRangeId => {
  if (typeof window === 'undefined') return 'plus_minus_3';
  const raw = window.localStorage.getItem(CHART_RANGE_STORAGE_KEY);
  return isLiquidityChartRangeId(raw) ? raw : 'plus_minus_3';
};

function LoadingSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-48 rounded-2xl border border-border/30 bg-muted/30 dark:border-white/[0.06] dark:bg-[#0d1327]/40" />
      <div className="space-y-4">
        <div className="h-5 w-48 rounded-lg bg-muted/40" />
        <div className="h-80 rounded-2xl border border-border/30 bg-muted/30 dark:border-white/[0.06] dark:bg-[#0d1327]/40" />
        <div className="h-56 rounded-2xl border border-border/30 bg-muted/30 dark:border-white/[0.06] dark:bg-[#0d1327]/40" />
      </div>
    </div>
  );
}

export function LiquidityProjectionTab() {
  const { context } = useFinanceContext();
  const [chartRange, setChartRange] = useState<LiquidityChartRangeId>(() =>
    readStoredChartRange(),
  );
  const [data, setData] = useState<LiquidityProjectionResponse | null>(null);
  const [ytdContext, setYtdContext] = useState<LiquidityYtdContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonthKey, setSelectedMonthKey] = useState('');

  const load = useCallback(async () => {
    if (!context || (context.type === 'user' && context.id === 0)) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const currentYear = Number(todayCalendarDate().slice(0, 4));
      const [res, monthlyRows, reportSummary] = await Promise.all([
        fetchLiquidityProjection(
          {
            chartRange: 'year_and_half',
            omitZero: true,
            includeUnpaid: true,
            includeTemplates: true,
          },
          context,
        ),
        clientFetchFromApi<MonthlySummaryItem[]>(
          '/api/wallets/liquidity/monthly-summary',
          undefined,
          context,
        ),
        clientFetchFromApi<ReportSummaryResult>(
          `/api/reports?type=summary&year=${currentYear}`,
          undefined,
          context,
        ),
      ]);
      setData(res);
      setYtdContext(
        buildLiquidityYtdContext({
          asOfYmd: res.as_of,
          monthlySummary: Array.isArray(monthlyRows) ? monthlyRows : [],
          totalSpentYtd: reportSummary.totalExpense,
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar tu panorama');
      setData(null);
      setYtdContext(null);
    } finally {
      setLoading(false);
    }
  }, [context]);

  const handleChartRangeChange = (next: LiquidityChartRangeId) => {
    setChartRange(next);
    window.localStorage.setItem(CHART_RANGE_STORAGE_KEY, next);
  };

  useEffect(() => {
    void load();
  }, [load]);

  const chartMonthKeys = useMemo(() => {
    if (!data) return new Set<string>();
    const bounds = resolveLiquidityChartRange(chartRange, data.as_of);
    return new Set(bounds.monthKeys);
  }, [chartRange, data]);

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

  useEffect(() => {
    if (!data || monthKeys.length === 0) return;
    setSelectedMonthKey((current) => {
      if (current && monthKeys.includes(current)) return current;
      return resolveInitialMonthKey(monthKeys, data.as_of);
    });
  }, [data, monthKeys]);

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
    setSelectedMonthKey(shiftSelectedMonthKey(monthKeys, resolvedMonthKey, delta));
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
          <LiquidityFinancialBrief
            data={data}
            ytdContext={ytdContext}
            isRefreshing={isChartRefreshing}
          />

          <LiquiditySectionGroup aria-label="Proyección mensual">
            <LiquidityPanelConnector>
              <LiquidityFutureTimeline
                months={chartMonths}
                events={projectionEvents}
                chartRange={chartRange}
                onChartRangeChange={handleChartRangeChange}
                selectedMonthKey={resolvedMonthKey}
                onSelectMonth={setSelectedMonthKey}
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
              onChanged={() => void load()}
              actions={<LiquidityFundingWalletsMenu onChanged={() => void load()} />}
              sectionIcon={CreditCard}
            />
          </LiquiditySectionGroup>

          <LiquiditySectionGroup aria-label="Gastos por categoría">
            <LiquiditySpendingCategories sectionIcon={PieChart} />
          </LiquiditySectionGroup>
        </>
      ) : null}
    </div>
  );
}
