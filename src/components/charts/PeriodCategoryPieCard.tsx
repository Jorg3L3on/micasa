'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { useTheme } from 'next-themes';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { CategoryLabel } from '@/components/categories/CategoryLabel';
import {
  buildCategoryPieChartData,
  CATEGORY_PIE_SLICE_COLORS,
  type CategoryPieSlice,
  type CategoryPieRow,
} from '@/components/charts/period-category-pie';

type BarTooltipProps = {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: CategoryPieSlice & { shortLabel: string; color: string };
  }>;
};

const BarTooltip = ({ active, payload }: BarTooltipProps) => {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
      <div className="mb-1 flex items-center gap-2">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: row.color }}
          aria-hidden
        />
        <CategoryLabel
          name={row.category}
          icon={row.categoryIcon}
          className="font-medium text-foreground"
          iconClassName="h-3.5 w-3.5"
        />
      </div>
      <p className="font-mono font-medium tabular-nums text-foreground">
        {formatCurrency(row.value)}
      </p>
      <p className="mt-0.5 text-muted-foreground">{row.pct.toFixed(1)}% del total</p>
    </div>
  );
};

const shortAxisMoney = (n: number): string => {
  if (!Number.isFinite(n)) return '';
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(Math.round(n));
};

const truncateLabel = (label: string, max = 10): string => {
  const trimmed = label.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(1, max - 1))}…`;
};

type PeriodCategoryPieCardProps = {
  title?: string;
  scopeLabel: string;
  subtitle?: string;
  rows: CategoryPieRow[];
  compact?: boolean;
};

export const PeriodCategoryPieCard = ({
  title = 'Gasto por categoría',
  scopeLabel,
  subtitle = 'Planificación (efectivo/débito); sin cargos solo TC ni cuotas MSI.',
  rows,
  compact = false,
}: PeriodCategoryPieCardProps) => {
  const chartId = useId().replace(/:/g, '');
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    // Theme-dependent chart strokes wait for client mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Theme-dependent chart colors must wait for client mount.
    setMounted(true);
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mq.matches);
    const onChange = () => setReduceMotion(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const isDark = mounted && resolvedTheme === 'dark';
  const axisColor = isDark ? '#a1a1aa' : '#71717a';
  const gridColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
  const baselineColor = isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.14)';

  const chartData = useMemo(() => {
    const slices = buildCategoryPieChartData(rows);
    return slices.map((slice, i) => {
      const color =
        CATEGORY_PIE_SLICE_COLORS[i % CATEGORY_PIE_SLICE_COLORS.length];
      return {
        ...slice,
        shortLabel: truncateLabel(slice.name, compact ? 8 : 10),
        color,
      };
    });
  }, [rows, compact]);

  const totalExpense = useMemo(
    () => chartData.reduce((s, r) => s + r.value, 0),
    [chartData],
  );

  const chartHeight = compact ? 168 : 220;
  const barSize =
    chartData.length <= 2 ? (compact ? 22 : 26) : compact ? 16 : 20;

  return (
    <div
      className="flex flex-col rounded-xl border border-border/60 bg-card p-4 shadow-sm sm:p-5"
      role="region"
      aria-label={`${title}, ${scopeLabel}`}
    >
      <div className="mb-4 flex items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 dark:bg-rose-500/15">
          <BarChart3
            className="h-4 w-4 text-rose-600 dark:text-rose-400"
            aria-hidden
          />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
            <div className="min-w-0">
              <h3 className="text-balance text-sm font-semibold leading-none text-foreground sm:text-base">
                {title}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">{scopeLabel}</p>
            </div>
            {chartData.length > 0 ? (
              <div className="shrink-0 text-right">
                <p className="font-mono text-sm font-semibold tabular-nums tracking-tight text-foreground">
                  {formatCurrency(totalExpense)}
                </p>
                <p className="text-[10px] text-muted-foreground">Total del periodo</p>
              </div>
            ) : null}
          </div>
          {subtitle ? (
            <p className="mt-1 text-[10px] text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      </div>

      {chartData.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No hay gastos categorizados en este periodo.
        </p>
      ) : (
        <div className="flex min-w-0 flex-col gap-3">
          {chartData.length > 1 ? (
            <ul
              className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1.5"
              aria-label="Leyenda de categorías"
            >
              {chartData.map((row) => (
                <li
                  key={`${chartId}-legend-${row.name}`}
                  className="flex max-w-[9.5rem] items-center gap-1.5"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: row.color }}
                    aria-hidden
                  />
                  <span className="truncate text-[11px] text-muted-foreground">
                    {row.name}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          <div
            className={cn('w-full min-w-0')}
            style={{ height: chartHeight }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
                barCategoryGap="28%"
              >
                <CartesianGrid
                  strokeDasharray="4 6"
                  stroke={gridColor}
                  vertical={false}
                />
                <XAxis
                  dataKey="shortLabel"
                  tick={{ fontSize: 11, fill: axisColor }}
                  tickLine={false}
                  axisLine={{ stroke: baselineColor }}
                  interval={0}
                />
                <YAxis
                  hide
                  domain={[0, (dataMax: number) => Math.max(dataMax * 1.08, 1)]}
                />
                <Tooltip
                  content={<BarTooltip />}
                  cursor={{ fill: gridColor, radius: 6 }}
                />
                <Bar
                  dataKey="value"
                  name="Gasto"
                  radius={[10, 10, 0, 0]}
                  maxBarSize={barSize}
                  isAnimationActive={!reduceMotion}
                  animationDuration={450}
                  animationEasing="ease-out"
                >
                  {chartData.map((row) => (
                    <Cell
                      key={`${chartId}-bar-${row.name}`}
                      fill={row.color}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <ul className="grid w-full gap-1.5 text-[11px]">
            {chartData.map((row) => (
              <li
                key={`${chartId}-row-${row.name}`}
                className="flex min-w-0 items-center gap-2 rounded-md px-1 py-0.5 -mx-1 transition-colors duration-150 hover:bg-muted/40 motion-reduce:transition-none"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: row.color }}
                  aria-hidden
                />
                <CategoryLabel
                  name={row.category}
                  icon={row.categoryIcon}
                  className="min-w-0 flex-1 text-muted-foreground"
                  iconClassName="h-3.5 w-3.5"
                />
                <span className="shrink-0 font-mono tabular-nums text-foreground">
                  {formatCurrency(row.value)}
                </span>
                <span className="w-9 shrink-0 text-right font-mono tabular-nums text-muted-foreground">
                  {row.pct.toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>

          {/* Screen-reader friendly scale (Y axis is visually hidden like Whisper). */}
          <p className="sr-only">
            Escala hasta {shortAxisMoney(Math.max(...chartData.map((r) => r.value)))}.
          </p>
        </div>
      )}
    </div>
  );
};
