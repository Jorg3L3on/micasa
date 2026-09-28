'use client';

import EmptyState from '@/components/EmptyState';
import { useId, useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { PieChart as PieChartIcon } from 'lucide-react';
import { SectionHeader } from '@/components/section-header';
import { cn, formatCurrency } from '@/lib/utils';
import { CategoryLabel } from '@/components/categories/CategoryLabel';
import {
  buildCategoryPieChartData,
  CATEGORY_PIE_SLICE_COLORS,
  type CategoryPieSlice,
  type CategoryPieRow,
} from '@/components/charts/period-category-pie';

type PieTooltipProps = {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: CategoryPieSlice;
  }>;
};

const PieTooltip = ({ active, payload }: PieTooltipProps) => {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-border/60 bg-card px-3 py-2 text-xs shadow-lg">
      <CategoryLabel
        name={row.category}
        icon={row.categoryIcon}
        className="font-medium text-foreground"
        iconClassName="h-3.5 w-3.5"
      />
      <p className="font-sans tabular-nums text-foreground">
        {formatCurrency(row.value)}
      </p>
      <p className="text-caption text-muted-foreground">{row.pct.toFixed(1)}%</p>
    </div>
  );
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
  const chartData = useMemo(() => buildCategoryPieChartData(rows), [rows]);
  const totalExpense = useMemo(
    () => chartData.reduce((s, r) => s + r.value, 0),
    [chartData],
  );

  const chartHeight = compact ? 'h-[180px]' : 'h-[220px]';
  const innerR = compact ? 48 : 58;
  const outerR = compact ? 72 : 88;

  return (
    <div
      className="flex flex-col rounded-xl border border-border/60 bg-card p-4 shadow-sm sm:p-5"
      role="region"
      aria-label={`${title}, ${scopeLabel}`}
    >
      <SectionHeader
        className="mb-3"
        icon={PieChartIcon}
        title={title}
        subtitle={
          <>
            {scopeLabel}
            {subtitle ? <span className="mt-0.5 block">{subtitle}</span> : null}
          </>
        }
      />

      {chartData.length === 0 ? (
        <EmptyState message="No hay gastos categorizados en este periodo." className="py-8" />
      ) : (
        <div className="relative flex flex-col items-center">
          <div className={cn('relative w-full max-w-[280px]', chartHeight)}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={innerR}
                  outerRadius={outerR}
                  paddingAngle={2}
                  stroke="transparent"
                >
                  {chartData.map((_, i) => (
                    <Cell
                      key={`${chartId}-slice-${i}`}
                      fill={
                        CATEGORY_PIE_SLICE_COLORS[
                          i % CATEGORY_PIE_SLICE_COLORS.length
                        ]
                      }
                    />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-1">
              <span className="overline text-muted-foreground">
                Total
              </span>
              <span className="mt-0.5 font-sans text-base font-bold tabular-nums text-foreground sm:text-lg">
                {formatCurrency(totalExpense)}
              </span>
            </div>
          </div>

          <ul className="mt-3 grid w-full gap-1.5 text-caption">
            {chartData.map((row, i) => (
              <li key={row.name} className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{
                    background:
                      CATEGORY_PIE_SLICE_COLORS[
                        i % CATEGORY_PIE_SLICE_COLORS.length
                      ],
                  }}
                />
                <CategoryLabel
                  name={row.category}
                  icon={row.categoryIcon}
                  className="min-w-0 flex-1 text-muted-foreground"
                  iconClassName="h-3.5 w-3.5"
                />
                <span className="shrink-0 font-sans tabular-nums text-foreground">
                  {formatCurrency(row.value)}
                </span>
                <span className="w-8 shrink-0 text-right font-sans tabular-nums text-muted-foreground">
                  {row.pct.toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
