'use client';

import EmptyState from '@/components/EmptyState';
import { PiggyBank } from 'lucide-react';
import { SectionHeader } from '@/components/section-header';
import { cn } from '@/lib/utils';
import { useMonthlyPanelPreferences } from '@/components/monthly/MonthlyPanelPreferences';
import { MONTHLY_LIQUID_PANEL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { FortnightBudgetBreakdown } from '@/components/monthly/FortnightBudgetBreakdown';
import {
  getBudgetUsedPercent,
  getBudgetUsedTone,
} from '@/lib/ui/budget-usage';
import { Badge } from '@/components/ui/badge';
import { STATUS_SOFT_CLASS } from '@/lib/status-tone';
import type { MonthlyBudgetPanelResult } from '@/types/monthly-budget-panel';

type MonthlyBudgetSidebarProps = {
  panel: MonthlyBudgetPanelResult;
  ownerQuery: string;
  className?: string;
};

const budgetPanelShellClass = cn(MONTHLY_LIQUID_PANEL_CLASS, 'p-3 sm:p-4');

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
  const headingId = 'monthly-budget-heading';
  const usedPercent = getBudgetUsedPercent(scope);
  const overspentCount = allocations.filter((row) => row.remaining < 0).length;

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
        subtitle={`${allocations.length} ${allocations.length === 1 ? 'categoría' : 'categorías'}${overspentCount > 0 ? ` · ${overspentCount} ${overspentCount === 1 ? 'excedida' : 'excedidas'}` : ''}`}
        actions={
          totalBudget > 0 ? (
            <Badge
              variant="outline"
              className={cn(
                'h-5 rounded-full border-transparent px-2 text-caption font-semibold',
                STATUS_SOFT_CLASS[getBudgetUsedTone(usedPercent)],
              )}
            >
              {usedPercent}% usado
            </Badge>
          ) : null
        }
      />

      <FortnightBudgetBreakdown
        scope={scope}
        ownerQuery={ownerQuery}
        periodLabel={periodLabel}
        idPrefix="sidebar"
      />
    </aside>
  );
};
