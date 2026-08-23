'use client';

import { useEffect, useMemo } from 'react';
import { Check, LineChart, Loader2 } from 'lucide-react';
import { LiquiditySectionHeader } from '@/components/wallets/liquidity/liquidity-section';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn, formatCurrency } from '@/lib/utils';
import { MONTHLY_PANEL_SHELL_CLASS } from '@/components/monthly/monthly-panel-shell';
import type {
  LiquidityMonthlySeriesItem,
  LiquidityProjectionEvent,
} from '@/types/catalog';
import { LiquidityChartRangeMenu } from '@/components/wallets/liquidity/LiquidityHorizonMenu';
import {
  formatMonthYearLabel,
  formatShortMonthLabel,
  type LiquidityChartRangeId,
} from '@/components/wallets/liquidity/liquidity-personalization';
import { monthDebtPaymentsTotal } from '@/lib/finance/liquidity-month-debt-items';

type LiquidityFutureTimelineProps = {
  months: LiquidityMonthlySeriesItem[];
  events: LiquidityProjectionEvent[];
  chartRange: LiquidityChartRangeId;
  onChartRangeChange: (value: LiquidityChartRangeId) => void;
  selectedMonthKey: string;
  onSelectMonth: (monthKey: string) => void;
  isRefreshing?: boolean;
  /** When true, renders inside LiquidityPanelConnector without outer shell border. */
  embedded?: boolean;
};

type ChartPoint = {
  label: string;
  monthKey: string;
  monthDebt: number;
  outstandingDebt: number;
  income: number;
  monthlyRemaining: number;
  eventCount: number;
  eventTitle: string;
};

const formatAxisMoney = (value: number): string => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return String(value);
};

const ChartTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
}) => {
  if (!active || !payload?.[0]) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#0d1327]/95 px-3 py-2.5 shadow-xl backdrop-blur-xl">
      <p className="text-xs font-semibold text-foreground">
        {formatMonthYearLabel(point.monthKey)}
      </p>
      <p className="mt-2 font-mono text-sm font-bold tabular-nums text-foreground">
        {formatCurrency(point.monthDebt)}
      </p>
      <p className="text-[11px] text-muted-foreground">deudas de este mes</p>
      <p className="mt-2 font-mono text-sm font-bold tabular-nums text-amber-300">
        {formatCurrency(point.outstandingDebt)}
      </p>
      <p className="text-[11px] text-muted-foreground">adeudo total al cierre</p>
      {point.eventCount > 0 ? (
        <p className="mt-2 max-w-[220px] text-[11px] font-medium text-emerald-300">
          {point.eventTitle}
        </p>
      ) : null}
    </div>
  );
};

type DotProps = {
  cx?: number;
  cy?: number;
  payload?: ChartPoint;
  selectedMonthKey: string;
  onSelect: (monthKey: string) => void;
};

const PayoffDot = ({ cx, cy, payload, selectedMonthKey, onSelect }: DotProps) => {
  if (cx == null || cy == null || !payload) return null;
  const isEvent = payload.eventCount > 0;
  const isSelected = payload.monthKey === selectedMonthKey;

  if (!isEvent) {
    return (
      <circle
        key={payload.monthKey}
        cx={cx}
        cy={cy}
        r={isSelected ? 4.5 : 3}
        fill={isSelected ? '#3a37fc' : '#911efe'}
        stroke="#0d1327"
        strokeWidth={2}
        className="cursor-pointer"
        onClick={() => onSelect(payload.monthKey)}
      />
    );
  }

  return (
    <g
      key={payload.monthKey}
      className="cursor-pointer"
      onClick={() => onSelect(payload.monthKey)}
    >
      <circle cx={cx} cy={cy} r={14} fill="#34d399" fillOpacity={0.18} />
      <circle
        cx={cx}
        cy={cy}
        r={isSelected ? 8 : 7}
        fill="#34d399"
        stroke="#0d1327"
        strokeWidth={2.5}
      />
      <path
        d={`M${cx - 3.2} ${cy} l2.2 2.3 4.6-4.8`}
        fill="none"
        stroke="#060914"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
};

type LabelProps = {
  x?: number;
  y?: number;
  payload?: ChartPoint;
};

const PayoffLabel = ({ x, y, payload }: LabelProps) => {
  if (x == null || y == null || !payload?.eventCount) return null;
  const text =
    payload.eventCount > 1
      ? `${payload.eventCount} pagos terminan`
      : payload.eventTitle.replace(/^Terminas de pagar\s+/i, '');
  const clipped = text.length > 22 ? `${text.slice(0, 20)}…` : text;
  return (
    <text
      x={x}
      y={y - 16}
      textAnchor="middle"
      className="fill-emerald-300"
      style={{ fontSize: 10, fontWeight: 600 }}
    >
      {clipped}
    </text>
  );
};

export const LiquidityFutureTimeline = ({
  months,
  events,
  chartRange,
  onChartRangeChange,
  selectedMonthKey,
  onSelectMonth,
  isRefreshing = false,
  embedded = false,
}: LiquidityFutureTimelineProps) => {
  const eventsByMonth = useMemo(() => {
    const map = new Map<string, LiquidityProjectionEvent[]>();
    for (const event of events) {
      const list = map.get(event.month_key) ?? [];
      list.push(event);
      map.set(event.month_key, list);
    }
    return map;
  }, [events]);

  const chartRows = useMemo<ChartPoint[]>(
    () =>
      months.map((month) => {
        const monthEvents = eventsByMonth.get(month.month_key) ?? [];
        const eventTitle =
          monthEvents.length === 0
            ? ''
            : monthEvents.length === 1
              ? (monthEvents[0]?.title ?? '')
              : monthEvents
                  .map((event) =>
                    event.title.replace(/^Terminas de pagar\s+/i, ''),
                  )
                  .join(', ');
        return {
          label: formatShortMonthLabel(month.month_key),
          monthKey: month.month_key,
          monthDebt: monthDebtPaymentsTotal(month.debt_items ?? []),
          outstandingDebt: month.outstanding_debt_total ?? 0,
          income: month.expected_income_total,
          monthlyRemaining: month.monthly_remaining,
          eventCount: monthEvents.length,
          eventTitle,
        };
      }),
    [eventsByMonth, months],
  );

  const firstEventMonth = chartRows.find((row) => row.eventCount > 0)?.monthKey;

  useEffect(() => {
    if (chartRows.length === 0) return;
    if (!chartRows.some((row) => row.monthKey === selectedMonthKey)) {
      onSelectMonth(firstEventMonth ?? chartRows[0]?.monthKey ?? '');
    }
  }, [chartRows, firstEventMonth, onSelectMonth, selectedMonthKey]);

  if (months.length === 0) {
    return <p className="text-sm text-muted-foreground">Aún no hay meses por proyectar.</p>;
  }

  const chartShellClass = embedded
    ? 'relative px-3 pb-4 pt-4 sm:px-5'
    : cn(MONTHLY_PANEL_SHELL_CLASS, 'relative px-3 pb-4 pt-4 sm:px-5');

  return (
    <section
      className={cn('space-y-3', embedded && 'space-y-0')}
      aria-label="Deudas por mes"
      aria-busy={isRefreshing}
    >
      <div className={cn(embedded ? 'px-4 pt-4 sm:px-5' : undefined)}>
        <LiquiditySectionHeader
          id={embedded ? undefined : 'liquidity-chart-heading'}
          title="Deudas por mes"
          description={
            embedded
              ? 'Toca un mes en la gráfica o usa las flechas abajo para ver el detalle.'
              : undefined
          }
          icon={LineChart}
          accent="violet"
          actions={
            <LiquidityChartRangeMenu
              value={chartRange}
              onChange={onChartRangeChange}
              isLoading={isRefreshing}
            />
          }
        />
      </div>

      <div
        className={cn(
          chartShellClass,
          isRefreshing && 'pointer-events-none',
        )}
      >
        {isRefreshing ? (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl bg-[#0d1327]/55 backdrop-blur-[1px]"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
            <p className="text-xs font-medium text-muted-foreground">
              Actualizando rango…
            </p>
          </div>
        ) : null}
        <div className={cn(isRefreshing && 'opacity-40 transition-opacity')}>
        <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-5 rounded-full bg-gradient-to-r from-[#3a37fc] to-[#ee477a]" />
            Deudas del mes (izq.)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-5 rounded-full bg-amber-400" />
            Adeudo al cierre (der.)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400">
              <Check className="h-2.5 w-2.5 text-[#060914]" aria-hidden />
            </span>
            Aquí terminas de pagar
          </span>
        </div>

        <div className="h-72 w-full sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartRows}
              margin={{ top: 28, right: 16, left: 0, bottom: 4 }}
              onClick={(state) => {
                const monthKey = (state?.activePayload?.[0]?.payload as ChartPoint | undefined)
                  ?.monthKey;
                if (monthKey) onSelectMonth(monthKey);
              }}
            >
              <defs>
                <linearGradient id="liqRemainingFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#911efe" stopOpacity={0.38} />
                  <stop offset="100%" stopColor="#3a37fc" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="liqRemainingStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#3a37fc" />
                  <stop offset="100%" stopColor="#ee477a" />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="rgba(255,255,255,0.06)"
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="payments"
                tickFormatter={formatAxisMoney}
                tick={{ fontSize: 11, fill: '#a78bfa' }}
                tickLine={false}
                axisLine={false}
                width={42}
              />
              <YAxis
                yAxisId="outstanding"
                orientation="right"
                tickFormatter={formatAxisMoney}
                tick={{ fontSize: 11, fill: '#fbbf24' }}
                tickLine={false}
                axisLine={false}
                width={42}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.12)' }} />
              {selectedMonthKey ? (
                <ReferenceLine
                  yAxisId="payments"
                  x={chartRows.find((row) => row.monthKey === selectedMonthKey)?.label}
                  stroke="rgba(255,255,255,0.22)"
                  strokeDasharray="3 4"
                />
              ) : null}
              <Area
                type="monotone"
                dataKey="monthDebt"
                yAxisId="payments"
                fill="url(#liqRemainingFill)"
                stroke="none"
                isAnimationActive
              />
              <Line
                type="monotone"
                dataKey="monthDebt"
                yAxisId="payments"
                stroke="url(#liqRemainingStroke)"
                strokeWidth={2.75}
                dot={(dotProps) => {
                  const payload = dotProps.payload as ChartPoint | undefined;
                  return (
                    <PayoffDot
                      key={payload?.monthKey ?? `dot-${dotProps.index}`}
                      cx={dotProps.cx}
                      cy={dotProps.cy}
                      payload={payload}
                      selectedMonthKey={selectedMonthKey}
                      onSelect={onSelectMonth}
                    />
                  );
                }}
                activeDot={false}
                label={(labelProps) => {
                  const row = chartRows[labelProps.index ?? -1];
                  if (!row?.eventCount) {
                    return <g key={`payoff-label-empty-${labelProps.index}`} />;
                  }
                  return (
                    <PayoffLabel
                      key={row.monthKey}
                      x={labelProps.x}
                      y={labelProps.y}
                      payload={row}
                    />
                  );
                }}
                isAnimationActive
              />
              <Line
                type="monotone"
                dataKey="outstandingDebt"
                yAxisId="outstanding"
                stroke="#fbbf24"
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
                activeDot={{ r: 4, fill: '#fbbf24', stroke: '#0d1327', strokeWidth: 2 }}
                isAnimationActive
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        </div>
      </div>
    </section>
  );
};
