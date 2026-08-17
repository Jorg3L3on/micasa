'use client';

import Link from 'next/link';
import { PiggyBank, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CategoryLabel } from '@/components/categories/CategoryLabel';
import { FortnightBudgetProgress } from '@/components/monthly/FortnightBudgetProgress';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';
import AssigneeAvatar from '@/components/assignee/AssigneeAvatar';
import { cn, formatCurrency } from '@/lib/utils';
import { useMonthlyPanelPreferences } from '@/components/monthly/MonthlyPanelPreferences';
import {
  MONTHLY_ICON_PILL_CLASS,
  MONTHLY_PANEL_SHELL_CLASS,
} from '@/components/monthly/monthly-panel-shell';
import type {
  MonthlyBudgetAllocationRow,
  MonthlyBudgetPanelResult,
} from '@/types/monthly-budget-panel';

type MonthlyBudgetSidebarProps = {
  panel: MonthlyBudgetPanelResult;
  ownerQuery: string;
  className?: string;
};

const budgetShellClass = cn(MONTHLY_PANEL_SHELL_CLASS, 'p-4');

const BudgetSidebarHeader = ({
  headingId,
  subtitle,
}: {
  headingId?: string;
  subtitle: string;
}) => (
  <div className="flex min-w-0 items-start gap-2.5">
    <span
      className={MONTHLY_ICON_PILL_CLASS}
      aria-hidden
    >
      <PiggyBank className="h-4 w-4 text-primary" />
    </span>
    <div className="min-w-0">
      <h2
        id={headingId}
        className="text-sm font-semibold leading-none text-foreground"
      >
        Presupuesto de la quincena
      </h2>
      <p className="mt-1 text-[10px] text-muted-foreground">{subtitle}</p>
    </div>
  </div>
);

export const MonthlyBudgetSidebar = ({
  panel,
  ownerQuery,
  className,
}: MonthlyBudgetSidebarProps) => {
  const { period } = useMonthlyPanelPreferences();
  const scope = period === 'FIRST' ? panel.first : panel.second;
  const { totalBudget, allocations } = scope;
  const periodLabel =
    period === 'FIRST' ? 'primera quincena' : 'segunda quincena';

  if (totalBudget <= 0 && allocations.length === 0) {
    return (
      <aside
        className={cn(budgetShellClass, className)}
        aria-label="Presupuesto de la quincena"
      >
        <BudgetSidebarHeader
          subtitle={`Sin presupuesto activo en la ${periodLabel}`}
        />
        <p className="mt-3 text-sm text-muted-foreground">
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
      className={cn(budgetShellClass, 'space-y-5', className)}
      aria-label="Presupuesto de la quincena y asignaciones"
    >
      <BudgetSidebarHeader
        headingId="monthly-budget-heading"
        subtitle="Categorías y billeteras asignadas"
      />

      <FortnightBudgetProgress
        totalBudget={totalBudget}
        spent={scope.spent}
      />

      {allocations.length > 0 ? (
        <section aria-labelledby="budget-allocations-heading">
          <h2 id="budget-allocations-heading" className="sr-only">
            Asignaciones por categoría y billetera
          </h2>
          <ul className="space-y-2.5" role="list">
            {allocations.map((row) => (
              <BudgetAllocationRow
                key={`${row.walletId}-${row.categoryId}`}
                allocation={row}
              />
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">
          No hay asignaciones de presupuesto en la {periodLabel}.
        </p>
      )}

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

function BudgetAllocationRow({
  allocation,
}: {
  allocation: MonthlyBudgetAllocationRow;
}) {
  const overspent = allocation.remaining < 0;
  const barPercent = Math.min(100, Math.max(0, allocation.percentUsed));
  const remainingLabel = overspent
    ? `${formatCurrency(Math.abs(allocation.remaining))} excedido`
    : `${formatCurrency(allocation.remaining)} restante`;

  return (
    <li className="space-y-1.5 rounded-lg border border-border/40 bg-card/40 px-2.5 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <CategoryLabel
            name={allocation.categoryName}
            icon={allocation.categoryIcon}
            className="min-w-0 text-sm"
            iconClassName="h-4 w-4"
          />
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
            <WalletProviderIcon
              providerIconKey={allocation.walletProviderIconKey}
              className="h-4 w-4 border-border/40"
              iconClassName="h-2.5 w-2.5"
              showTooltipLabel={false}
            />
            <p className="truncate text-[10px] text-muted-foreground">
              {allocation.walletName}
            </p>
            {allocation.walletAssignee ? (
              <AssigneeAvatar
                name={allocation.walletAssignee.name}
                size="sm"
                className="size-4 text-[8px]"
              />
            ) : null}
          </div>
        </div>
        <p className="shrink-0 font-mono text-xs font-bold tabular-nums text-foreground">
          {formatCurrency(allocation.spent)}
        </p>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted/40"
        role="progressbar"
        aria-valuenow={barPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${allocation.percentUsed}% del presupuesto de ${allocation.categoryName}`}
      >
        <div
          className="h-full rounded-full bg-violet-500 dark:bg-violet-400"
          style={{ width: `${barPercent}%` }}
        />
      </div>
      <div className="flex justify-between gap-2 text-[10px] text-muted-foreground">
        <span>
          {allocation.budgeted > 0
            ? `${allocation.percentUsed}% de su presupuesto`
            : 'Sin monto asignado'}
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
