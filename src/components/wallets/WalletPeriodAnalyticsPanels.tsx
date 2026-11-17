'use client';

import { motion, useReducedMotion } from 'framer-motion';
import EmptyState from '@/components/EmptyState';
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  PieChart as PieChartIcon,
  Star,
  TrendingUp,
} from 'lucide-react';
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CategoryLabel } from '@/components/categories/CategoryLabel';
import { ChartTooltip } from '@/components/charts/chart-tooltip';
import { CHART_AXIS_TICK, CHART_COLOR, chartSliceColor } from '@/components/charts/chart-theme';
import { EASE_OUT } from '@/components/motion/ease';
import { RevealGroup, RevealItem } from '@/components/motion/reveal';
import { Money } from '@/components/money';
import { SectionHeader } from '@/components/section-header';
import { Card, CardContent } from '@/components/ui/card';
import type { WalletPeriodAnalytics } from '@/lib/finance/wallet-period-analytics';
import { formatAxisMoney } from '@/lib/money';
import { STATUS_SOFT_CLASS } from '@/lib/status-tone';
import { cn, formatDate } from '@/lib/utils';

type WalletPeriodAnalyticsPanelsProps = {
  analytics: WalletPeriodAnalytics;
  rangeLabel: string;
  /** The panels stay mounted; turning active replays the reveal and the charts. */
  active?: boolean;
};

/** Operate motion limit, in ms. */
const CHART_ANIMATION_MS = 320;

const FLOW_FILL = {
  inflow: CHART_COLOR.income,
  outflow: CHART_COLOR.expense,
  cumulative: CHART_COLOR.info,
} as const;

const PANEL_CARD_CLASS = 'gap-0 overflow-hidden border-border/60 py-0';
const HEADER_ICON_CLASS =
  'flex size-8 shrink-0 items-center justify-center rounded-lg';
const TILE_CLASS = 'rounded-xl border border-border/50 bg-muted/10 px-3 py-2';

const FLOW_LEGEND = [
  { label: 'Ingresos', color: FLOW_FILL.inflow, markerClass: 'size-2 rounded-full' },
  { label: 'Egresos', color: FLOW_FILL.outflow, markerClass: 'size-2 rounded-full' },
  // A line, like the series: in dark it is close to Ingresos in hue.
  { label: 'Neto acumulado', color: FLOW_FILL.cumulative, markerClass: 'h-0.5 w-3 rounded-full' },
] as const;

const EmptyChartState = ({ message }: { message: string }) => (
  <EmptyState message={message} className="h-52 py-6" />
);

const InsightStat = ({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
}) => (
  <div className={TILE_CLASS}>
    <div className="mb-1 flex items-center gap-1.5 eyebrow text-muted-foreground">
      <Icon className="h-3.5 w-3.5" aria-hidden data-icon="inline-start" />
      {label}
    </div>
    <p className="font-sans text-sm font-bold tabular-nums text-foreground">
      {value}
    </p>
  </div>
);

export const WalletPeriodAnalyticsPanels = ({
  analytics,
  rangeLabel,
  active = true,
}: WalletPeriodAnalyticsPanelsProps) => {
  const reduceMotion = useReducedMotion();
  const chartMotion = {
    isAnimationActive: !reduceMotion,
    animationDuration: CHART_ANIMATION_MS,
  };
  // A new key remounts the chart, which is what replays its entrance.
  const chartKey = active ? 'active' : 'idle';
  const topCategories = analytics.categoryBreakdown.slice(0, 6);
  const mixRows = [
    {
      name: 'Ingresos',
      value: analytics.movementMix.income,
      color: CHART_COLOR.income,
    },
    {
      name: 'Egresos',
      value: analytics.movementMix.expense,
      color: CHART_COLOR.expense,
    },
    {
      name: 'Abonos TC',
      value: analytics.movementMix.cardPaymentIn,
      color: chartSliceColor(1),
    },
    {
      name: 'Pagos TC',
      value: analytics.movementMix.cardPaymentOut,
      color: chartSliceColor(3),
    },
  ].filter((row) => row.value > 0);

  const hasDailyActivity = analytics.dailyFlow.some(
    (row) => row.inflow > 0 || row.outflow > 0,
  );

  return (
    <RevealGroup
      active={active}
      className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,0.95fr)]"
    >
      <div className="space-y-4">
        <RevealItem index={0}>
        <Card className={PANEL_CARD_CLASS}>
          <CardContent className="px-4 py-4">
            <SectionHeader
              className="mb-3"
              title="Flujo diario"
              subtitle={`Ingresos, egresos y neto acumulado de ${rangeLabel}`}
              actions={
                <span className={cn(HEADER_ICON_CLASS, STATUS_SOFT_CLASS.info)}>
                  <TrendingUp className="h-4 w-4" aria-hidden data-icon="inline-start" />
                </span>
              }
            />
            {hasDailyActivity ? (
              <>
              <ul className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-caption text-muted-foreground">
                {FLOW_LEGEND.map(({ label, color, markerClass }) => (
                  <li key={label} className="flex items-center gap-1.5">
                    <span
                      className={cn('shrink-0', markerClass)}
                      style={{ backgroundColor: color }}
                      aria-hidden
                    />
                    {label}
                  </li>
                ))}
              </ul>
              <div
                className="h-64 w-full"
                role="img"
                aria-label={`Flujo diario de ${rangeLabel}: ingresos, egresos y neto acumulado`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart key={chartKey} data={analytics.dailyFlow}>
                    <CartesianGrid
                      stroke={CHART_COLOR.grid}
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tick={CHART_AXIS_TICK}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={CHART_AXIS_TICK}
                      tickLine={false}
                      axisLine={false}
                      width={58}
                      tickFormatter={formatAxisMoney}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        const date = payload?.[0]?.payload?.date as string | undefined;
                        return (
                          <ChartTooltip
                            active={active}
                            label={date ? formatDate(date) : undefined}
                            payload={payload?.map((entry) => ({
                              name: String(entry.name ?? ''),
                              value: entry.value as number | string,
                              dataKey: String(entry.dataKey ?? ''),
                            }))}
                          />
                        );
                      }}
                    />
                    <Bar
                      dataKey="inflow"
                      name="Ingresos"
                      fill={FLOW_FILL.inflow}
                      radius={[4, 4, 0, 0]}
                      {...chartMotion}
                    />
                    <Bar
                      dataKey="outflow"
                      name="Egresos"
                      fill={FLOW_FILL.outflow}
                      radius={[4, 4, 0, 0]}
                      {...chartMotion}
                    />
                    <Area
                      type="monotone"
                      dataKey="cumulativeNet"
                      name="Neto acumulado"
                      stroke={FLOW_FILL.cumulative}
                      fill="color-mix(in srgb, var(--status-info) 14%, transparent)"
                      strokeWidth={2}
                      {...chartMotion}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              </>
            ) : (
              <EmptyChartState message="Sin movimientos para graficar este periodo." />
            )}
          </CardContent>
        </Card>
        </RevealItem>

        <div className="grid gap-4 lg:grid-cols-2">
          <RevealItem index={1}>
          <Card className={cn(PANEL_CARD_CLASS, 'h-full')}>
            <CardContent className="px-4 py-4">
              <SectionHeader
              className="mb-3"
              title="Gasto por categoría"
              subtitle="Top categorías por egreso"
              actions={
                <span className={cn(HEADER_ICON_CLASS, STATUS_SOFT_CLASS.info)}>
                  <BarChart3 className="h-4 w-4" aria-hidden data-icon="inline-start" />
                </span>
              }
            />
              {topCategories.length > 0 ? (
                <ul className="space-y-3">
                  {topCategories.map((row, index) => (
                    <li key={row.category}>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <CategoryLabel
                          name={row.category}
                          icon={row.icon}
                          className="min-w-0 text-xs"
                        />
                        <div className="shrink-0 text-right">
                          <Money
                            value={row.amount}
                            tone="neutral"
                            className="block text-xs font-bold"
                          />
                          <p className="text-caption text-muted-foreground">
                            {row.pct}%
                          </p>
                        </div>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted/50">
                        <motion.div
                          key={chartKey}
                          className="h-full rounded-full"
                          style={{ background: chartSliceColor(index) }}
                          initial={{ width: reduceMotion ? `${Math.max(row.pct, 3)}%` : 0 }}
                          animate={{ width: `${Math.max(row.pct, 3)}%` }}
                          transition={{
                            duration: reduceMotion ? 0 : CHART_ANIMATION_MS / 1000,
                            ease: EASE_OUT,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyChartState message="No hay egresos categorizados en este periodo." />
              )}
            </CardContent>
          </Card>
          </RevealItem>

          <RevealItem index={2}>
          <Card className={cn(PANEL_CARD_CLASS, 'h-full')}>
            <CardContent className="px-4 py-4">
              <SectionHeader
              className="mb-3"
              title="Mezcla de movimientos"
              subtitle="Ingresos, egresos y pagos a tarjeta"
              actions={
                <span className={cn(HEADER_ICON_CLASS, STATUS_SOFT_CLASS.income)}>
                  <PieChartIcon className="h-4 w-4" aria-hidden data-icon="inline-start" />
                </span>
              }
            />
              {mixRows.length > 0 ? (
                <div className="grid items-center gap-3 sm:grid-cols-[160px_1fr]">
                  <div className="h-40" role="img" aria-label="Mezcla de movimientos del periodo">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart key={chartKey}>
                        <Pie
                          {...chartMotion}
                          data={mixRows}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={42}
                          outerRadius={65}
                          paddingAngle={2}
                        >
                          {mixRows.map((row) => (
                            <Cell key={row.name} fill={row.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="space-y-2">
                    {mixRows.map((row) => (
                      <li
                        key={row.name}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: row.color }}
                          />
                          <span className="truncate">{row.name}</span>
                        </span>
                        <Money value={row.value} tone="neutral" className="text-xs" />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <EmptyChartState message="Sin movimientos para comparar." />
              )}
            </CardContent>
          </Card>
          </RevealItem>
        </div>
      </div>

      <aside>
        <RevealItem index={3} className="xl:h-full">
        <Card className={cn(PANEL_CARD_CLASS, 'xl:h-full')}>
          <CardContent className="space-y-3 px-4 py-4">
            <SectionHeader
              title="Movimientos destacados"
              actions={
                <span className={cn(HEADER_ICON_CLASS, STATUS_SOFT_CLASS.info)}>
                  <Star className="h-4 w-4" aria-hidden data-icon="inline-start" />
                </span>
              }
            />
            <div className="space-y-2">
              <InsightStat
                icon={Activity}
                label="Días con actividad"
                value={`${analytics.activeDays}/${analytics.daysInRange}`}
              />
              {analytics.largestOutflow ? (
                <div className={TILE_CLASS}>
                  <p className="mb-1 flex items-center gap-1.5 eyebrow text-muted-foreground">
                    <ArrowUpRight className="h-3.5 w-3.5 text-status-expense" data-icon="inline-start" />
                    Mayor egreso
                  </p>
                  <p
                    className="truncate text-sm font-medium"
                    title={analytics.largestOutflow.description}
                  >
                    {analytics.largestOutflow.description}
                  </p>
                  <Money
                    value={analytics.largestOutflow.amount}
                    tone="neutral"
                    className="block font-bold"
                  />
                </div>
              ) : null}
              {analytics.largestInflow ? (
                <div className={TILE_CLASS}>
                  <p className="mb-1 flex items-center gap-1.5 eyebrow text-muted-foreground">
                    <ArrowDownLeft className="h-3.5 w-3.5 text-status-income" data-icon="inline-start" />
                    Mayor ingreso
                  </p>
                  <p
                    className="truncate text-sm font-medium"
                    title={analytics.largestInflow.description}
                  >
                    {analytics.largestInflow.description}
                  </p>
                  <Money
                    value={analytics.largestInflow.amount}
                    tone="positive"
                    className="block font-bold"
                  />
                </div>
              ) : null}
              {!analytics.largestOutflow && !analytics.largestInflow ? (
                <EmptyChartState message="Aún no hay movimientos destacados." />
              ) : null}
            </div>
          </CardContent>
        </Card>
        </RevealItem>
      </aside>
    </RevealGroup>
  );
};
