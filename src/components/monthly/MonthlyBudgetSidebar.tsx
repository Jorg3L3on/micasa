'use client';

import Link from 'next/link';
import { BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CategoryLabel } from '@/components/categories/CategoryLabel';
import { cn, formatCurrency } from '@/lib/utils';
import {
  MONTHLY_BUDGET_CATEGORY_ACCENTS,
  type MonthlyBudgetPanelResult,
} from '@/types/monthly-budget-panel';

type MonthlyBudgetSidebarProps = {
  panel: MonthlyBudgetPanelResult;
  ownerQuery: string;
};

export const MonthlyBudgetSidebar = ({
  panel,
  ownerQuery,
}: MonthlyBudgetSidebarProps) => {
  const { totalBudget, spent, available, categories } = panel;
  const usedPercent =
    totalBudget > 0 ? Math.min(100, Math.round((spent / totalBudget) * 100)) : 0;

  if (totalBudget <= 0 && categories.length === 0) {
    return (
      <aside
        className="rounded-xl border border-border/60 bg-card p-4 shadow-sm"
        aria-label="Presupuesto del mes"
      >
        <h2 className="text-sm font-semibold">Presupuesto del mes</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          No hay presupuestos activos para este mes. Crea uno en Presupuestos para ver el resumen aquí.
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
      aria-label="Presupuesto del mes y categorías"
    >
      <section aria-labelledby="monthly-budget-heading">
        <h2
          id="monthly-budget-heading"
          className="text-sm font-semibold text-foreground"
        >
          Presupuesto del mes
        </h2>
        <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-foreground">
          {formatCurrency(totalBudget)}
        </p>
        <div
          className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted/50"
          role="progressbar"
          aria-valuenow={usedPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${usedPercent}% del presupuesto usado`}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary via-violet-500 to-sky-500 transition-[width] duration-500"
            style={{ width: `${usedPercent}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>
            <span className="font-mono font-semibold tabular-nums text-foreground">
              {formatCurrency(spent)}
            </span>{' '}
            usado
          </span>
          <span>
            <span className="font-mono font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatCurrency(available)}
            </span>{' '}
            disponible
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
              <li key={cat.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <CategoryLabel
                    name={cat.name}
                    icon={cat.icon}
                    className="min-w-0 text-sm"
                    iconClassName="h-4 w-4"
                  />
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-xs font-bold tabular-nums">
                      {formatCurrency(cat.spent)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {cat.percentOfBudget}%
                    </p>
                  </div>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-muted/40">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      MONTHLY_BUDGET_CATEGORY_ACCENTS[
                        index % MONTHLY_BUDGET_CATEGORY_ACCENTS.length
                      ],
                    )}
                    style={{
                      width: `${Math.min(100, cat.percentOfBudget)}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Button variant="outline" className="w-full gap-2" asChild>
        <Link href={`/budgets${ownerQuery}`} aria-label="Ver reporte completo de presupuestos">
          <BarChart3 className="h-4 w-4 shrink-0" aria-hidden />
          Ver reporte completo
        </Link>
      </Button>
    </aside>
  );
};
