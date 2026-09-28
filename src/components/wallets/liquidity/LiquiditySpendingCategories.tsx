'use client';

import EmptyState from '@/components/EmptyState';
import { ErrorBanner } from '@/components/error-banner';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PieChart } from 'lucide-react';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import { cn, formatCurrency } from '@/lib/utils';
import { METRIC_STRIP_CLASS } from '@/components/ui/metric-strip';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LIQUIDITY_PANEL_CLASS,
  LiquidityPanelHeader,
} from '@/components/wallets/liquidity/liquidity-section';
import { formatCategoryLabel } from '@/components/categories/CategoryLabel';
import { chartSliceColor } from '@/components/charts/chart-theme';

const ROLLING_MONTHS = 12;

type CategoryReportRow = {
  category: string;
  categoryIcon?: string | null;
  total: number;
};

type LiquiditySpendingCategoriesProps = {
  /** Bumped by the workspace pull-to-refresh to reload this section. */
  refreshToken?: number;
};

export const LiquiditySpendingCategories = ({
  refreshToken = 0,
}: LiquiditySpendingCategoriesProps) => {
  const { context } = useFinanceContext();
  const [categories, setCategories] = useState<CategoryReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!context || (context.type === 'user' && context.id === 0)) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const rows = await clientFetchFromApi<CategoryReportRow[]>(
        `/api/reports?type=by-category&windowMonths=${ROLLING_MONTHS}`,
        undefined,
        context,
      );
      setCategories(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar tus categorías');
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  const topCategories = useMemo(
    () => [...categories].sort((a, b) => b.total - a.total).slice(0, 5),
    [categories],
  );

  const maxCategoryAmount = useMemo(
    () => Math.max(...topCategories.map((row) => row.total), 1),
    [topCategories],
  );

  const totalTopFive = useMemo(
    () => topCategories.reduce((sum, row) => sum + row.total, 0),
    [topCategories],
  );

  return (
    <section
      className={cn(LIQUIDITY_PANEL_CLASS, 'space-y-4')}
      aria-labelledby="categories-heading"
    >
      <LiquidityPanelHeader
        id="categories-heading"
        title="En qué se va tu dinero"
        subtitle={`Top 5 categorías de los últimos ${ROLLING_MONTHS} meses`}
        icon={PieChart}
      />

      {error ? (
        <ErrorBanner>{error}</ErrorBanner>
      ) : null}

      {loading ? (
        <div className="space-y-4" aria-hidden>
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      ) : topCategories.length === 0 ? (
        <EmptyState message="Aún no hay categorías con gasto en este periodo." className="py-8" />
      ) : (
        <div className="space-y-4">
          <div
            className={cn(
              METRIC_STRIP_CLASS,
              'flex items-center justify-between gap-2 border-l-[3px] border-l-status-expense',
            )}
          >
            <span className="overline text-muted-foreground">
              Top 5 acumulado
            </span>
            <span className="font-sans text-sm font-bold tabular-nums text-foreground">
              {formatCurrency(totalTopFive)}
            </span>
          </div>

          {topCategories.map((row, index) => {
            const widthPercent = (row.total / maxCategoryAmount) * 100;
            const sharePercent =
              totalTopFive > 0 ? Math.round((row.total / totalTopFive) * 100) : 0;
            const label = formatCategoryLabel(row.category, row.categoryIcon);
            const tone = chartSliceColor(index);

            return (
              <div key={row.category} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-caption font-bold tabular-nums text-primary-foreground"
                      style={{ background: tone }}
                      aria-hidden
                    >
                      {index + 1}
                    </span>
                    <span className="truncate text-sm font-medium">{label}</span>
                  </div>
                  <div className="flex shrink-0 items-baseline gap-2">
                    <span className="text-caption tabular-nums text-muted-foreground">
                      {sharePercent}%
                    </span>
                    <span className="money-negative font-sans text-sm font-bold tabular-nums">
                      {formatCurrency(row.total)}
                    </span>
                  </div>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-muted/50 dark:bg-white/[0.06]"
                  role="presentation"
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(widthPercent, 6)}%`,
                      background: tone,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
