'use client';

import { useEffect, useMemo } from 'react';
import { Check, LineChart } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import { LiquidityRangeToggle } from '@/components/wallets/liquidity/LiquidityChartControls';
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
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartTooltip } from '@/components/charts/chart-tooltip';
import { CHART_AXIS_TICK, CHART_COLOR } from '@/components/charts/chart-theme';
import { formatAxisMoney } from '@/lib/money';
import { cn, formatCurrency } from '@/lib/utils';
import type {
  LiquidityMonthlySeriesItem,
  LiquidityProjectionEvent,
} from '@/types/catalog';
import {
  formatMonthYearLabel,
  formatShortMonthLabel,
  type LiquidityChartRangeId,
  type LiquidityCustomChartRange,
} from '@/components/wallets/liquidity/liquidity-personalization';
import { monthDebtPaymentsTotal } from '@/lib/finance/liquidity-month-debt-items';
import type { LiquidityChartPresetId } from '@/lib/finance/liquidity-chart-range';

type LiquidityFutureTimelineProps = {
  /** Every projected month; the range slider can reach all of them. */
  months: LiquidityMonthlySeriesItem[];
  events: LiquidityProjectionEvent[];
  /** Months currently drawn in the chart. */
  visibleRange: LiquidityCustomChartRange | null;
  onVisibleRangeChange: (range: LiquidityCustomChartRange) => void;
  chartRange: LiquidityChartRangeId;
  customRange: LiquidityCustomChartRange | null;
  lastPreset: LiquidityChartPresetId;
  onChartRangeChange: (range: LiquidityChartRangeId) => void;
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


const DebtMonthTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
}) => {
  if (!active || !payload?.[0]) return null;
  const point = payload[0].payload;
  return (
    <ChartTooltip active>
      <p className="text-xs font-semibold text-foreground">
        {formatMonthYearLabel(point.monthKey)}
      </p>
      <p className="mt-2 font-sans text-sm font-bold tabular-nums text-foreground">
        {formatCurrency(point.monthDebt)}
      </p>
      <p className="text-caption text-muted-foreground">pagos del mes</p>
      <p className="mt-2 font-sans text-sm font-bold tabular-nums text-status-pending">
        {formatCurrency(point.outstandingDebt)}
      </p>
      <p className="text-caption text-muted-foreground">adeudo total al cierre</p>
      {point.eventCount > 0 ? (
        <p className="mt-2 max-w-[220px] text-caption font-medium text-status-success">
          {point.eventTitle}
        </p>
      ) : null}
    </ChartTooltip>
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
        fill={isSelected ? CHART_COLOR.primary : CHART_COLOR.slices[3]}
        stroke={CHART_COLOR.background}
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
      <circle cx={cx} cy={cy} r={14} fill={CHART_COLOR.success} fillOpacity={0.18} />
      <circle
        cx={cx}
        cy={cy}
        r={isSelected ? 8 : 7}
        fill={CHART_COLOR.success}
        stroke={CHART_COLOR.background}
        strokeWidth={2.5}
      />
      <path
        d={`M${cx - 3.2} ${cy} l2.2 2.3 4.6-4.8`}
        fill="none"
        stroke={CHART_COLOR.background}
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
      className="fill-status-success"
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
  // Slim pill with a two-line grip; the hit area stays the full traveller width.
  const pillWidth = 6;
  const pillX = x + (width - pillWidth) / 2;
  const inset = 5;
  const pillY = y + inset;
  const pillHeight = Math.max(0, height - inset * 2);
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  return (
    <g className="cursor-ew-resize">
      <rect x={x} y={y} width={width} height={height} fill="transparent" />
      <rect
        x={pillX}
        y={pillY}
        width={pillWidth}
        height={pillHeight}
        rx={pillWidth / 2}
        fill={CHART_COLOR.primary}
        stroke={CHART_COLOR.background}
        strokeWidth={1.5}
        className="drop-shadow-[0_0_6px_color-mix(in_srgb,var(--primary)_55%,transparent)]"
      />
      {[-1.25, 1.25].map((offset) => (
        <line
          key={offset}
          x1={centerX + offset}
          x2={centerX + offset}
          y1={centerY - 3}
          y2={centerY + 3}
          stroke="var(--primary-foreground)"
          strokeOpacity={0.9}
          strokeWidth={0.9}
          strokeLinecap="round"
        />
      ))}
    </g>
  );
};

/** Orion styling for the recharts brush: muted rounded track, tinted window, quiet drag labels. */
const BRUSH_STYLE_CLASS = cn(
  '[&_.recharts-brush>rect:first-child]:[stroke:none]',
  '[&_.recharts-brush>rect:first-child]:[fill:color-mix(in_srgb,var(--foreground)_5%,transparent)]',
  '[&_.recharts-brush>rect:first-child]:[rx:10px]',
  '[&_.recharts-brush-slide]:[fill:color-mix(in_srgb,var(--primary)_16%,transparent)]',
  '[&_.recharts-brush-slide]:[fill-opacity:1]',
  '[&_.recharts-brush-slide]:[stroke:color-mix(in_srgb,var(--primary)_45%,transparent)]',
  '[&_.recharts-brush-slide]:[rx:8px]',
  '[&_.recharts-brush-slide]:cursor-grab',
  '[&_.recharts-brush-texts_text]:[fill:var(--muted-foreground)]',
  '[&_.recharts-brush-texts_text]:text-[10px]',
  '[&_.recharts-brush-texts_text]:font-medium',
);

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
  chartRange,
  customRange,
  lastPreset,
  onChartRangeChange,
  selectedMonthKey,
  onSelectMonth,
  isRefreshing = false,
}: LiquidityFutureTimelineProps) => {
  // The brush is a desktop power feature; on phones the pills are the only range
  // control, so the chart gets the visible slice directly instead of brushing it.
  const isMobile = useIsMobile();
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

  const selectedLabel = visibleRows.find((row) => row.monthKey === selectedMonthKey)?.label;

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
      aria-label="Deudas por mes"
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

      <div className={cn('space-y-3', isRefreshing && 'opacity-40 transition-opacity')}>
        <LiquidityRangeToggle
          chartRange={chartRange}
          customRange={customRange}
          lastPreset={lastPreset}
          onChartRangeChange={onChartRangeChange}
        />

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-4 rounded-full bg-linear-to-r from-chart-1 to-chart-2" aria-hidden />
            <span className="text-caption text-muted-foreground">Pagos del mes (izq.)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-4 rounded-full bg-status-pending" aria-hidden />
            <span className="text-caption text-muted-foreground">Adeudo al cierre (der.)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-status-success" aria-hidden>
              <Check className="h-2 w-2 text-background" />
            </span>
            <span className="text-caption text-muted-foreground">Aquí terminas de pagar</span>
          </span>
        </div>

        <div className={cn('-mx-1 h-72 sm:h-80 xl:h-[22rem]', BRUSH_STYLE_CLASS)}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={isMobile ? visibleRows : chartRows}
              margin={{ top: 28, right: 16, left: 0, bottom: isMobile ? 4 : 10 }}
              onClick={(state) => {
                const monthKey = (state?.activePayload?.[0]?.payload as ChartPoint | undefined)
                  ?.monthKey;
                if (monthKey) onSelectMonth(monthKey);
              }}
            >
              <defs>
                <linearGradient id="liqRemainingFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLOR.slices[3]} stopOpacity={0.38} />
                  <stop offset="100%" stopColor={CHART_COLOR.slices[0]} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="liqRemainingStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={CHART_COLOR.slices[0]} />
                  <stop offset="100%" stopColor={CHART_COLOR.slices[1]} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke={CHART_COLOR.grid}
              />
              <XAxis
                dataKey="label"
                scale="band"
                tick={CHART_AXIS_TICK}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="payments"
                tickFormatter={formatAxisMoney}
                tick={CHART_AXIS_TICK}
                tickLine={false}
                axisLine={false}
                width={42}
              />
              <YAxis
                yAxisId="outstanding"
                orientation="right"
                tickFormatter={formatAxisMoney}
                tick={CHART_AXIS_TICK}
                tickLine={false}
                axisLine={false}
                width={42}
              />
              <Tooltip
                content={<DebtMonthTooltip />}
                cursor={{ stroke: 'color-mix(in srgb, var(--foreground) 18%, transparent)' }}
              />
              {selectedLabel ? (
                <>
                  <ReferenceArea
                    yAxisId="payments"
                    x1={selectedLabel}
                    x2={selectedLabel}
                    fill={CHART_COLOR.primary}
                    fillOpacity={0.14}
                    stroke="none"
                    radius={10}
                    ifOverflow="visible"
                  />
                  <ReferenceLine
                    yAxisId="payments"
                    x={selectedLabel}
                    stroke="color-mix(in srgb, var(--foreground) 28%, transparent)"
                    strokeDasharray="3 4"
                  />
                </>
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
                stroke={CHART_COLOR.pending}
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
                activeDot={{
                  r: 4,
                  fill: CHART_COLOR.pending,
                  stroke: CHART_COLOR.background,
                  strokeWidth: 2,
                }}
                isAnimationActive
              />
              {isMobile ? null : (
                <Brush
                  dataKey="label"
                  startIndex={startIndex}
                  endIndex={endIndex}
                  onChange={handleBrushChange}
                  height={28}
                  travellerWidth={16}
                  gap={1}
                  stroke={CHART_COLOR.primary}
                  fill="transparent"
                  traveller={<BrushHandle />}
                  ariaLabel="Arrastra los extremos para elegir qué meses ver"
                >
                  <AreaChart data={chartRows} margin={{ top: 6, right: 0, bottom: 4, left: 0 }}>
                    <Area
                      type="monotone"
                      dataKey="monthDebt"
                      stroke={CHART_COLOR.primary}
                      strokeOpacity={0.55}
                      strokeWidth={1.25}
                      fill={CHART_COLOR.primary}
                      fillOpacity={0.12}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </Brush>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
};
