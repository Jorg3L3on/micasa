'use client';

import EmptyState from '@/components/EmptyState';
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Gauge,
  PieChart as PieChartIcon,
  TrendingUp,
} from 'lucide-react';
import {
  Area,
  Bar,
  BarChart,
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
import { Card, CardContent } from '@/components/ui/card';
import type { WalletPeriodAnalytics } from '@/lib/finance/wallet-period-analytics';
import { formatAxisMoney } from '@/lib/money';
import { cn, formatCurrency, formatDate } from '@/lib/utils';

type WalletPeriodAnalyticsPanelsProps = {
  analytics: WalletPeriodAnalytics;
  balance: number;
  rangeLabel: string;
  runwayDays: number | null;
};

const FLOW_FILL = {
  inflow: CHART_COLOR.income,
  outflow: CHART_COLOR.expense,
  cumulative: CHART_COLOR.info,
} as const;

const EmptyChartState = ({ message }: { message: string }) => (
  <EmptyState message={message} className="h-52 py-6" />
);

const InsightStat = ({
  icon: Icon,
  label,
  value,
  tone = 'neutral',
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  tone?: 'neutral' | 'good' | 'warn';
}) => (
  <div className="rounded-xl border border-border/50 bg-muted/10 px-3 py-2">
    <div className="mb-1 flex items-center gap-1.5 eyebrow text-muted-foreground">
      <Icon
        className={cn(
          'h-3.5 w-3.5',
          tone === 'good' && 'text-status-income',
          tone === 'warn' && 'text-status-pending',
        )}
        aria-hidden data-icon="inline-start" />
      {label}
    </div>
    <p className="font-sans text-sm font-bold tabular-nums text-foreground">
      {value}
    </p>
  </div>
);

export const WalletPeriodAnalyticsPanels = ({
  analytics,
  balance,
  rangeLabel,
  runwayDays,
}: WalletPeriodAnalyticsPanelsProps) => {
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
      color: CHART_COLOR.income,
    },
    {
      name: 'Pagos TC',
      value: analytics.movementMix.cardPaymentOut,
      color: CHART_COLOR.expense,
    },
  ].filter((row) => row.value > 0);

  const hasDailyActivity = analytics.dailyFlow.some(
    (row) => row.inflow > 0 || row.outflow > 0,
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,0.95fr)]">
      <div className="space-y-4">
        <Card className="overflow-hidden border-border/60">
          <CardContent className="px-4 py-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-none">
                  Flujo diario
                </p>
                <p className="mt-1 text-caption text-muted-foreground">
                  Ingresos, egresos y neto acumulado de {rangeLabel}
                </p>
              </div>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-status-info/10 text-status-info dark:bg-status-info/15 dark:text-status-info">
                <TrendingUp className="h-4 w-4" aria-hidden data-icon="inline-start" />
              </span>
            </div>
            {hasDailyActivity ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={analytics.dailyFlow}>
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
                    />
                    <Bar
                      dataKey="outflow"
                      name="Egresos"
                      fill={FLOW_FILL.outflow}
                      radius={[4, 4, 0, 0]}
                    />
                    <Area
                      type="monotone"
                      dataKey="cumulativeNet"
                      name="Neto acumulado"
                      stroke={FLOW_FILL.cumulative}
                      fill="color-mix(in srgb, var(--status-info) 14%, transparent)"
                      strokeWidth={2}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyChartState message="Sin movimientos para graficar este periodo." />
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="overflow-hidden border-border/60">
            <CardContent className="px-4 py-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold leading-none">
                    Gasto por categoría
                  </p>
                  <p className="mt-1 text-caption text-muted-foreground">
                    Top categorías por egreso
                  </p>
                </div>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-status-info/10 text-status-info dark:bg-status-info/15 dark:text-status-info">
                  <BarChart3 className="h-4 w-4" aria-hidden data-icon="inline-start" />
                </span>
              </div>
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
                          <p className="font-sans text-xs font-bold tabular-nums">
                            {formatCurrency(row.amount)}
                          </p>
                          <p className="text-caption text-muted-foreground">
                            {row.pct}%
                          </p>
                        </div>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted/50">
                        <div
                          className="h-full rounded-full"
                          style={{
                            background: chartSliceColor(index),
                            width: `${Math.max(row.pct, 3)}%`,
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

          <Card className="overflow-hidden border-border/60">
            <CardContent className="px-4 py-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold leading-none">
                    Mezcla de movimientos
                  </p>
                  <p className="mt-1 text-caption text-muted-foreground">
                    Ingresos, egresos y pagos a tarjeta
                  </p>
                </div>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-status-income/10 text-status-income dark:bg-status-income/15 dark:text-status-income">
                  <PieChartIcon className="h-4 w-4" aria-hidden data-icon="inline-start" />
                </span>
              </div>
              {mixRows.length > 0 ? (
                <div className="grid items-center gap-3 sm:grid-cols-[160px_1fr]">
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
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
                        <span className="font-sans font-semibold tabular-nums">
                          {formatCurrency(row.value)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <EmptyChartState message="Sin movimientos para comparar." />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <aside className="space-y-4">
        <Card className="overflow-hidden border-border/60">
          <CardContent className="space-y-3 px-4 py-4">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-status-info/10 text-status-info dark:bg-status-info/15 dark:text-status-info">
                <Gauge className="h-4 w-4" aria-hidden data-icon="inline-start" />
              </span>
              <div>
                <p className="text-sm font-semibold leading-none">
                  Salud de la billetera
                </p>
                <p className="mt-1 text-caption text-muted-foreground">
                  Ritmo del periodo y cobertura estimada
                </p>
              </div>
            </div>

            <div className="grid gap-2">
              <InsightStat
                icon={Activity}
                label="Días con actividad"
                value={`${analytics.activeDays}/${analytics.daysInRange}`}
              />
              <InsightStat
                icon={ArrowUpRight}
                label="Ritmo diario de salida"
                value={formatCurrency(analytics.averageDailyOutflow)}
                tone={analytics.averageDailyOutflow > 0 ? 'warn' : 'good'}
              />
              <InsightStat
                icon={Gauge}
                label="Cobertura"
                value={
                  runwayDays == null
                    ? 'Sin egresos'
                    : runwayDays === 1
                      ? '1 día'
                      : `${runwayDays} días`
                }
                tone={runwayDays != null && runwayDays < 7 ? 'warn' : 'good'}
              />
              <InsightStat
                icon={TrendingUp}
                label="Saldo actual"
                value={formatCurrency(balance)}
                tone={balance >= 0 ? 'good' : 'warn'}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/60">
          <CardContent className="space-y-3 px-4 py-4">
            <p className="text-sm font-semibold leading-none">
              Movimientos destacados
            </p>
            <div className="space-y-2">
              {analytics.largestOutflow ? (
                <div className="rounded-xl bg-muted/10 px-3 py-2">
                  <p className="mb-1 flex items-center gap-1.5 eyebrow text-muted-foreground">
                    <ArrowUpRight className="h-3.5 w-3.5 text-status-expense" data-icon="inline-start" />
                    Mayor egreso
                  </p>
                  <p className="truncate text-sm font-medium">
                    {analytics.largestOutflow.description}
                  </p>
                  <p className="font-sans text-sm font-bold tabular-nums text-status-expense">
                    {formatCurrency(analytics.largestOutflow.amount)}
                  </p>
                </div>
              ) : null}
              {analytics.largestInflow ? (
                <div className="rounded-xl bg-muted/10 px-3 py-2">
                  <p className="mb-1 flex items-center gap-1.5 eyebrow text-muted-foreground">
                    <ArrowDownLeft className="h-3.5 w-3.5 text-status-income" data-icon="inline-start" />
                    Mayor ingreso
                  </p>
                  <p className="truncate text-sm font-medium">
                    {analytics.largestInflow.description}
                  </p>
                  <p className="font-sans text-sm font-bold tabular-nums text-status-income">
                    {formatCurrency(analytics.largestInflow.amount)}
                  </p>
                </div>
              ) : null}
              {!analytics.largestOutflow && !analytics.largestInflow ? (
                <p className="rounded-xl border border-dashed border-border/50 px-3 py-8 text-center text-sm text-muted-foreground">
                  Aún no hay movimientos destacados.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
};
