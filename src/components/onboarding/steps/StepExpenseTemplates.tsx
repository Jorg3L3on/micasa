'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Receipt } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import EmptyState from '@/components/EmptyState';
import { ErrorBanner } from '@/components/error-banner';
import { OverlayHint } from '@/components/overlay/overlay-form';
import { PANEL_INSET_CLASS } from '@/components/monthly/monthly-panel-shell';
import {
  useOnboarding,
  type ExpenseTemplateDraft,
} from '@/components/onboarding/OnboardingContext';
import { OnboardingChip } from '@/components/onboarding/OnboardingChip';
import { ExpenseRow } from '@/components/onboarding/steps/ExpenseRow';
import {
  EXPENSE_PRESETS,
  expenseForPreset,
  expenseRowHint,
  type ExpensePreset,
} from '@/components/onboarding/steps/expense-rows';
import { createClientId } from '@/lib/polyfills';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import { isSelectableInPicker } from '@/lib/finance/category-hierarchy';
import type { CategoryOption } from '@/types/catalog';
import { cn } from '@/lib/utils';

export const expensesAreValid = (expenses: ExpenseTemplateDraft[]): boolean =>
  expenses.every(
    (expense) =>
      expense.name.trim() !== '' &&
      Number.isFinite(expense.amount) &&
      expense.amount > 0 &&
      expense.categoryId !== '' &&
      expense.walletId !== '',
  );

export default function StepExpenseTemplates() {
  const {
    setCanProceed,
    expenseTemplates,
    setExpenseTemplates,
    wallets,
    defaultWalletId,
  } = useOnboarding();
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  // `n` changes on every request, so tapping the same pressed chip refocuses.
  const [focusRequest, setFocusRequest] = useState<{ id: string; n: number } | null>(null);

  // Bring the row into view and put the cursor on its amount.
  useEffect(() => {
    if (!focusRequest) return;
    const input = document.getElementById(`expense-amount-${focusRequest.id}`);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    input?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    input?.focus({ preventScroll: true });
  }, [focusRequest]);

  const requestFocus = (id: string) =>
    setFocusRequest((prev) => ({ id, n: (prev?.n ?? 0) + 1 }));

  const loadCategories = useCallback(async (signal?: { cancelled: boolean }) => {
    setCategoriesLoading(true);
    setCategoriesError(null);
    try {
      const data = await clientFetchFromApi<CategoryOption[]>('/api/categories');
      if (!signal?.cancelled) setCategories(data);
    } catch {
      if (!signal?.cancelled) {
        setCategoriesError('No pudimos cargar tus categorías.');
      }
    } finally {
      if (!signal?.cancelled) setCategoriesLoading(false);
    }
  }, []);

  useEffect(() => {
    const signal = { cancelled: false };
    void loadCategories(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [loadCategories]);

  const selectableCategories = useMemo(() => {
    const rows = categories.map((c) => ({
      id: c.id,
      parent_id: c.parentId ?? null,
      active: c.active ?? true,
    }));
    return categories.filter((c) =>
      isSelectableInPicker(
        { id: c.id, parent_id: c.parentId ?? null, active: c.active ?? true },
        rows,
      ),
    );
  }, [categories]);

  const categoryIdByName = useMemo(() => {
    const map = new Map<string, number>();
    for (const category of selectableCategories) {
      if (!map.has(category.name)) map.set(category.name, category.id);
    }
    return map;
  }, [selectableCategories]);

  const categoriesReady = !categoriesLoading && !categoriesError;

  // A preset tapped before categories loaded gets its category once they arrive.
  useEffect(() => {
    if (categoryIdByName.size === 0) return;
    setExpenseTemplates((prev) => {
      let changed = false;
      const next = prev.map((expense) => {
        if (expense.categoryId !== '') return expense;
        const preset = EXPENSE_PRESETS.find((p) => p.name === expense.name);
        const id = preset ? categoryIdByName.get(preset.categoryName) : undefined;
        if (id == null) return expense;
        changed = true;
        return { ...expense, categoryId: String(id) };
      });
      return changed ? next : prev;
    });
  }, [categoryIdByName, setExpenseTemplates]);

  useEffect(() => {
    setCanProceed(
      expenseTemplates.length === 0 ||
        (categoriesReady && expensesAreValid(expenseTemplates)),
    );
  }, [expenseTemplates, categoriesReady, setCanProceed]);

  const updateExpense = (id: string, patch: Partial<ExpenseTemplateDraft>) => {
    setExpenseTemplates((prev) =>
      prev.map((expense) => (expense.id === id ? { ...expense, ...patch } : expense)),
    );
  };

  const handleAdd = (preset: ExpensePreset | null) => {
    if (preset) {
      const existing = expenseForPreset(expenseTemplates, preset);
      if (existing) {
        requestFocus(existing.id);
        return;
      }
    }
    const categoryId = preset ? categoryIdByName.get(preset.categoryName) : undefined;
    const id = createClientId();
    requestFocus(id);
    setExpenseTemplates((prev) => [
      ...prev,
      {
        id,
        name: preset?.name ?? '',
        amount: 0,
        categoryId: categoryId != null ? String(categoryId) : '',
        walletId: defaultWalletId,
        isRecurring: true,
        appliesFirstFortnight: true,
        appliesSecondFortnight: true,
      },
    ]);
  };

  const handleRemove = (id: string) => {
    setExpenseTemplates((prev) => prev.filter((expense) => expense.id !== id));
  };

  const hints = expenseTemplates
    .map(expenseRowHint)
    .filter((hint): hint is string => hint !== null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Gastos frecuentes">
        {EXPENSE_PRESETS.map((preset) => {
          const added = expenseForPreset(expenseTemplates, preset) != null;
          return (
            <OnboardingChip
              key={preset.label}
              selected={added}
              onClick={() => handleAdd(preset)}
              aria-label={added ? `${preset.label}: ir a su monto` : `Agregar ${preset.label}`}
            >
              {preset.label}
            </OnboardingChip>
          );
        })}
        <OnboardingChip onClick={() => handleAdd(null)} aria-label="Agregar otro gasto">
          <Plus className="size-3.5" aria-hidden />
          Otro
        </OnboardingChip>
      </div>

      {categoriesError ? (
        <ErrorBanner>
          <span>{categoriesError} </span>
          <button
            type="button"
            onClick={() => void loadCategories()}
            className="font-medium underline underline-offset-2"
          >
            Reintentar
          </button>
        </ErrorBanner>
      ) : null}

      {expenseTemplates.length === 0 ? (
        <EmptyState
          icon={Receipt}
          message="Aún no agregas gastos."
          description="Toca uno de arriba y escribe cuánto pagas. También puedes agregarlos después desde tu panel."
          className="rounded-xl border border-dashed border-border/60 py-8"
        />
      ) : categoriesLoading ? (
        <div className="flex flex-col gap-2" role="status" aria-label="Cargando categorías">
          {expenseTemplates.map((expense) => (
            <Skeleton key={expense.id} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <ul
            className={cn(PANEL_INSET_CLASS, 'divide-y divide-white/[0.08] overflow-hidden')}
            role="list"
            aria-label="Tus gastos fijos"
          >
            {expenseTemplates.map((expense) => (
              <ExpenseRow
                key={expense.id}
                expense={expense}
                wallets={wallets}
                categories={categories}
                categoriesReady={categoriesReady}
                categoriesLoading={categoriesLoading}
                onChange={(patch) => updateExpense(expense.id, patch)}
                onDelete={() => handleRemove(expense.id)}
              />
            ))}
          </ul>
          {hints.length > 0 ? (
            <div role="status" className="flex flex-col gap-1">
              {hints.map((hint, index) => (
                <OverlayHint key={`${index}-${hint}`}>{hint}</OverlayHint>
              ))}
            </div>
          ) : (
            <OverlayHint>
              Toca un gasto para cambiar su nombre, categoría o billetera. Desliza o usa el
              bote para quitarlo.
            </OverlayHint>
          )}
        </>
      )}
    </div>
  );
}
