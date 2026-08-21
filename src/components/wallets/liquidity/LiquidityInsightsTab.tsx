'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { History } from 'lucide-react';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import { formatCurrency, cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import MonthlyOverviewChart from '@/components/wallets/liquidity/MonthlyOverviewChart';
import { LiquidityPastMonthFocus } from '@/components/wallets/liquidity/LiquidityPastMonthFocus';
import { LiquidityAccountsToday } from '@/components/wallets/liquidity/LiquidityAccountsToday';
import type { MonthlySummaryItem } from '@/app/api/wallets/liquidity/monthly-summary/route';
import { formatCategoryLabel } from '@/components/categories/CategoryLabel';
import {
  monthKeyFromParts,
  shiftSelectedMonthKey,
} from '@/components/wallets/liquidity/liquidity-personalization';

const ROLLING_MONTHS = 12;

type CategoryReportRow = {
  category: string;
  categoryIcon?: string | null;
  total: number;
};

export function LiquidityInsightsTab() {
  const { data: session } = useSession();
  const { context } = useFinanceContext();
  const firstName = session?.user?.name?.trim().split(/\s+/)[0];
  const [categories, setCategories] = useState<CategoryReportRow[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [selectedMonthKey, setSelectedMonthKey] = useState('');

  const load = useCallback(async () => {
    if (!context || (context.type === 'user' && context.id === 0)) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setCategoryError(null);
      const [catRows, monthlyRows] = await Promise.all([
        clientFetchFromApi<CategoryReportRow[]>(
          `/api/reports?type=by-category&windowMonths=${ROLLING_MONTHS}`,
          undefined,
          context,
        ),
        clientFetchFromApi<MonthlySummaryItem[]>(
          '/api/wallets/liquidity/monthly-summary',
          undefined,
          context,
        ),
      ]);
      setCategories(Array.isArray(catRows) ? catRows : []);
      setMonthlySummary(Array.isArray(monthlyRows) ? monthlyRows : []);
    } catch (e) {
      setCategoryError(e instanceof Error ? e.message : 'No se pudieron cargar tus datos');
      setCategories([]);
      setMonthlySummary([]);
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    void load();
  }, [load]);

  const monthKeys = useMemo(
    () => monthlySummary.map((month) => monthKeyFromParts(month.year, month.month)),
    [monthlySummary],
  );

  useEffect(() => {
    if (monthKeys.length === 0) return;
    if (monthKeys.includes(selectedMonthKey)) return;
    setSelectedMonthKey(monthKeys[monthKeys.length - 1] ?? '');
  }, [monthKeys, selectedMonthKey]);

  const totalCategorySpend = useMemo(
    () => categories.reduce((sum, row) => sum + Number(row.total), 0),
    [categories],
  );

  const annualTotals = useMemo(() => {
    const income = monthlySummary.reduce((sum, month) => sum + month.income, 0);
    const expenses = monthlySummary.reduce((sum, month) => sum + month.expense, 0);
    return { income, expenses, net: income - expenses };
  }, [monthlySummary]);

  const averageExpense = useMemo(
    () => (monthlySummary.length > 0 ? annualTotals.expenses / monthlySummary.length : 0),
    [annualTotals.expenses, monthlySummary.length],
  );

  const resolvedMonthKey =
    selectedMonthKey && monthKeys.includes(selectedMonthKey)
      ? selectedMonthKey
      : (monthKeys[monthKeys.length - 1] ?? '');
  const selectedIndex = monthKeys.indexOf(resolvedMonthKey);
  const selectedMonth =
    monthlySummary.find(
      (month) => monthKeyFromParts(month.year, month.month) === resolvedMonthKey,
    ) ?? null;

  const topCategories = useMemo(
    () => [...categories].sort((a, b) => b.total - a.total).slice(0, 5),
    [categories],
  );

  const maxCategoryAmount = useMemo(
    () => Math.max(...topCategories.map((c) => c.total), 1),
    [topCategories],
  );

  const heroPrefix = firstName ? `${firstName}, ` : '';
  const heroMessage =
    totalCategorySpend > 0
      ? `${heroPrefix}así se movió tu dinero el último año. La gráfica muestra solo deudas (préstamos y tarjetas), no gastos fijos. Toca un mes para ver si te alcanzó.`
      : `${heroPrefix}aún no hay gastos registrados. Cuando empieces a anotarlos, aquí verás en qué se va tu dinero.`;

  const handleShiftMonth = (delta: number) => {
    setSelectedMonthKey(shiftSelectedMonthKey(monthKeys, resolvedMonthKey, delta));
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-28 rounded-2xl bg-muted/40 border border-border/30" />
        <div className="h-72 rounded-2xl bg-muted/40 border border-border/30" />
        <div className="h-40 rounded-2xl bg-muted/40 border border-border/30" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div
        className={cn(
          'flex flex-col gap-3 rounded-2xl border px-4 py-4 shadow-sm sm:flex-row sm:items-start',
          annualTotals.net >= 0
            ? 'border-emerald-500/25 bg-emerald-500/5 dark:bg-emerald-500/10'
            : 'border-amber-500/25 bg-amber-500/5 dark:bg-amber-500/10',
        )}
        role="region"
        aria-label="Lo que ya pasó"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 ring-1 ring-violet-500/25 text-violet-600 dark:text-violet-400">
          <History className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <h2 className="text-lg font-semibold leading-tight">Lo que ya pasó</h2>
          <p className="text-sm text-muted-foreground">{heroMessage}</p>
        </div>
      </div>

      {categoryError ? (
        <div
          className="rounded-xl border border-l-[3px] border-l-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {categoryError}
        </div>
      ) : null}

      {monthlySummary.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          En 12 meses entró{' '}
          <span className="font-mono font-semibold tabular-nums text-emerald-300">
            {formatCurrency(annualTotals.income)}
          </span>{' '}
          y pagaste{' '}
          <span className="font-mono font-semibold tabular-nums text-violet-300">
            {formatCurrency(annualTotals.expenses)}
          </span>{' '}
          de deudas
          . Toca la gráfica para ver cada mes.
        </p>
      ) : null}

      <MonthlyOverviewChart
        months={monthlySummary}
        selectedMonthKey={resolvedMonthKey}
        onSelectMonth={setSelectedMonthKey}
      />

      <LiquidityPastMonthFocus
        month={selectedMonth}
        averageExpense={averageExpense}
        canPrev={selectedIndex > 0}
        canNext={selectedIndex >= 0 && selectedIndex < monthKeys.length - 1}
        onPrevMonth={() => handleShiftMonth(-1)}
        onNextMonth={() => handleShiftMonth(1)}
      />

      <section className="space-y-3" aria-labelledby="categories-heading">
        <div>
          <h2 id="categories-heading" className="text-base font-semibold leading-tight">
            En qué se va tu dinero
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Las 5 categorías donde más gastaste en los últimos {ROLLING_MONTHS} meses.
          </p>
        </div>
        <Card className="border border-border/60 bg-card shadow-sm">
          <CardContent className="space-y-3 pt-6">
            {topCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay categorías con gasto en este periodo.
              </p>
            ) : (
              topCategories.map((row) => {
                const widthPercent = (row.total / maxCategoryAmount) * 100;
                const label = formatCategoryLabel(row.category, row.categoryIcon);
                return (
                  <div key={row.category} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium">{label}</span>
                      <span className="money-negative shrink-0 font-semibold tabular-nums">
                        {formatCurrency(row.total)}
                      </span>
                    </div>
                    <div
                      className="h-2.5 overflow-hidden rounded-full bg-muted/60"
                      role="presentation"
                    >
                      <div
                        className="h-full rounded-full bg-primary/70 transition-all"
                        style={{ width: `${Math.max(widthPercent, 4)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </section>

      <LiquidityAccountsToday />
    </div>
  );
}
