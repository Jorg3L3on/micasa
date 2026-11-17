'use client';

import EmptyState from '@/components/EmptyState';
import { PiggyBank } from 'lucide-react';
import { SectionHeader } from '@/components/section-header';
import { cn } from '@/lib/utils';
import { useMonthlyPanelPreferences } from '@/components/monthly/MonthlyPanelPreferences';
import { MONTHLY_LIQUID_PANEL_CLASS } from '@/components/monthly/monthly-panel-shell';
import {
  BudgetHeaderActions,
  FortnightBudgetBreakdown,
} from '@/components/monthly/FortnightBudgetBreakdown';
import type { BudgetAdjustTarget } from '@/components/monthly/BudgetAdjustButton';
import { getBudgetUsedPercent } from '@/lib/ui/budget-usage';
import type { MonthlyBudgetPanelResult } from '@/types/monthly-budget-panel';

type MonthlyBudgetSidebarProps = {
  panel: MonthlyBudgetPanelResult;
  ownerQuery: string;
  className?: string;
  /** Viewed quincena and refresh after an adjustment (MIC-I19). */
  adjust?: BudgetAdjustTarget | null;
};

const budgetPanelShellClass = cn(MONTHLY_LIQUID_PANEL_CLASS, 'p-3 sm:p-4');

export const MonthlyBudgetSidebar = ({
  panel,
  ownerQuery,
  className,
  adjust = null,
}: MonthlyBudgetSidebarProps) => {
  const { period } = useMonthlyPanelPreferences();
  const scope = period === 'FIRST' ? panel.first : panel.second;
  const { totalBudget, allocations } = scope;
  const periodLabel =
    period === 'FIRST' ? 'primera quincena' : 'segunda quincena';
  const headingId = 'monthly-budget-heading';
  const usedPercent = getBudgetUsedPercent(scope);
  const overspentCount = allocations.filter(
    (row) => row.remaining < 0 && row.budgeted > 0,
  ).length;
  const adjustedCount = allocations.filter(
    (row) => Math.round(row.templateBudgeted * 100) !== Math.round(row.budgeted * 100),
  ).length;

  if (totalBudget <= 0 && allocations.length === 0) {
    return (
      <aside
        className={cn(budgetPanelShellClass, 'space-y-3 sm:space-y-4', className)}
        aria-label="Presupuesto de la quincena"
      >
        <SectionHeader
          icon={PiggyBank}
          title="Presupuesto de la quincena"
          subtitle={`Sin presupuesto activo en la ${periodLabel}`}
        />
        <EmptyState
          icon={PiggyBank}
          message="Sin presupuesto esta quincena"
          description="Crea uno en Presupuestos para ver aquí lo gastado."
          className="py-8"
          action={{
            label: 'Ir a presupuestos',
            href: `/settings/budgets${ownerQuery}`,
            variant: 'outline',
          }}
        />
      </aside>
    );
  }

  return (
    <aside
      className={cn(budgetPanelShellClass, 'space-y-3 sm:space-y-4', className)}
      aria-label="Presupuesto de la quincena y asignaciones"
    >
      <SectionHeader
        id={headingId}
        icon={PiggyBank}
        title="Presupuesto de la quincena"
        subtitle={`${allocations.length} ${allocations.length === 1 ? 'categoría' : 'categorías'}${adjustedCount > 0 ? ` · ${adjustedCount} ${adjustedCount === 1 ? 'ajustada' : 'ajustadas'}` : ''}${overspentCount > 0 ? ` · ${overspentCount} ${overspentCount === 1 ? 'excedida' : 'excedidas'}` : ''}`}
        actions={
          <BudgetHeaderActions scope={scope} usedPercent={usedPercent} />
        }
      />

      <FortnightBudgetBreakdown
        scope={scope}
        ownerQuery={ownerQuery}
        periodLabel={periodLabel}
        idPrefix="sidebar"
        adjust={adjust}
      />
    </aside>
  );
};
