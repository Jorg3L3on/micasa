'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { PieChart as PieChartIcon } from 'lucide-react';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import { buildCategoryReportApiPath } from '@/lib/dashboard/build-category-report-query';
import { formatCurrency } from '@/lib/utils';
import type { DashboardData } from '@/types/dashboard';
import { formatCategoryLabel } from '@/components/categories/CategoryLabel';

type Row = { name: string; value: number };
type CategoryReportRow = {
  category: string;
  categoryIcon?: string | null;
  total: number;
};

const MONTH_LABELS = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

const SLICE_COLORS = [
  '#6366f1',
  '#10b981',
  '#f97316',
  '#eab308',
  '#ec4899',
  '#14b8a6',
  '#8b5cf6',
  '#06b6d4',
  '#84cc16',
  '#f43f5e',
  '#0ea5e9',
  '#a855f7',
];

const MAX_SLICES = 8;

function bucketCategoryRows(
  rows: CategoryReportRow[],
): Row[] {
  const sorted = [...rows].sort((a, b) => b.total - a.total);
  if (sorted.length <= MAX_SLICES) {
    return sorted.map((r) => ({
      name: formatCategoryLabel(r.category, r.categoryIcon),
      value: r.total,
    }));
  }
  const top = sorted.slice(0, MAX_SLICES - 1);
  const rest = sorted.slice(MAX_SLICES - 1);
  const otros = rest.reduce((s, r) => s + r.total, 0);
  return [
    ...top.map((r) => ({
      name: formatCategoryLabel(r.category, r.categoryIcon),
      value: r.total,
    })),
    { name: 'Otros', value: otros },
  ];
}

type PieTooltipProps = {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: Row & { pct: number } }>;
};

function PieTooltip({ active, payload }: PieTooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const row = p.payload as Row & { pct: number };
  return (
    <div className="rounded-lg border border-border/60 bg-card px-3 py-2 shadow-lg text-xs">
      <p className="font-medium text-foreground">{row.name}</p>
      <p className="font-mono tabular-nums text-foreground">{formatCurrency(row.value)}</p>
      <p className="text-[10px] text-muted-foreground">{row.pct.toFixed(1)}%</p>
    </div>
  );
}

type DashboardPeriodCategoryPieProps = {
  period: DashboardData['period'];
};

export default function DashboardPeriodCategoryPie({
  period,
}: DashboardPeriodCategoryPieProps) {
  const { context } = useFinanceContext();
  const [rows, setRows] = useState<CategoryReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const scopeLabel = useMemo(() => {
    const m = MONTH_LABELS[period.month - 1];
    if (period.view === 'biweekly') {
      const q = period.period === 'FIRST' ? '1ª' : '2ª';
      return `${q} quincena · ${m} ${period.year}`;
    }
    return `${m} ${period.year} (mes)`;
  }, [period]);

  const load = useCallback(async () => {
    if (!context || (context.type === 'user' && context.id === 0)) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const path = buildCategoryReportApiPath(period);
      const result = await clientFetchFromApi<CategoryReportRow[]>(
        path,
        undefined,
        context,
      );
      setRows(Array.isArray(result) ? result : []);
    } catch {
      setError('No se pudieron cargar las categorías.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [context, period]);

  useEffect(() => {
    void load();
  }, [load]);

  const chartData = useMemo(() => {
    const buckets = bucketCategoryRows(rows);
    const sum = buckets.reduce((s, r) => s + r.value, 0);
    if (sum <= 0) return [];
    return buckets.map((r) => ({
      ...r,
      pct: (r.value / sum) * 100,
    }));
  }, [rows]);

  const totalExpense = useMemo(
    () => chartData.reduce((s, r) => s + r.value, 0),
    [chartData],
  );

  if (loading) {
    return (
      <div className="flex min-h-[280px] flex-col rounded-xl border border-border/60 bg-card p-5 shadow-sm animate-pulse">
        <div className="mb-4 h-5 w-48 rounded bg-muted/40" />
        <div className="mx-auto h-52 w-52 rounded-full bg-muted/25" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex min-h-[200px] flex-col justify-center rounded-xl border border-border/60 bg-card p-5 shadow-sm"
        role="alert"
      >
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-[280px] flex-col rounded-xl border border-border/60 bg-card p-5 shadow-sm"
      role="region"
      aria-label={`Gasto por categoría, ${scopeLabel}`}
    >
      <div className="mb-3 flex items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 dark:bg-violet-500/15">
          <PieChartIcon className="h-4 w-4 text-violet-600 dark:text-violet-400" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold leading-none text-foreground">
            Gasto por categoría
          </h3>
          <p className="mt-1 text-[10px] text-muted-foreground">{scopeLabel}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Planificación (efectivo/débito); sin cargos solo TC ni cuotas MSI.
          </p>
        </div>
      </div>

      {chartData.length === 0 ? (
        <p className="flex flex-1 items-center justify-center py-10 text-center text-sm text-muted-foreground">
          No hay gastos categorizados en este periodo.
        </p>
      ) : (
        <div className="relative flex flex-1 flex-col items-center">
          <div className="relative h-[220px] w-full max-w-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={88}
                  paddingAngle={2}
                  stroke="transparent"
                >
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Total
              </span>
              <span className="mt-0.5 text-lg font-bold font-mono tabular-nums text-foreground">
                {formatCurrency(totalExpense)}
              </span>
            </div>
          </div>

          <ul className="mt-4 grid w-full max-w-md gap-1.5 text-[11px] sm:grid-cols-2">
            {chartData.map((row, i) => (
              <li key={row.name} className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: SLICE_COLORS[i % SLICE_COLORS.length] }}
                />
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{row.name}</span>
                <span className="shrink-0 font-mono tabular-nums text-foreground">
                  {row.pct.toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
