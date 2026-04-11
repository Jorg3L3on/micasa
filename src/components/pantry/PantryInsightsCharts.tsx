'use client';

import { useId, useMemo, useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, LineChart } from 'lucide-react';
import type { PantryChartsDto } from '@/types/pantry-insights';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn, formatCurrency } from '@/lib/utils';

type Props = {
  charts: PantryChartsDto;
  hasReceipts: boolean;
};

const shortAxisMoney = (n: number): string => {
  if (!Number.isFinite(n)) return '';
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(Math.round(n));
};

type SpendTooltipProps = {
  active?: boolean;
  payload?: Array<{
    payload: {
      label: string;
      total_spend: number;
      receipt_count: number;
    };
  }>;
};

const SpendByMonthTooltip = ({ active, payload }: SpendTooltipProps) => {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-md border border-border/60 bg-popover px-2.5 py-2 text-xs shadow-md">
      <p className="font-medium text-foreground">{row.label}</p>
      <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
        {formatCurrency(row.total_spend)}
      </p>
      <p className="text-[10px] text-muted-foreground">
        {row.receipt_count}{' '}
        {row.receipt_count === 1 ? 'recibo' : 'recibos'}
      </p>
    </div>
  );
};

type BarTooltipProps = {
  active?: boolean;
  payload?: Array<{ value?: number; payload: { label: string; total_spend: number } }>;
};

const ProductSpendTooltip = ({ active, payload }: BarTooltipProps) => {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="max-w-[min(20rem,85vw)] rounded-md border border-border/60 bg-popover px-2.5 py-2 text-xs shadow-md">
      <p className="font-medium leading-snug text-foreground">{row.label}</p>
      <p className="mt-1 font-mono text-sm font-semibold tabular-nums">
        {formatCurrency(row.total_spend)}
      </p>
    </div>
  );
};

const noopSubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export const PantryInsightsCharts = ({ charts, hasReceipts }: Props) => {
  const spendGradientId = `pantrySpend-${useId().replace(/:/g, '')}`;
  const { resolvedTheme } = useTheme();
  const isClient = useSyncExternalStore(
    noopSubscribe,
    getClientSnapshot,
    getServerSnapshot,
  );

  const isDark = isClient && resolvedTheme === 'dark';
  const axisColor = isDark ? '#a1a1aa' : '#71717a';
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const emerald = isDark ? '#34d399' : '#059669';
  const violet = isDark ? '#a78bfa' : '#7c3aed';

  const barData = useMemo(
    () =>
      charts.products_by_spend.map((p) => ({
        ...p,
        shortLabel: p.label.length > 36 ? `${p.label.slice(0, 35)}…` : p.label,
      })),
    [charts.products_by_spend],
  );

  const barChartHeight = Math.max(
    200,
    Math.min(360, barData.length * 36 + 48),
  );

  if (!hasReceipts) {
    return null;
  }

  const monthSeries = charts.spend_by_month;
  const hasMonthData = monthSeries.some((p) => p.total_spend > 0 || p.receipt_count > 0);
  const hasBarData = barData.length > 0;

  return (
    <Card
      className={cn(
        'overflow-hidden border-border/60 transition-shadow duration-200 hover:shadow-md',
      )}
      role="region"
      aria-label="Tendencias de despensa"
    >
      <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15">
          <LineChart className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
        </span>
        <div className="min-w-0">
          <CardTitle className="text-sm font-semibold leading-none">
            Tendencias
          </CardTitle>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Gasto por mes y productos que más pesan en el total
          </p>
        </div>
      </CardHeader>
      <CardContent className="grid gap-8 pt-0 lg:grid-cols-2 lg:gap-6">
        <div className="min-w-0 space-y-2 border-border/50 lg:border-r lg:pr-6 lg:pb-0 pb-6 border-b lg:border-b-0">
          <div className="flex items-center gap-2">
            <LineChart className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Gasto por mes
            </p>
          </div>
          {!hasMonthData ? (
            <p className="text-sm text-muted-foreground">
              Sin datos suficientes para la serie temporal.
            </p>
          ) : (
            <div className="h-52 w-full min-w-0 sm:h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={monthSeries}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id={spendGradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={emerald} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={emerald} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: axisColor }}
                    tickLine={false}
                    axisLine={{ stroke: gridColor }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: axisColor }}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                    tickFormatter={shortAxisMoney}
                  />
                  <Tooltip content={<SpendByMonthTooltip />} cursor={{ stroke: gridColor }} />
                  <Area
                    type="monotone"
                    dataKey="total_spend"
                    stroke={emerald}
                    strokeWidth={2}
                    fill={`url(#${spendGradientId})`}
                    name="Gasto"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" aria-hidden />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Top gasto por producto
            </p>
          </div>
          {!hasBarData ? (
            <p className="text-sm text-muted-foreground">
              Aún no hay líneas con gasto para comparar.
            </p>
          ) : (
            <div className="w-full min-w-0" style={{ height: barChartHeight }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={barData}
                  margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: axisColor }}
                    tickLine={false}
                    axisLine={{ stroke: gridColor }}
                    tickFormatter={shortAxisMoney}
                  />
                  <YAxis
                    type="category"
                    dataKey="shortLabel"
                    width={108}
                    tick={{ fontSize: 10, fill: axisColor }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<ProductSpendTooltip />} cursor={{ fill: gridColor }} />
                  <Bar dataKey="total_spend" fill={violet} radius={[0, 6, 6, 0]} name="Gasto" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
