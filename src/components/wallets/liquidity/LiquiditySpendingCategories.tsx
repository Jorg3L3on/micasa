'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import { cn, formatCurrency } from '@/lib/utils';
import { MONTHLY_PANEL_SHELL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { LiquiditySectionHeader } from '@/components/wallets/liquidity/liquidity-section';
import { formatCategoryLabel } from '@/components/categories/CategoryLabel';

const ROLLING_MONTHS = 12;

const BAR_GRADIENTS = [
  'from-[#3a37fc] to-[#6366f1]',
  'from-[#6366f1] to-[#911efe]',
  'from-[#911efe] to-[#c026d3]',
  'from-[#c026d3] to-[#ee477a]',
  'from-[#ee477a] to-[#f97316]',
] as const;

type CategoryReportRow = {
  category: string;
  categoryIcon?: string | null;
  total: number;
};

type LiquiditySpendingCategoriesProps = {
  sectionIcon?: LucideIcon;
};

export const LiquiditySpendingCategories = ({
  sectionIcon: SectionIcon,
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
  }, [load]);

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
    <>
      {SectionIcon ? (
        <LiquiditySectionHeader
          id="categories-heading"
          title="En qué se va tu dinero"
          description={`Las 5 categorías donde más gastaste en los últimos ${ROLLING_MONTHS} meses.`}
          icon={SectionIcon}
          accent="amber"
        />
      ) : null}

      <section
        className={cn(MONTHLY_PANEL_SHELL_CLASS, 'overflow-hidden px-4 py-4 sm:px-5 sm:py-5')}
        aria-labelledby={SectionIcon ? undefined : 'categories-heading'}
      >
        {!SectionIcon ? (
          <div className="mb-4">
            <h2 id="categories-heading" className="text-base font-semibold leading-tight">
              En qué se va tu dinero
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Las 5 categorías donde más gastaste en los últimos {ROLLING_MONTHS} meses.
            </p>
          </div>
        ) : null}

        {error ? (
          <div
            className="rounded-xl border border-l-[3px] border-l-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="space-y-4 animate-pulse">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <div className="h-4 w-2/3 rounded bg-muted/40" />
                <div className="h-2.5 rounded-full bg-muted/40" />
              </div>
            ))}
          </div>
        ) : topCategories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aún no hay categorías con gasto en este periodo.
          </p>
        ) : (
          <div className="space-y-4">
            {topCategories.length > 0 ? (
              <div className="flex flex-wrap items-end justify-between gap-2 rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5 dark:border-white/[0.06] dark:bg-white/[0.02]">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Top 5 acumulado
                </p>
                <p className="font-mono text-sm font-bold tabular-nums text-foreground">
                  {formatCurrency(totalTopFive)}
                </p>
              </div>
            ) : null}

            {topCategories.map((row, index) => {
              const widthPercent = (row.total / maxCategoryAmount) * 100;
              const sharePercent =
                totalTopFive > 0 ? Math.round((row.total / totalTopFive) * 100) : 0;
              const label = formatCategoryLabel(row.category, row.categoryIcon);
              const gradient = BAR_GRADIENTS[index % BAR_GRADIENTS.length];

              return (
                <div key={row.category} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={cn(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-[10px] font-bold tabular-nums text-white',
                          gradient,
                        )}
                        aria-hidden
                      >
                        {index + 1}
                      </span>
                      <span className="truncate text-sm font-medium">{label}</span>
                    </div>
                    <div className="flex shrink-0 items-baseline gap-2">
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        {sharePercent}%
                      </span>
                      <span className="money-negative font-mono text-sm font-bold tabular-nums">
                        {formatCurrency(row.total)}
                      </span>
                    </div>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full bg-muted/50 dark:bg-white/[0.06]"
                    role="presentation"
                  >
                    <div
                      className={cn(
                        'h-full rounded-full bg-gradient-to-r transition-all duration-500',
                        gradient,
                      )}
                      style={{ width: `${Math.max(widthPercent, 6)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
};
