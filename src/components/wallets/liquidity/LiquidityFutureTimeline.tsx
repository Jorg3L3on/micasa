'use client';

import { useEffect, useMemo } from 'react';
import { Check, LineChart } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LIQUIDITY_PANEL_CLASS,
  LiquidityPanelHeader,
} from '@/components/wallets/liquidity/liquidity-section';
import {
  Area,
  AreaChart,
  Brush,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatAxisMoney } from '@/lib/money';
import { cn, formatCurrency } from '@/lib/utils';
import type {
  LiquidityMonthlySeriesItem,
  LiquidityProjectionEvent,
} from '@/types/catalog';
import {
  formatMonthYearLabel,
  formatShortMonthLabel,
  type LiquidityCustomChartRange,
} from '@/components/wallets/liquidity/liquidity-personalization';
import { monthDebtPaymentsTotal } from '@/lib/finance/liquidity-month-debt-items';

type LiquidityFutureTimelineProps = {
  /** Every projected month; the range slider can reach all of them. */
  months: LiquidityMonthlySeriesItem[];
  events: LiquidityProjectionEvent[];
  /** Months currently drawn in the chart. */
  visibleRange: LiquidityCustomChartRange | null;
  onVisibleRangeChange: (range: LiquidityCustomChartRange) => void;
  selectedMonthKey: string;
  onSelectMonth: (monthKey: string) => void;
  isRefreshing?: boolean;
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
      <p className="mt-2 font-sans text-sm font-bold tabular-nums text-foreground">
        {formatCurrency(point.monthDebt)}
      </p>
      <p className="text-caption text-muted-foreground">pagos del mes</p>
      <p className="mt-2 font-sans text-sm font-bold tabular-nums text-amber-300">
        {formatCurrency(point.outstandingDebt)}
      </p>
      <p className="text-caption text-muted-foreground">adeudo total al cierre</p>
      {point.eventCount > 0 ? (
        <p className="mt-2 max-w-[220px] text-caption font-medium text-emerald-300">
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

type BrushHandleProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

const BrushHandle = ({ x = 0, y = 0, width = 0, height = 0 }: BrushHandleProps) => {
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={4} fill="#3a37fc" />
      <line
        x1={centerX - 1.5}
        x2={centerX - 1.5}
        y1={centerY - 5}
        y2={centerY + 5}
        stroke="rgba(255,255,255,0.8)"
        strokeWidth={1}
      />
      <line
        x1={centerX + 1.5}
        x2={centerX + 1.5}
        y1={centerY - 5}
        y2={centerY + 5}
        stroke="rgba(255,255,255,0.8)"
        strokeWidth={1}
      />
    </g>
  );
};

const resolveVisibleIndexes = (
  rows: readonly ChartPoint[],
  range: LiquidityCustomChartRange | null,
): { startIndex: number; endIndex: number } => {
  const lastIndex = Math.max(0, rows.length - 1);
  if (!range) return { startIndex: 0, endIndex: lastIndex };
  const startIndex = rows.findIndex((row) => row.monthKey >= range.fromMonthKey);
  const endIndex = rows.findLastIndex((row) => row.monthKey <= range.toMonthKey);
  if (startIndex < 0 || endIndex < startIndex) return { startIndex: 0, endIndex: lastIndex };
  return { startIndex, endIndex };
};

export const LiquidityFutureTimeline = ({
  months,
  events,
  visibleRange,
  onVisibleRangeChange,
  selectedMonthKey,
  onSelectMonth,
  isRefreshing = false,
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

  const { startIndex, endIndex } = resolveVisibleIndexes(chartRows, visibleRange);
  const visibleRows = useMemo(
    () => chartRows.slice(startIndex, endIndex + 1),
    [chartRows, endIndex, startIndex],
  );

  const firstEventMonth = visibleRows.find((row) => row.eventCount > 0)?.monthKey;

  useEffect(() => {
    if (visibleRows.length === 0) return;
    if (!visibleRows.some((row) => row.monthKey === selectedMonthKey)) {
      onSelectMonth(firstEventMonth ?? visibleRows[0]?.monthKey ?? '');
    }
  }, [firstEventMonth, onSelectMonth, selectedMonthKey, visibleRows]);

  if (months.length === 0) {
    return (
      <section className={LIQUIDITY_PANEL_CLASS} aria-labelledby="liquidity-chart-heading">
        <LiquidityPanelHeader
          id="liquidity-chart-heading"
          title="Deudas por mes"
          subtitle="Aún no hay meses por proyectar."
          icon={LineChart}
        />
      </section>
    );
  }

  const handleBrushChange = (next: { startIndex?: number; endIndex?: number }) => {
    const nextStart = next.startIndex ?? startIndex;
    const nextEnd = next.endIndex ?? endIndex;
    if (nextStart === startIndex && nextEnd === endIndex) return;
    const fromMonthKey = chartRows[nextStart]?.monthKey;
    const toMonthKey = chartRows[nextEnd]?.monthKey;
    if (!fromMonthKey || !toMonthKey) return;
    onVisibleRangeChange({ fromMonthKey, toMonthKey });
  };

  return (
    <section
      className={cn(LIQUIDITY_PANEL_CLASS, 'space-y-3', isRefreshing && 'pointer-events-none')}
      aria-labelledby="liquidity-chart-heading"
      aria-busy={isRefreshing}
    >
      {isRefreshing ? (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl bg-background/55 backdrop-blur-[1px]"
          role="status"
          aria-live="polite"
        >
          <Skeleton className="h-8 w-40 rounded-full" />
          <p className="text-xs font-medium text-muted-foreground">Actualizando rango…</p>
        </div>
      ) : null}

      <LiquidityPanelHeader
        id="liquidity-chart-heading"
        title="Deudas por mes"
        subtitle="Toca un mes en la gráfica para ver su detalle."
        icon={LineChart}
      />

      <div className={cn('space-y-3', isRefreshing && 'opacity-40 transition-opacity')}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-4 rounded-full bg-linear-to-r from-[#3a37fc] to-[#ee477a]" aria-hidden />
            <span className="text-caption text-muted-foreground">Pagos del mes (izq.)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-4 rounded-full bg-amber-400" aria-hidden />
            <span className="text-caption text-muted-foreground">Adeudo al cierre (der.)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-400" aria-hidden>
              <Check className="h-2 w-2 text-[#060914]" />
            </span>
            <span className="text-caption text-muted-foreground">Aquí terminas de pagar</span>
          </span>
        </div>

        <div className="-mx-1 h-72 sm:h-80 xl:h-[22rem] [&_.recharts-brush>rect:first-child]:stroke-white/10 [&_.recharts-brush>rect:first-child]:[rx:8px]">
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
                  x={visibleRows.find((row) => row.monthKey === selectedMonthKey)?.label}
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
                  const row = visibleRows[labelProps.index ?? -1];
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
              <Brush
                dataKey="label"
                startIndex={startIndex}
                endIndex={endIndex}
                onChange={handleBrushChange}
                height={32}
                travellerWidth={12}
                stroke="#8b89ff"
                fill="rgba(255,255,255,0.02)"
                traveller={<BrushHandle />}
                ariaLabel="Arrastra los extremos para elegir qué meses ver"
              >
                <AreaChart data={chartRows}>
                  <Area
                    type="monotone"
                    dataKey="outstandingDebt"
                    stroke="#fbbf24"
                    strokeOpacity={0.5}
                    fill="#fbbf24"
                    fillOpacity={0.08}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </Brush>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
};
