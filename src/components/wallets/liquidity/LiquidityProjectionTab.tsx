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
  defaultCustomChartRange,
  isLiquidityChartRangeId,
  parseStoredCustomChartRange,
  resolveLiquidityChartRange,
} from '@/lib/finance/liquidity-chart-range';

const CHART_RANGE_STORAGE_KEY = 'micasa.liquidity.chartRange';
const CUSTOM_RANGE_STORAGE_KEY = 'micasa.liquidity.chartRangeCustom';

const readStoredCustomRange = (): LiquidityCustomChartRange | null => {
  if (typeof window === 'undefined') return null;
  return parseStoredCustomChartRange(window.localStorage.getItem(CUSTOM_RANGE_STORAGE_KEY));
};

const readStoredChartRange = (): LiquidityChartRangeId => {
  if (typeof window === 'undefined') return 'plus_minus_3';
  const raw = window.localStorage.getItem(CHART_RANGE_STORAGE_KEY);
  if (!isLiquidityChartRangeId(raw)) return 'plus_minus_3';
  if (raw === 'custom' && !readStoredCustomRange()) return 'plus_minus_3';
  return raw;
};

const persistCustomRange = (range: LiquidityCustomChartRange) => {
  window.localStorage.setItem(CHART_RANGE_STORAGE_KEY, 'custom');
  window.localStorage.setItem(
    CUSTOM_RANGE_STORAGE_KEY,
    JSON.stringify({ from: range.fromMonthKey, to: range.toMonthKey }),
  );
};

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
};

export function LiquidityProjectionTab({
  data,
  loading,
  error,
  onReload,
  selectedMonthKey,
  onSelectedMonthKeyChange,
}: LiquidityProjectionTabProps) {
  const [chartRange, setChartRange] = useState<LiquidityChartRangeId>(() =>
    readStoredChartRange(),
  );
  const [customRange, setCustomRange] = useState<LiquidityCustomChartRange | null>(() =>
    readStoredCustomRange(),
  );

  const handleChartRangeChange = (next: LiquidityChartRangeId) => {
    setChartRange(next);
    window.localStorage.setItem(CHART_RANGE_STORAGE_KEY, next);
  };

  const handleCustomRangeChange = (range: LiquidityCustomChartRange) => {
    const available = data?.monthly_series.map((month) => month.month_key) ?? [];
    const next = clampCustomChartRangeToAvailable(range, available);
    setCustomRange(next);
    setChartRange('custom');
    persistCustomRange(next);
  };

  const availableMonthKeys = useMemo(
    () => data?.monthly_series.map((month) => month.month_key) ?? [],
    [data],
  );

  const chartMonthKeys = useMemo(() => {
    if (!data) return new Set<string>();
    const custom =
      chartRange === 'custom'
        ? clampCustomChartRangeToAvailable(
            customRange ?? defaultCustomChartRange(data.as_of, availableMonthKeys),
            availableMonthKeys,
          )
        : null;
    const bounds = resolveLiquidityChartRange(chartRange, data.as_of, custom);
    return new Set(bounds.monthKeys);
  }, [availableMonthKeys, chartRange, customRange, data]);

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
          {(data.summary.unresolved_card_obligation_count ?? 0) > 0 ? (
            <div
              className="rounded-xl border border-border/60 border-l-[3px] border-l-amber-500/60 bg-card px-4 py-3"
              role="status"
            >
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                Falta el pago del corte
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {data.summary.unresolved_card_obligation_count === 1
                  ? '1 tarjeta con deuda y fecha de pago no entra en los totales. Ese hueco no es $0.'
                  : `${data.summary.unresolved_card_obligation_count} tarjetas con deuda y fecha de pago no entran en los totales. Ese hueco no es $0.`}
              </p>
              {(data.summary.unresolved_card_obligations ?? []).length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs text-foreground">
                  {(data.summary.unresolved_card_obligations ?? []).map((card) => (
                    <li key={`${card.wallet_id}-${card.statement_due_date}`}>
                      {card.wallet_name}
                      <span className="text-muted-foreground">
                        {' '}
                        · vence {card.statement_due_date}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <LiquiditySectionGroup aria-label="Proyección mensual">
            <LiquidityPanelConnector>
              <LiquidityFutureTimeline
                months={chartMonths}
                events={projectionEvents}
                chartRange={chartRange}
                onChartRangeChange={handleChartRangeChange}
                customRange={customRange}
                onCustomRangeChange={handleCustomRangeChange}
                availableMonthKeys={availableMonthKeys}
                asOfYmd={data.as_of}
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
