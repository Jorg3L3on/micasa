'use client';

import Link from 'next/link';
import { PiggyBank, SlidersHorizontal } from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import { SectionHeader } from '@/components/section-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CategoryLabel } from '@/components/categories/CategoryLabel';
import { FortnightBudgetProgress } from '@/components/monthly/FortnightBudgetProgress';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';
import AssigneeAvatar from '@/components/assignee/AssigneeAvatar';
import { CurrencyTicker } from '@/components/motion/number-ticker';
import { cn, formatCurrency } from '@/lib/utils';
import { PANEL_INSET_CLASS } from '@/components/monthly/monthly-panel-shell';
import { STATUS_SOFT_CLASS } from '@/lib/status-tone';
import {
  getBudgetUsedPercent,
  getBudgetUsedTone,
} from '@/lib/ui/budget-usage';
import {
  AURA_TONE_HEX,
  getAuraBarStyle,
  getAuraWalletColor,
} from '@/lib/ui/aura-palette';
import type {
  MonthlyBudgetAllocationRow,
  MonthlyBudgetScope,
} from '@/types/monthly-budget-panel';

type FortnightBudgetBreakdownProps = {
  scope: MonthlyBudgetScope;
  ownerQuery: string;
  /** "primera quincena" / "segunda quincena", for the empty copy. */
  periodLabel: string;
  /** Keeps heading ids unique when the sidebar and the desglose both render. */
  idPrefix: string;
};

/**
 * Usado / total progress, one row per allocation and the report link. Shared
 * by the Presupuesto card (xl and up) and the Ver desglose section (below xl)
 * so the two cannot drift.
 */
export const FortnightBudgetBreakdown = ({
  scope,
  ownerQuery,
  periodLabel,
  idPrefix,
}: FortnightBudgetBreakdownProps) => {
  const allocationsHeadingId = `${idPrefix}-budget-allocations-heading`;
  const { allocations } = scope;

  return (
    <>
      <FortnightBudgetProgress
        totalBudget={scope.totalBudget}
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
    </>
  );
};

type FortnightBudgetDesgloseSectionProps = {
  scope: MonthlyBudgetScope;
  ownerQuery: string;
  periodLabel: string;
};

/** Budget block inside Ver desglose, for widths where the card is hidden. */
export const FortnightBudgetDesgloseSection = ({
  scope,
  ownerQuery,
  periodLabel,
}: FortnightBudgetDesgloseSectionProps) => {
  const headingId = 'desglose-budget-heading';
  const usedPercent = getBudgetUsedPercent(scope);

  if (scope.totalBudget <= 0 && scope.allocations.length === 0) {
    return (
      <p className="text-caption leading-snug text-muted-foreground">
        Sin presupuesto en la {periodLabel}.{' '}
        <Link
          href={`/settings/budgets${ownerQuery}`}
          className="font-medium text-primary-text underline-offset-2 hover:underline"
        >
          Ir a presupuestos
        </Link>
      </p>
    );
  }

  return (
    <section
      aria-labelledby={headingId}
      className={cn(PANEL_INSET_CLASS, 'space-y-3 px-3 py-2.5')}
    >
      <SectionHeader
        level={3}
        id={headingId}
        icon={PiggyBank}
        title="Presupuesto de la quincena"
        actions={
          scope.totalBudget > 0 ? (
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
        idPrefix="desglose"
      />
    </section>
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
