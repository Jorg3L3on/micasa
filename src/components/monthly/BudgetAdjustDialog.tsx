'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ResponsiveOverlay } from '@/components/overlay/responsive-overlay';
import {
  AmountRow,
  GroupedRow,
  OVERLAY_GROUPED_CARD_CLASS,
  OVERLAY_PRIMARY_BUTTON_CLASS,
  OVERLAY_ROW_TRIGGER_CLASS,
  OVERLAY_SECONDARY_BUTTON_CLASS,
  OverlayErrorBanner,
  OverlayHint,
  OverlayWarning,
} from '@/components/overlay/overlay-form';
import { useFinanceContext } from '@/context/finance-context';
import {
  clearBudgetQuincenaAdjustment,
  setBudgetQuincenaAdjustment,
  type BudgetQuincenaRef,
} from '@/lib/api/budgets';
import { formatMonthInPhrase } from '@/lib/calendar-dates';
import {
  remainingReserve,
  splitTotalAcrossAllocations,
} from '@/lib/finance/budget-fortnight-effective';
import { cn, formatCurrency } from '@/lib/utils';
import type { MonthlyBudgetItem } from '@/types/monthly-budget-panel';

const round2 = (value: number) => Math.round(value * 100) / 100;

export const quincenaPhrase = (ref: BudgetQuincenaRef): string =>
  `${ref.period === 'FIRST' ? '1ª' : '2ª'} quincena de ${formatMonthInPhrase(ref.month, ref.year)}`;

/** What the budget would still reserve with `total` split like the template. */
const reserveWith = (budget: MonthlyBudgetItem, total: number): number => {
  const parts = splitTotalAcrossAllocations(
    total,
    budget.categories.map((c) => c.templateBudgeted),
  );
  return budget.categories.length > 0
    ? remainingReserve(budget.categories.map((c, i) => ({ budgeted: parts[i] ?? 0, spent: c.spent })))
    : Math.max(0, total);
};

type BudgetAdjustDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budgets: MonthlyBudgetItem[];
  quincena: BudgetQuincenaRef;
  /** Budget to open on; defaults to the first one. */
  initialBudgetId?: number | null;
  onSaved: () => Promise<void> | void;
  ownerQuery: string;
};

/**
 * "Ajustar esta quincena" (MIC-I19): pause or change one budget's total for
 * the viewed quincena only. The template and other quincenas do not change.
 */
export const BudgetAdjustDialog = ({
  open,
  onOpenChange,
  budgets,
  quincena,
  initialBudgetId = null,
  onSaved,
  ownerQuery,
}: BudgetAdjustDialogProps) => {
  const { context } = useFinanceContext();
  const [budgetId, setBudgetId] = useState<number | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const budget = useMemo(
    () => budgets.find((b) => b.budgetId === budgetId) ?? budgets[0] ?? null,
    [budgets, budgetId],
  );

  // Opening: pick the budget and start from its current amount (the template
  // unless already adjusted).
  useEffect(() => {
    if (!open) return;
    const start = budgets.find((b) => b.budgetId === initialBudgetId) ?? budgets[0] ?? null;
    setBudgetId(start?.budgetId ?? null);
    setAmount(round2(start?.total ?? 0));
    setError(null);
  }, [open, budgets, initialBudgetId]);

  if (!budget) return null;

  const template = round2(budget.templateTotal);
  const draft = round2(Math.max(0, Number.isFinite(amount) ? amount : 0));
  const isAdjusted = budget.adjustment != null;
  const backToTemplate = draft === template;
  const unchanged = isAdjusted ? draft === round2(budget.total) : backToTemplate;
  const delta = round2(budget.remaining - reserveWith(budget, draft));
  const belowSpent = budget.spent > 0 && draft < round2(budget.spent);
  const phrase = quincenaPhrase(quincena);

  const pickBudget = (value: string) => {
    const next = budgets.find((b) => String(b.budgetId) === value);
    if (!next) return;
    setBudgetId(next.budgetId);
    setAmount(round2(next.total));
    setError(null);
  };

  const run = async (action: () => Promise<unknown>, message: string) => {
    setSubmitting(true);
    setError(null);
    try {
      await action();
      await onSaved();
      toast.success(message);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el ajuste');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (unchanged) return;
    if (backToTemplate) {
      void run(
        () => clearBudgetQuincenaAdjustment(budget.budgetId, quincena, context),
        `${budget.name} vuelve a la plantilla en la ${phrase}`,
      );
      return;
    }
    void run(
      () => setBudgetQuincenaAdjustment(budget.budgetId, quincena, draft, context),
      draft === 0
        ? `${budget.name} pausado en la ${phrase}`
        : `${budget.name}: ${formatCurrency(draft)} en la ${phrase}`,
    );
  };

  const shortcuts = [
    { label: 'Pausar · $0', value: 0 },
    { label: 'Mitad', value: round2(template / 2) },
    { label: 'Plantilla', value: template },
  ];

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      title="Ajustar esta quincena"
      description="Cambia el presupuesto solo para esta quincena. La plantilla y las demás quincenas no cambian."
      busy={submitting}
    >
      {({ handleSelectOpenChange }) => (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <OverlayHint role="status">
            Aplica a: {phrase}. La plantilla no cambia.
          </OverlayHint>

          {error ? <OverlayErrorBanner>{error}</OverlayErrorBanner> : null}

          <div className={OVERLAY_GROUPED_CARD_CLASS}>
            {budgets.length > 1 ? (
              <GroupedRow label="Presupuesto" htmlFor="budget-adjust-budget" labelWidth="wide">
                <Select
                  value={String(budget.budgetId)}
                  onValueChange={pickBudget}
                  onOpenChange={handleSelectOpenChange}
                  disabled={submitting}
                >
                  <SelectTrigger id="budget-adjust-budget" className={OVERLAY_ROW_TRIGGER_CLASS}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {budgets.map((b) => (
                      <SelectItem key={b.budgetId} value={String(b.budgetId)}>
                        {b.name}
                        {b.adjustment ? ' · ajustado' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </GroupedRow>
            ) : (
              <GroupedRow label="Presupuesto" labelWidth="wide">
                <span className="block truncate text-sm text-foreground">{budget.name}</span>
              </GroupedRow>
            )}
            <AmountRow
              id="budget-adjust-amount"
              label="Monto para esta quincena"
              value={amount}
              onChange={(value) => setAmount(value)}
              disabled={submitting}
              enterKeyHint="done"
              grouped
            />
            <div
              className="flex flex-wrap gap-2 px-3 py-2"
              role="group"
              aria-label="Montos rápidos"
            >
              {shortcuts.map((shortcut) => (
                <Button
                  key={shortcut.label}
                  type="button"
                  variant="outline"
                  aria-pressed={draft === shortcut.value}
                  disabled={submitting}
                  onClick={() => setAmount(shortcut.value)}
                  className={cn(
                    'h-11 rounded-full px-4 text-sm sm:h-8',
                    draft === shortcut.value && 'border-primary bg-primary/15',
                  )}
                >
                  {shortcut.label}
                </Button>
              ))}
            </div>
          </div>

          <OverlayHint>
            Plantilla: {formatCurrency(template)}
            {budget.categories.length > 1 ? ', repartido entre sus categorías en la misma proporción' : ''}.
            {' '}Lo ya gastado ({formatCurrency(budget.spent)}) sigue contando en Pagado.
          </OverlayHint>

          {belowSpent ? (
            <OverlayWarning>
              Ya gastaste {formatCurrency(budget.spent)} en {budget.name} esta quincena. Con{' '}
              {formatCurrency(draft)}, el restante queda en $0 y{' '}
              {draft === 0
                ? 'lo gastado se marca fuera de presupuesto.'
                : `se marca excedido por ${formatCurrency(round2(budget.spent - draft))}.`}
            </OverlayWarning>
          ) : null}

          {!unchanged && delta !== 0 ? (
            <OverlayHint role="status" className="text-foreground">
              Liquidez actual y lo que queda tras pagar:{' '}
              <span
                className={cn(
                  'font-semibold tabular-nums',
                  delta > 0 ? 'text-status-income' : 'text-status-expense',
                )}
              >
                {delta > 0 ? '+' : '−'}
                {formatCurrency(Math.abs(delta))}
              </span>
            </OverlayHint>
          ) : null}

          <Button
            type="submit"
            className={OVERLAY_PRIMARY_BUTTON_CLASS}
            disabled={submitting || unchanged}
          >
            {submitting
              ? 'Guardando…'
              : backToTemplate && isAdjusted
                ? 'Restaurar plantilla'
                : 'Guardar ajuste'}
          </Button>
          {isAdjusted && !backToTemplate ? (
            <Button
              type="button"
              variant="ghost"
              className={OVERLAY_SECONDARY_BUTTON_CLASS}
              disabled={submitting}
              onClick={() =>
                void run(
                  () => clearBudgetQuincenaAdjustment(budget.budgetId, quincena, context),
                  `${budget.name} vuelve a la plantilla en la ${phrase}`,
                )
              }
            >
              Restaurar plantilla ({formatCurrency(template)})
            </Button>
          ) : null}
          <Button
            asChild
            type="button"
            variant="ghost"
            className={cn(OVERLAY_SECONDARY_BUTTON_CLASS, 'text-muted-foreground')}
          >
            <Link href={`/settings/budgets${ownerQuery}`}>
              Cambiar la plantilla para todas las quincenas
            </Link>
          </Button>
        </form>
      )}
    </ResponsiveOverlay>
  );
};
