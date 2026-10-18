'use client';

import EmptyState from '@/components/EmptyState';
import Link from 'next/link';
import { PiggyBank, SlidersHorizontal } from 'lucide-react';
import { SectionHeader } from '@/components/section-header';
import { Button } from '@/components/ui/button';
import { CategoryLabel } from '@/components/categories/CategoryLabel';
import { FortnightBudgetProgress } from '@/components/monthly/FortnightBudgetProgress';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';
import AssigneeAvatar from '@/components/assignee/AssigneeAvatar';
import { CurrencyTicker } from '@/components/motion/number-ticker';
import { cn, formatCurrency } from '@/lib/utils';
import { useMonthlyPanelPreferences } from '@/components/monthly/MonthlyPanelPreferences';
import {
  MONTHLY_LIQUID_PANEL_CLASS,
  PANEL_INSET_CLASS,
} from '@/components/monthly/monthly-panel-shell';
import { Badge } from '@/components/ui/badge';
import { STATUS_SOFT_CLASS } from '@/lib/status-tone';
import {
  AURA_TONE_HEX,
  getAuraBarStyle,
  getAuraWalletColor,
} from '@/lib/ui/aura-palette';
import type {
  MonthlyBudgetAllocationRow,
  MonthlyBudgetPanelResult,
} from '@/types/monthly-budget-panel';

type MonthlyBudgetSidebarProps = {
  panel: MonthlyBudgetPanelResult;
  ownerQuery: string;
  className?: string;
};

const budgetPanelShellClass = cn(MONTHLY_LIQUID_PANEL_CLASS, 'p-3 sm:p-4');

const usedBadge = (percent: number) =>
  percent > 100
    ? { tone: 'expense' as const }
    : percent >= 85
      ? { tone: 'pending' as const }
      : { tone: 'success' as const };

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
  const allocationsHeadingId = 'budget-allocations-heading';
  const usedPercent =
    totalBudget > 0 ? Math.round((scope.spent / totalBudget) * 100) : 0;
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
                STATUS_SOFT_CLASS[usedBadge(usedPercent).tone],
              )}
            >
              {usedPercent}% usado
            </Badge>
          ) : null
        }
      />

      <FortnightBudgetProgress
        totalBudget={totalBudget}
        spent={scope.spent}
      />

      {allocations.length > 0 ? (
        <section aria-labelledby={allocationsHeadingId}>
          <SectionHeader
            level={3}
            id={allocationsHeadingId}
            className="sr-only"
            title="Asignaciones por categoría y billetera"
          />
          <ul className="space-y-2" role="list">
            {allocations.map((row) => (
              <BudgetAllocationRow
                key={`${row.walletId ?? 'any'}-${row.categoryId}`}
                allocation={row}
              />
            ))}
          </ul>
        </section>
      ) : (
        <EmptyState
          icon={PiggyBank}
          message={`No hay asignaciones de presupuesto en la ${periodLabel}.`}
          className="py-6"
        />
      )}

      <Button variant="outline" size="sm" className="w-full gap-2" asChild>
        <Link
          href={`/settings/budgets${ownerQuery}`}
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
  const brandColor = getAuraWalletColor(
    allocation.walletProviderIconKey,
    undefined,
    'violet',
  );
  const barColor = overspent ? AURA_TONE_HEX.destructive : brandColor;

  return (
    <div
      role="listitem"
      className={cn(PANEL_INSET_CLASS, 'space-y-1.5 px-3 py-2.5')}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <CategoryLabel
            name={allocation.categoryName}
            icon={allocation.categoryIcon}
            className="min-w-0 text-sm"
            iconClassName="h-4 w-4"
          />
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
            {allocation.walletId != null ? (
              <WalletProviderIcon
                providerIconKey={allocation.walletProviderIconKey}
                className="h-4 w-4 border-border/40"
                iconClassName="h-2.5 w-2.5"
                showTooltipLabel={false}
              />
            ) : null}
            <p
              className="truncate text-caption text-muted-foreground"
              title={allocation.walletName}
            >
              {allocation.walletName}
            </p>
            {allocation.walletAssignee ? (
              <AssigneeAvatar
                name={allocation.walletAssignee.name}
                size="sm"
                className="size-5 text-caption"
              />
            ) : null}
          </div>
        </div>
        <CurrencyTicker
          value={allocation.spent}
          className="shrink-0 text-sm font-semibold tabular-nums text-foreground"
        />
      </div>
      <div
        className="h-1.5 rounded-full bg-muted/40"
        role="progressbar"
        aria-valuenow={barPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${allocation.percentUsed}% del presupuesto de ${allocation.categoryName}`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${barPercent}%`, ...getAuraBarStyle(barColor) }}
        />
      </div>
      <div className="flex items-center justify-between gap-2 text-caption text-muted-foreground">
        <span>
          {allocation.budgeted > 0
            ? `${allocation.percentUsed}% de su presupuesto`
            : 'Sin monto asignado'}
        </span>
        <Badge
          variant="outline"
          className={cn(
            'h-5 rounded-full border-transparent px-2 text-caption font-semibold tabular-nums',
            STATUS_SOFT_CLASS[overspent ? 'expense' : 'success'],
          )}
        >
          {remainingLabel}
        </Badge>
      </div>
    </div>
  );
}
