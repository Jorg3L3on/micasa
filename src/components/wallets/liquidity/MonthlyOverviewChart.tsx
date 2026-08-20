'use client';

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
import type { MonthlySummaryItem } from '@/app/api/wallets/liquidity/monthly-summary/route';
import {
  formatMonthYearLabel,
  formatShortMonthLabel,
  monthKeyFromParts,
} from '@/components/wallets/liquidity/liquidity-personalization';

type MonthlyOverviewChartProps = {
  months: MonthlySummaryItem[];
  selectedMonthKey: string;
  onSelectMonth: (monthKey: string) => void;
};

type ChartPoint = {
  label: string;
  monthKey: string;
  income: number;
  expense: number;
  net: number;
  isTight: boolean;
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
      <p className="mt-1 text-[11px] text-emerald-300">
        Entró {formatCurrency(point.income)}
      </p>
      <p className="text-[11px] text-violet-300">Salió {formatCurrency(point.expense)}</p>
      {point.isTight ? (
        <p className="mt-2 text-[11px] font-medium text-rose-300">Ese mes no te alcanzó</p>
      ) : (
        <p className="mt-2 text-[11px] font-medium text-emerald-300">Te sobró</p>
      )}
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

const HistoryDot = ({ cx, cy, payload, selectedMonthKey, onSelect }: DotProps) => {
  if (cx == null || cy == null || !payload) return null;
  const isSelected = payload.monthKey === selectedMonthKey;

  if (!payload.isTight) {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={isSelected ? 4.5 : 3}
        fill={isSelected ? '#3a37fc' : '#34d399'}
        stroke="#0d1327"
        strokeWidth={2}
        className="cursor-pointer"
        onClick={() => onSelect(payload.monthKey)}
      />
    );
  }

  return (
    <g className="cursor-pointer" onClick={() => onSelect(payload.monthKey)}>
      <circle cx={cx} cy={cy} r={14} fill="#fb7185" fillOpacity={0.18} />
      <circle
        cx={cx}
        cy={cy}
        r={isSelected ? 8 : 7}
        fill="#fb7185"
        stroke="#0d1327"
        strokeWidth={2.5}
      />
    </g>
  );
};

export default function MonthlyOverviewChart({
  months,
  selectedMonthKey,
  onSelectMonth,
}: MonthlyOverviewChartProps) {
  const chartRows: ChartPoint[] = months.map((month) => {
    const monthKey = monthKeyFromParts(month.year, month.month);
    return {
      label: formatShortMonthLabel(monthKey),
      monthKey,
      income: month.income,
      expense: month.expense,
      net: month.income - month.expense,
      isTight: month.expense > month.income,
    };
  });

  if (chartRows.length === 0) {
    return <p className="text-sm text-muted-foreground">Aún no hay meses registrados.</p>;
  }

  const selectedLabel = chartRows.find((row) => row.monthKey === selectedMonthKey)?.label;

  return (
    <section className="space-y-3" aria-label="Cómo se movió tu dinero">
      <div>
        <h2 className="text-base font-semibold leading-tight">Cómo se movió tu dinero</h2>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          La línea verde es lo que entró; la violeta, lo que salió. Los puntos rosa son meses en que salió más de lo que entró.
        </p>
      </div>

      <div className={cn(MONTHLY_PANEL_SHELL_CLASS, 'px-3 pb-4 pt-4 sm:px-5')}>
        <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-5 rounded-full bg-emerald-400" />
            Entró
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-5 rounded-full bg-violet-400" />
            Salió
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-400" />
            Mes apretado
          </span>
        </div>

        <div className="h-72 w-full sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartRows}
              margin={{ top: 12, right: 12, left: 0, bottom: 4 }}
              onClick={(state) => {
                const monthKey = (state?.activePayload?.[0]?.payload as ChartPoint | undefined)
                  ?.monthKey;
                if (monthKey) onSelectMonth(monthKey);
              }}
            >
              <defs>
                <linearGradient id="liqPastIncomeFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="liqPastExpenseFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#911efe" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#911efe" stopOpacity={0} />
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
              {selectedLabel ? (
                <ReferenceLine
                  x={selectedLabel}
                  stroke="rgba(255,255,255,0.22)"
                  strokeDasharray="3 4"
                />
              ) : null}
              <Area
                type="monotone"
                dataKey="income"
                fill="url(#liqPastIncomeFill)"
                stroke="none"
                isAnimationActive
              />
              <Area
                type="monotone"
                dataKey="expense"
                fill="url(#liqPastExpenseFill)"
                stroke="none"
                isAnimationActive
              />
              <Line
                type="monotone"
                dataKey="income"
                stroke="#34d399"
                strokeWidth={2.25}
                dot={false}
                activeDot={false}
                isAnimationActive
              />
              <Line
                type="monotone"
                dataKey="expense"
                stroke="#911efe"
                strokeWidth={2.75}
                dot={(dotProps) => (
                  <HistoryDot
                    cx={dotProps.cx}
                    cy={dotProps.cy}
                    payload={dotProps.payload as ChartPoint}
                    selectedMonthKey={selectedMonthKey}
                    onSelect={onSelectMonth}
                  />
                )}
                activeDot={false}
                isAnimationActive
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
