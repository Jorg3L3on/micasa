'use client';

import Link from 'next/link';
import { BarChart3 } from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import { CategoryLabel } from '@/components/categories/CategoryLabel';
import { Button } from '@/components/ui/button';
import { BUDGET_FREQUENCY_LABELS } from '@/schemas/budget.schema';
import {
  MONTHLY_BUDGET_CATEGORY_ACCENTS,
  type MonthlyBudgetSourceSummary,
} from '@/types/monthly-budget-panel';
import type { DashboardData } from '@/types/dashboard';
import { cn, formatCurrency } from '@/lib/utils';

type DashboardBudgetSummaryCardProps = {
  budgetSummary: DashboardData['budgetSummary'];
  ownerQueryString: string;
};

export default function DashboardBudgetSummaryCard({
  budgetSummary,
  ownerQueryString,
}: DashboardBudgetSummaryCardProps) {
  const {
    totalBudget,
    spent,
    available,
    usedPercent,
    categories,
    sources,
  } = budgetSummary;
  const budgetsHref = `/budgets${ownerQueryString}`;
  const hasBudget = totalBudget > 0 || categories.length > 0;
  const clampedPercent = Math.min(100, Math.max(0, usedPercent));
  const overspent = spent > totalBudget && totalBudget > 0;
  const sourceLabel = getSourceLabel(sources);

  return (
    <section
      className="flex min-h-[320px] flex-col rounded-xl border border-border/60 bg-card p-4 shadow-sm sm:p-5"
      aria-label="Presupuesto del periodo"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 dark:bg-sky-500/15">
            <BarChart3
              className="h-4 w-4 text-sky-600 dark:text-sky-400"
              aria-hidden
            />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold leading-none text-foreground sm:text-base">
              Presupuesto de la quincena
            </h3>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {sourceLabel ?? 'Gasto planeado contra categorías asignadas'}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="h-8 shrink-0 text-xs" asChild>
          <Link href={budgetsHref}>Ver</Link>
        </Button>
      </div>

      {!hasBudget ? (
        <div className="flex flex-1 items-center">
          <EmptyState
            message="No hay presupuestos activos para este periodo."
            description="Crea un presupuesto para verlo reflejado en Inicio."
            action={{
              label: 'Ir a presupuestos',
              href: budgetsHref,
              variant: 'outline',
            }}
          />
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricBlock
              label="Presupuesto"
              amount={totalBudget}
              accent="border-l-sky-500/50"
            />
            <MetricBlock
              label="Usado"
              amount={spent}
              accent={overspent ? 'border-l-destructive/50' : 'border-l-violet-500/50'}
              destructive={overspent}
            />
            <MetricBlock
              label={overspent ? 'Excedido' : 'Disponible'}
              amount={overspent ? spent - totalBudget : available}
              accent={overspent ? 'border-l-destructive/50' : 'border-l-emerald-500/50'}
              destructive={overspent}
              positive={!overspent}
            />
          </div>

          <div>
            <div
              className="h-2.5 overflow-hidden rounded-full bg-muted/50"
              role="progressbar"
              aria-valuenow={clampedPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${usedPercent}% del presupuesto usado`}
            >
              <div
                className={cn(
                  'h-full rounded-full transition-[width] duration-500',
                  overspent
                    ? 'bg-destructive'
                    : 'bg-gradient-to-r from-sky-500 via-violet-500 to-emerald-500',
                )}
                style={{ width: `${clampedPercent}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>{usedPercent}% usado</span>
              <span className="font-mono tabular-nums">
                {formatCurrency(spent)} / {formatCurrency(totalBudget)}
              </span>
            </div>
          </div>

          {categories.length > 0 ? (
            <div className="border-t border-border/60 pt-4">
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Top categorías
              </h4>
              <ul className="mt-3 space-y-3">
                {categories.slice(0, 5).map((category, index) => (
                  <li key={category.id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <CategoryLabel
                        name={category.name}
                        icon={category.icon}
                        className="min-w-0 text-sm"
                        iconClassName="h-4 w-4"
                      />
                      <div className="shrink-0 text-right">
                        <p className="font-mono text-xs font-bold tabular-nums">
                          {formatCurrency(category.spent)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {category.percentOfBudget}%
                        </p>
                      </div>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted/40">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          MONTHLY_BUDGET_CATEGORY_ACCENTS[
                            index % MONTHLY_BUDGET_CATEGORY_ACCENTS.length
                          ],
                        )}
                        style={{
                          width: `${Math.min(100, category.percentOfBudget)}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function MetricBlock({
  label,
  amount,
  accent,
  destructive = false,
  positive = false,
}: {
  label: string;
  amount: number;
  accent: string;
  destructive?: boolean;
  positive?: boolean;
}) {
  return (
    <div className={cn('rounded-lg border border-border/60 border-l-[3px] px-3 py-2', accent)}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          'mt-1 font-mono text-sm font-bold tabular-nums text-foreground',
          destructive && 'text-destructive',
          positive && 'text-emerald-600 dark:text-emerald-400',
        )}
      >
        {formatCurrency(amount)}
      </p>
    </div>
  );
}

function getSourceLabel(sources: MonthlyBudgetSourceSummary[]): string | null {
  if (sources.length === 0) return null;
  if (sources.length === 1) {
    const [source] = sources;
    return `Basado en presupuesto ${BUDGET_FREQUENCY_LABELS[source.frequency].toLowerCase()}`;
  }
  const labels = sources
    .map((source) => BUDGET_FREQUENCY_LABELS[source.frequency].toLowerCase())
    .join(', ');
  return `Incluye presupuestos ${labels}`;
}
