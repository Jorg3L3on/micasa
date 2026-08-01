'use client';

import Link from 'next/link';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CategoryLabel } from '@/components/categories/CategoryLabel';
import { cn, formatCurrency } from '@/lib/utils';
import { getFortnightPeriodPosition } from '@/lib/fortnight-calendar';
import { useMonthlyPanelPreferences } from '@/components/monthly/MonthlyPanelPreferences';
import {
  MONTHLY_BUDGET_CATEGORY_ACCENTS,
  type MonthlyBudgetCategoryRow,
  type MonthlyBudgetPanelResult,
} from '@/types/monthly-budget-panel';

type MonthlyBudgetSidebarProps = {
  panel: MonthlyBudgetPanelResult;
  ownerQuery: string;
  year: number;
  month: number;
  todayYmd: string;
};

export const MonthlyBudgetSidebar = ({
  panel,
  ownerQuery,
  year,
  month,
  todayYmd,
}: MonthlyBudgetSidebarProps) => {
  const { period } = useMonthlyPanelPreferences();
  const scope = period === 'FIRST' ? panel.first : panel.second;
  const { totalBudget, spent, categories } = scope;
  const periodLabel =
    period === 'FIRST' ? 'primera quincena' : 'segunda quincena';
  const rawUsedPercent =
    totalBudget > 0 ? Math.round((spent / totalBudget) * 100) : 0;
  const usedPercent = Math.min(100, Math.max(0, rawUsedPercent));
  const remaining = totalBudget - spent;
  const overspent = remaining < 0;
  const heroAmount = overspent ? Math.abs(remaining) : remaining;
  const heroLabel = overspent ? 'excedido' : 'disponible';
  const budgetStatus = getBudgetStatus({
    year,
    month,
    period,
    todayYmd,
    usedPercent: rawUsedPercent,
    overspent,
  });

  if (totalBudget <= 0 && categories.length === 0) {
    return (
      <aside
        className="rounded-xl border border-border/60 bg-card p-4 shadow-sm"
        aria-label="Presupuesto de la quincena"
      >
        <h2 className="text-sm font-semibold">Presupuesto de la quincena</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          No hay presupuestos activos para la {periodLabel}. Crea uno en
          Presupuestos para ver el resumen aquí.
        </p>
        <Button variant="outline" size="sm" className="mt-4 w-full" asChild>
          <Link href={`/budgets${ownerQuery}`}>Ir a presupuestos</Link>
        </Button>
      </aside>
    );
  }

  return (
    <aside
      className="space-y-5 rounded-xl border border-border/60 bg-card p-4 shadow-sm"
      aria-label="Presupuesto de la quincena y categorías"
    >
      <section aria-labelledby="monthly-budget-heading">
        <h2
          id="monthly-budget-heading"
          className="text-sm font-semibold text-foreground"
        >
          Presupuesto de la quincena
        </h2>
        <div className="mt-3">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p
              className={cn(
                'font-mono text-3xl font-bold tabular-nums tracking-tight text-foreground',
                getAmountToneClassName(budgetStatus.tone),
              )}
            >
              {formatCurrency(heroAmount)}
            </p>
            <span
              className={cn(
                'text-[10px] font-semibold uppercase tracking-wider',
                overspent
                  ? 'text-destructive'
                  : 'text-emerald-600 dark:text-emerald-400',
              )}
            >
              {heroLabel}
            </span>
          </div>
        </div>
        <div
          className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted/50"
          role="progressbar"
          aria-valuenow={usedPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${rawUsedPercent}% del presupuesto usado`}
        >
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-500',
              getProgressClassName(rawUsedPercent, overspent),
            )}
            style={{ width: `${usedPercent}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>
            <span className="font-mono font-semibold tabular-nums text-foreground">
              {formatCurrency(spent)}
            </span>{' '}
            usado de{' '}
            <span className="font-mono font-semibold tabular-nums text-foreground">
              {formatCurrency(totalBudget)}
            </span>
          </span>
          <span className="font-mono font-semibold tabular-nums text-foreground">
            {rawUsedPercent}% usado
          </span>
        </div>
      </section>

      {categories.length > 0 ? (
        <section aria-labelledby="top-categories-heading">
          <h2
            id="top-categories-heading"
            className="text-sm font-semibold text-foreground"
          >
            Top categorías
          </h2>
          <ul className="mt-3 space-y-3">
            {categories.map((cat, index) => (
              <BudgetCategoryRow
                key={cat.id}
                category={cat}
                accent={
                  MONTHLY_BUDGET_CATEGORY_ACCENTS[
                    index % MONTHLY_BUDGET_CATEGORY_ACCENTS.length
                  ]
                }
              />
            ))}
          </ul>
        </section>
      ) : null}

      <Button variant="outline" className="w-full gap-2" asChild>
        <Link
          href={`/budgets${ownerQuery}`}
          aria-label="Ver reporte completo de presupuesto de la quincena"
        >
          <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden />
          Ver reporte completo
        </Link>
      </Button>
    </aside>
  );
};

function BudgetCategoryRow({
  category,
  accent,
}: {
  category: MonthlyBudgetCategoryRow;
  accent: string;
}) {
  const overspent = category.remaining < 0;
  const percent =
    category.budgeted > 0 ? category.percentUsed : category.percentOfBudget;
  const remainingLabel = overspent
    ? `${formatCurrency(Math.abs(category.remaining))} excedido`
    : `${formatCurrency(category.remaining)} restante`;

  return (
    <li className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <CategoryLabel
          name={category.name}
          icon={category.icon}
          className="min-w-0 text-sm"
          iconClassName="h-4 w-4"
        />
        <p className="shrink-0 font-mono text-xs font-bold tabular-nums">
          {formatCurrency(category.spent)}
        </p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted/40">
        <div
          className={cn(
            'h-full rounded-full',
            getCategoryProgressClassName(category.percentUsed, overspent, accent),
          )}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
      <div className="flex justify-between gap-2 text-[10px] text-muted-foreground">
        <span>
          {category.budgeted > 0
            ? `${category.percentUsed}% de su presupuesto`
            : `${category.percentOfBudget}% del total`}
        </span>
        <span
          className={cn(
            'font-mono font-semibold tabular-nums',
            overspent
              ? 'text-destructive'
              : 'text-emerald-600 dark:text-emerald-400',
          )}
        >
          {remainingLabel}
        </span>
      </div>
    </li>
  );
}

type BudgetTone = 'success' | 'warning' | 'destructive' | 'muted';

type BudgetStatus = {
  tone: BudgetTone;
};

function getBudgetStatus({
  year,
  month,
  period,
  todayYmd,
  usedPercent,
  overspent,
}: {
  year: number;
  month: number;
  period: 'FIRST' | 'SECOND';
  todayYmd: string;
  usedPercent: number;
  overspent: boolean;
}): BudgetStatus {
  if (overspent) {
    return { tone: 'destructive' };
  }

  const position = getFortnightPeriodPosition(year, month, period, todayYmd);
  if (position.kind === 'future' || position.kind === 'past') {
    return { tone: 'muted' };
  }

  if (usedPercent >= 90) {
    return { tone: 'destructive' };
  }
  if (usedPercent >= 75 || usedPercent > position.elapsedPercent + 15) {
    return { tone: 'warning' };
  }

  return { tone: 'success' };
}

function getAmountToneClassName(tone: BudgetTone): string {
  if (tone === 'destructive') return 'text-destructive';
  if (tone === 'warning') return 'text-amber-600 dark:text-amber-400';
  if (tone === 'muted') return 'text-foreground';
  return 'text-emerald-600 dark:text-emerald-400';
}

function getProgressClassName(
  usedPercent: number,
  overspent: boolean,
): string {
  if (overspent || usedPercent >= 90) return 'bg-destructive';
  if (usedPercent >= 75) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function getCategoryProgressClassName(
  percentUsed: number,
  overspent: boolean,
  fallback: string,
): string {
  if (overspent || percentUsed >= 100) return 'bg-destructive';
  if (percentUsed >= 85) return 'bg-amber-500';
  return fallback;
}
