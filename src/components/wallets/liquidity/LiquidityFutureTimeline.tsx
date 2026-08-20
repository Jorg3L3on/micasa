'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check } from 'lucide-react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
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
import { LiquidityHorizonMenu } from '@/components/wallets/liquidity/LiquidityHorizonMenu';
import {
  formatMonthYearLabel,
  formatShortMonthLabel,
  type LiquidityHorizonMonths,
} from '@/components/wallets/liquidity/liquidity-personalization';

type LiquidityFutureTimelineProps = {
  months: LiquidityMonthlySeriesItem[];
  events: LiquidityProjectionEvent[];
  horizonMonths: LiquidityHorizonMonths;
  onHorizonChange: (value: LiquidityHorizonMonths) => void;
  tightestMonthKey?: string | null;
};

type ChartPoint = {
  label: string;
  monthKey: string;
  remainingDebt: number;
  paymentsDue: number;
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
      <p className="text-xs font-semibold capitalize text-foreground">
        {formatMonthYearLabel(point.monthKey)}
      </p>
      <p className="mt-1 font-mono text-sm font-bold tabular-nums text-foreground">
        {formatCurrency(point.remainingDebt)}
      </p>
      <p className="text-[11px] text-muted-foreground">aún por pagar desde este mes</p>
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
    <g className="cursor-pointer" onClick={() => onSelect(payload.monthKey)}>
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
  const shortTitle = payload.eventTitle.replace(/^Terminas de pagar\s+/i, '');
  const text = payload.eventCount > 1 ? `${payload.eventCount} pagos terminan` : shortTitle;
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
  horizonMonths,
  onHorizonChange,
  tightestMonthKey,
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
        return {
          label: formatShortMonthLabel(month.month_key),
          monthKey: month.month_key,
          remainingDebt: month.remaining_payments_from_month,
          paymentsDue: month.total_payments_due,
          income: month.expected_income_total,
          monthlyRemaining: month.monthly_remaining,
          eventCount: monthEvents.length,
          eventTitle: monthEvents[0]?.title ?? '',
        };
      }),
    [eventsByMonth, months],
  );

  const firstEventMonth = chartRows.find((row) => row.eventCount > 0)?.monthKey;
  const [selectedMonthKey, setSelectedMonthKey] = useState(
    firstEventMonth ?? chartRows[0]?.monthKey ?? '',
  );

  useEffect(() => {
    if (!chartRows.some((row) => row.monthKey === selectedMonthKey)) {
      setSelectedMonthKey(
        chartRows.find((row) => row.eventCount > 0)?.monthKey ?? chartRows[0]?.monthKey ?? '',
      );
    }
  }, [chartRows, selectedMonthKey]);

  const selectedPoint = chartRows.find((row) => row.monthKey === selectedMonthKey) ?? null;
  const selectedEvents = eventsByMonth.get(selectedMonthKey) ?? [];
  const isTight = selectedPoint?.monthKey === tightestMonthKey && (selectedPoint?.monthlyRemaining ?? 0) < 0;

  const handleSelectMonth = (monthKey: string) => {
    setSelectedMonthKey(monthKey);
  };

  if (months.length === 0) {
    return <p className="text-sm text-muted-foreground">Aún no hay meses por proyectar.</p>;
  }

  return (
    <section className="space-y-3" aria-label="Cómo bajan tus pagos">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold leading-tight">
            Cómo bajan tus pagos
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            La línea es lo que aún debes de aquí en adelante. Los puntos verdes son el mes en que terminas un préstamo o una compra a meses.
          </p>
        </div>
        <LiquidityHorizonMenu value={horizonMonths} onChange={onHorizonChange} />
      </div>

      <div className={cn(MONTHLY_PANEL_SHELL_CLASS, 'px-3 pb-4 pt-4 sm:px-5')}>
        <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-5 rounded-full bg-gradient-to-r from-[#3a37fc] to-[#ee477a]" />
            Lo que aún debes
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
              margin={{ top: 28, right: 12, left: 0, bottom: 4 }}
              onClick={(state) => {
                const monthKey = (state?.activePayload?.[0]?.payload as ChartPoint | undefined)
                  ?.monthKey;
                if (monthKey) handleSelectMonth(monthKey);
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
                tickFormatter={formatAxisMoney}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                width={42}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.12)' }} />
              <Area
                type="monotone"
                dataKey="remainingDebt"
                fill="url(#liqRemainingFill)"
                stroke="none"
                isAnimationActive
              />
              <Line
                type="monotone"
                dataKey="remainingDebt"
                stroke="url(#liqRemainingStroke)"
                strokeWidth={2.75}
                dot={(dotProps) => (
                  <PayoffDot
                    cx={dotProps.cx}
                    cy={dotProps.cy}
                    payload={dotProps.payload as ChartPoint}
                    selectedMonthKey={selectedMonthKey}
                    onSelect={handleSelectMonth}
                  />
                )}
                activeDot={false}
                label={(labelProps) => {
                  const row = chartRows[labelProps.index ?? -1];
                  if (!row?.eventCount) return <g />;
                  return <PayoffLabel x={labelProps.x} y={labelProps.y} payload={row} />;
                }}
                isAnimationActive
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {selectedPoint ? (
          <motion.div
            key={selectedPoint.monthKey}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className={cn(
              MONTHLY_PANEL_SHELL_CLASS,
              'px-4 py-4',
              isTight && 'border-l-[3px] border-l-destructive/50',
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Mes seleccionado
                </p>
                <h3 className="text-base font-semibold capitalize">
                  {formatMonthYearLabel(selectedPoint.monthKey)}
                </h3>
              </div>
              <p className="font-mono text-lg font-bold tabular-nums">
                {formatCurrency(selectedPoint.remainingDebt)}
                <span className="ml-1 text-xs font-medium text-muted-foreground">aún por pagar</span>
              </p>
            </div>

            {selectedEvents.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {selectedEvents.map((event) => (
                  <li
                    key={`${event.event_type}-${event.loan_id ?? event.expense_id}`}
                    className="flex items-start gap-2 text-sm"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400">
                      <Check className="h-3 w-3 text-[#060914]" aria-hidden />
                    </span>
                    <span>
                      <span className="font-semibold text-foreground">{event.title}</span>
                      <span className="block text-xs text-muted-foreground">{event.subtitle}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Ese mes no terminas ningún préstamo ni compra a meses. La línea sigue bajando con tus pagos normales.
              </p>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
};
