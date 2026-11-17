'use client';

import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { PiggyBank, RotateCcw, SlidersHorizontal } from 'lucide-react';
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
import {
  BudgetAdjustButton,
  canAdjustQuincena,
  type BudgetAdjustTarget,
} from '@/components/monthly/BudgetAdjustButton';
import { clearBudgetQuincenaAdjustment } from '@/lib/api/budgets';
import { useFinanceContext } from '@/context/finance-context';

/** True when a one-quincena adjustment (MIC-I19) changes this quincena. */
export const scopeIsAdjusted = (scope: MonthlyBudgetScope): boolean =>
  (scope.budgets ?? []).some((b) => b.adjustment != null);

type FortnightBudgetBreakdownProps = {
  scope: MonthlyBudgetScope;
  ownerQuery: string;
  /** "primera quincena" / "segunda quincena", for the empty copy. */
  periodLabel: string;
  /** Keeps heading ids unique when the sidebar and the desglose both render. */
  idPrefix: string;
  /** Quincena shown and the refresh to run after an adjustment (MIC-I19). */
  adjust?: BudgetAdjustTarget | null;
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
  adjust = null,
}: FortnightBudgetBreakdownProps) => {
  const allocationsHeadingId = `${idPrefix}-budget-allocations-heading`;
  const { allocations } = scope;
  const { context } = useFinanceContext();
  const [restoring, setRestoring] = useState(false);
  const adjustedBudgets = (scope.budgets ?? []).filter((b) => b.adjustment != null);
  const canRestore =
    adjust != null && adjustedBudgets.length > 0 && canAdjustQuincena(adjust.quincena);
  const templateTotal = adjustedBudgets.reduce((sum, b) => sum + b.templateTotal, 0);

  const restoreTemplate = async () => {
    if (!adjust) return;
    setRestoring(true);
    try {
      await Promise.all(
        adjustedBudgets.map((b) =>
          clearBudgetQuincenaAdjustment(b.budgetId, adjust.quincena, context),
        ),
      );
      await adjust.onSaved();
      toast.success('Plantilla restaurada para esta quincena');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo restaurar la plantilla');
    } finally {
      setRestoring(false);
    }
  };

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

      {canRestore ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-11 w-full gap-2 sm:h-8"
          onClick={() => void restoreTemplate()}
          disabled={restoring}
        >
          <RotateCcw className="h-4 w-4 shrink-0" aria-hidden />
          {restoring
            ? 'Restaurando…'
            : adjustedBudgets.length === 1
              ? `Restaurar plantilla (${formatCurrency(templateTotal)})`
              : 'Restaurar plantilla'}
        </Button>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <BudgetAdjustButton
          scope={scope}
          target={adjust}
          ownerQuery={ownerQuery}
          className="w-full sm:flex-1"
        />
        <Button variant="outline" size="sm" className="h-11 w-full gap-2 sm:h-8 sm:flex-1" asChild>
          <Link
            href={`/settings/budgets${ownerQuery}`}
            aria-label="Ver reporte completo de presupuesto de la quincena"
          >
            <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden />
            Ver reporte completo
          </Link>
        </Button>
      </div>
    </>
  );
};

type FortnightBudgetDesgloseSectionProps = {
  scope: MonthlyBudgetScope;
  ownerQuery: string;
  periodLabel: string;
  adjust?: BudgetAdjustTarget | null;
};

/** Budget block inside Ver desglose, for widths where the card is hidden. */
export const FortnightBudgetDesgloseSection = ({
  scope,
  ownerQuery,
  periodLabel,
  adjust = null,
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
        subtitle={scopeIsAdjusted(scope) ? 'Ajustado solo esta quincena' : undefined}
        actions={
          <BudgetHeaderActions scope={scope} usedPercent={usedPercent} />
        }
      />
      <FortnightBudgetBreakdown
        scope={scope}
        ownerQuery={ownerQuery}
        periodLabel={periodLabel}
        idPrefix="desglose"
        adjust={adjust}
      />
    </section>
  );
};

/** Usage badge for the budget header (card and desglose). */
export function BudgetHeaderActions({
  scope,
  usedPercent,
}: {
  scope: MonthlyBudgetScope;
  usedPercent: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {scope.totalBudget > 0 ? (
        <Badge
          variant="outline"
          className={cn(
            'h-5 rounded-full border-transparent px-2 text-caption font-semibold',
            STATUS_SOFT_CLASS[getBudgetUsedTone(usedPercent)],
          )}
        >
          {usedPercent}% usado
        </Badge>
      ) : null}
    </div>
  );
}

function BudgetAllocationRow({
  allocation,
}: {
  allocation: MonthlyBudgetAllocationRow;
}) {
  const adjusted =
    Math.round(allocation.templateBudgeted * 100) !== Math.round(allocation.budgeted * 100);
  const paused = adjusted && allocation.budgeted <= 0;
  const overspent = !paused && allocation.remaining < 0;
  const outsideBudget = paused && allocation.spent > 0;
  const barPercent = paused
    ? 0
    : Math.min(100, Math.max(0, allocation.percentUsed));
  const remainingLabel = outsideBudget
    ? `${formatCurrency(allocation.spent)} fuera de presupuesto`
    : paused
      ? 'Pausado esta quincena'
      : overspent
        ? `${formatCurrency(Math.abs(allocation.remaining))} excedido`
        : `${formatCurrency(allocation.remaining)} restante`;
  const remainingTone = outsideBudget
    ? 'pending'
    : paused
      ? 'info'
      : overspent
        ? 'expense'
        : 'success';
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
      {adjusted ? (
        <p className="text-caption text-muted-foreground">
          Plantilla{' '}
          <s className="tabular-nums">{formatCurrency(allocation.templateBudgeted)}</s>
          {' → '}
          <span className="tabular-nums text-foreground">
            {formatCurrency(allocation.budgeted)}
          </span>{' '}
          esta quincena
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2 text-caption text-muted-foreground">
        <span>
          {paused
            ? 'Pausado'
            : allocation.budgeted > 0
              ? `${allocation.percentUsed}% de su presupuesto`
              : 'Sin monto asignado'}
        </span>
        <Badge
          variant="outline"
          className={cn(
            'h-5 rounded-full border-transparent px-2 text-caption font-semibold tabular-nums',
            STATUS_SOFT_CLASS[remainingTone],
          )}
        >
          {remainingLabel}
        </Badge>
      </div>
    </div>
  );
}
