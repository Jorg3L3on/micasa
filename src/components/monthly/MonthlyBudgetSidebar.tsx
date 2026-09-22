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
import { METRIC_STRIP_CLASS } from '@/components/ui/metric-strip';
import type {
  MonthlyBudgetAllocationRow,
  MonthlyBudgetPanelResult,
} from '@/types/monthly-budget-panel';

type MonthlyBudgetSidebarProps = {
  panel: MonthlyBudgetPanelResult;
  ownerQuery: string;
  className?: string;
  /** `embedded` nests inside the resumen desglose (no extra glass shell). */
  variant?: 'panel' | 'embedded';
};

const budgetPanelShellClass = cn(MONTHLY_PANEL_SHELL_CLASS, 'p-4');
const budgetEmbeddedShellClass = cn(
  METRIC_STRIP_CLASS,
  'border-l-[3px] border-l-violet-500/50 px-3 py-3',
);

const BudgetSidebarHeader = ({
  headingId,
  subtitle,
  headingAs = 'h2',
}: {
  headingId?: string;
  subtitle: string;
  headingAs?: 'h2' | 'h3';
}) => {
  const Heading = headingAs;
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <span className={MONTHLY_ICON_PILL_CLASS} aria-hidden>
        <PiggyBank className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <Heading
          id={headingId}
          className="text-sm font-semibold leading-none text-foreground"
        >
          Presupuesto de la quincena
        </Heading>
        <p className="mt-1 text-[10px] text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
};

export const MonthlyBudgetSidebar = ({
  panel,
  ownerQuery,
  className,
  variant = 'panel',
}: MonthlyBudgetSidebarProps) => {
  const { period } = useMonthlyPanelPreferences();
  const scope = period === 'FIRST' ? panel.first : panel.second;
  const { totalBudget, allocations } = scope;
  const periodLabel =
    period === 'FIRST' ? 'primera quincena' : 'segunda quincena';
  const isEmbedded = variant === 'embedded';
  const headingAs = isEmbedded ? 'h3' : 'h2';
  const headingId = isEmbedded
    ? 'monthly-budget-heading-embedded'
    : 'monthly-budget-heading';
  const allocationsHeadingId = isEmbedded
    ? 'budget-allocations-heading-embedded'
    : 'budget-allocations-heading';
  const shellClass = isEmbedded ? budgetEmbeddedShellClass : budgetPanelShellClass;
  const Frame = isEmbedded ? 'section' : 'aside';

  if (totalBudget <= 0 && allocations.length === 0) {
    return (
      <Frame
        className={cn(shellClass, className)}
        aria-label="Presupuesto de la quincena"
      >
        <BudgetSidebarHeader
          headingAs={headingAs}
          subtitle={`Sin presupuesto activo en la ${periodLabel}`}
        />
        <p className="mt-3 text-sm text-muted-foreground">
          No hay presupuestos activos para la {periodLabel}. Crea uno en
          Presupuestos para ver el resumen aquí.
        </p>
        <Button variant="outline" size="sm" className="mt-4 w-full" asChild>
          <Link href={`/budgets${ownerQuery}`}>Ir a presupuestos</Link>
        </Button>
      </Frame>
    );
  }

  return (
    <Frame
      className={cn(shellClass, 'space-y-5', className)}
      aria-label="Presupuesto de la quincena y asignaciones"
    >
      <BudgetSidebarHeader
        headingId={headingId}
        headingAs={headingAs}
        subtitle="Categorías y billeteras asignadas"
      />

      <FortnightBudgetProgress
        totalBudget={totalBudget}
        spent={scope.spent}
      />

      {allocations.length > 0 ? (
        <section aria-labelledby={allocationsHeadingId}>
          <h3 id={allocationsHeadingId} className="sr-only">
            Asignaciones por categoría y billetera
          </h3>
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
    </Frame>
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
              : 'text-emerald-600 dark:text-emerald-300',
          )}
        >
          {remainingLabel}
        </span>
      </div>
    </li>
  );
}
