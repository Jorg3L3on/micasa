'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Receipt } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import EmptyState from '@/components/EmptyState';
import { ErrorBanner } from '@/components/error-banner';
import { FilterChip } from '@/components/filter-chip';
import {
  AmountRow,
  GroupedRow,
  OVERLAY_ROW_INPUT_CLASS,
  OVERLAY_ROW_TRIGGER_CLASS,
  OVERLAY_SECONDARY_BUTTON_CLASS,
  OverlayHint,
} from '@/components/overlay/overlay-form';
import {
  useOnboarding,
  type ExpenseTemplateDraft,
} from '@/components/onboarding/OnboardingContext';
import { OnboardingItemCard } from '@/components/onboarding/OnboardingItemCard';
import {
  FORTNIGHT_FREQUENCY_OPTIONS,
  flagsFromFrequency,
  frequencyFromFlags,
  type FortnightFrequency,
} from '@/components/onboarding/fortnight-frequency';
import { CategoryGroupedSelect } from '@/components/categories/CategoryGroupedSelect';
import { createClientId } from '@/lib/polyfills';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import { isSelectableInPicker } from '@/lib/finance/category-hierarchy';
import type { CategoryOption } from '@/types/catalog';

type ExpensePreset = {
  label: string;
  name: string;
  /** Seeded category name (DEFAULT_CATEGORY_CATALOG); empty when unknown. */
  categoryName: string;
};

/** Common fixed costs. Each chip fills everything except the amount. */
const EXPENSE_PRESETS: ExpensePreset[] = [
  { label: 'Renta', name: 'Renta', categoryName: 'Renta' },
  { label: 'Internet', name: 'Internet', categoryName: 'Servicios del hogar' },
  { label: 'Luz', name: 'Luz', categoryName: 'Servicios del hogar' },
  { label: 'Súper', name: 'Súper', categoryName: 'Supermercado' },
  { label: 'Transporte', name: 'Transporte', categoryName: 'Transporte' },
];

export const expensesAreValid = (expenses: ExpenseTemplateDraft[]): boolean =>
  expenses.every(
    (expense) =>
      expense.name.trim() !== '' &&
      Number.isFinite(expense.amount) &&
      expense.amount > 0 &&
      expense.categoryId !== '' &&
      expense.walletId !== '',
  );

const missingFieldsHint = (expense: ExpenseTemplateDraft): string | null => {
  const missing: string[] = [];
  if (!(expense.amount > 0)) missing.push('el monto');
  if (expense.name.trim() === '') missing.push('un nombre');
  if (expense.categoryId === '') missing.push('una categoría');
  if (missing.length === 0) return null;
  const list =
    missing.length === 1
      ? missing[0]
      : `${missing.slice(0, -1).join(', ')} y ${missing[missing.length - 1]}`;
  return `Falta ${list}.`;
};

const ExpenseLeading = () => (
  <span
    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-status-expense-soft text-status-expense"
    aria-hidden
  >
    <Receipt className="size-4" />
  </span>
);

export default function StepExpenseTemplates() {
  const {
    setCanProceed,
    expenseTemplates,
    setExpenseTemplates,
    wallets,
    defaultWalletId,
    goNext,
  } = useOnboarding();
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [focusId, setFocusId] = useState<string | null>(null);

  // Bring a newly added card into view and put the cursor on its amount.
  useEffect(() => {
    if (!focusId) return;
    const input = document.getElementById(`expense-amount-${focusId}`);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    input?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    input?.focus({ preventScroll: true });
  }, [focusId]);

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
    const categoryId = preset ? categoryIdByName.get(preset.categoryName) : undefined;
    const id = createClientId();
    setFocusId(id);
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

  const handleSkip = () => {
    setExpenseTemplates([]);
    goNext();
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Agregar un gasto frecuente"
      >
        {EXPENSE_PRESETS.map((preset) => (
          <FilterChip
            key={preset.label}
            selected={false}
            onClick={() => handleAdd(preset)}
            ariaLabel={`Agregar ${preset.label}`}
          >
            <Plus className="size-3.5" aria-hidden />
            {preset.label}
          </FilterChip>
        ))}
        <FilterChip
          selected={false}
          onClick={() => handleAdd(null)}
          ariaLabel="Agregar otro gasto"
        >
          <Plus className="size-3.5" aria-hidden />
          Otro
        </FilterChip>
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

      {categoriesLoading && expenseTemplates.length > 0 ? (
        <div className="flex flex-col gap-2" role="status" aria-label="Cargando categorías">
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      ) : null}

      {expenseTemplates.length === 0 ? (
        <EmptyState
          icon={Receipt}
          message="Aún no agregas gastos."
          description="Toca uno de arriba y escribe cuánto pagas. También puedes agregarlos después desde tu panel."
          className="rounded-xl border border-dashed border-border/60 py-8"
        />
      ) : (
        <ul className="flex flex-col gap-3" role="list">
          {expenseTemplates.map((expense) => {
            const nameId = `expense-name-${expense.id}`;
            const categoryId = `expense-category-${expense.id}`;
            const walletId = `expense-wallet-${expense.id}`;
            const frequencyId = `expense-frequency-${expense.id}`;
            const hint = missingFieldsHint(expense);

            return (
              <li key={expense.id} className="flex flex-col gap-1.5">
                <OnboardingItemCard
                  leading={<ExpenseLeading />}
                  title={expense.name}
                  subtitle="Gasto fijo"
                  canDelete
                  itemNoun="gasto"
                  onDelete={() => handleRemove(expense.id)}
                >
                  <AmountRow
                    id={`expense-amount-${expense.id}`}
                    label="Monto por quincena"
                    value={expense.amount || ''}
                    onChange={(value) =>
                      updateExpense(expense.id, {
                        amount: Number.isFinite(value) ? value : 0,
                      })
                    }
                  />
                  <GroupedRow label="Nombre" htmlFor={nameId}>
                    <Input
                      id={nameId}
                      value={expense.name}
                      onChange={(event) =>
                        updateExpense(expense.id, { name: event.target.value })
                      }
                      placeholder="Ej. Colegiatura"
                      autoComplete="off"
                      className={OVERLAY_ROW_INPUT_CLASS}
                    />
                  </GroupedRow>
                  <GroupedRow label="Categoría" htmlFor={categoryId}>
                    <CategoryGroupedSelect
                      categories={categories}
                      value={
                        expense.categoryId
                          ? Number.parseInt(expense.categoryId, 10)
                          : undefined
                      }
                      onValueChange={(id) =>
                        updateExpense(expense.id, { categoryId: String(id) })
                      }
                      disabled={!categoriesReady}
                      placeholder={categoriesLoading ? 'Cargando…' : 'Elige una categoría'}
                      ariaLabel="Categoría del gasto"
                      triggerId={categoryId}
                      triggerClassName={OVERLAY_ROW_TRIGGER_CLASS}
                    />
                  </GroupedRow>
                  <GroupedRow label="Billetera" htmlFor={walletId}>
                    <Select
                      value={expense.walletId}
                      onValueChange={(value) =>
                        updateExpense(expense.id, { walletId: value })
                      }
                    >
                      <SelectTrigger id={walletId} className={OVERLAY_ROW_TRIGGER_CLASS}>
                        <SelectValue placeholder="Con qué pagas" />
                      </SelectTrigger>
                      <SelectContent>
                        {wallets.map((wallet) => (
                          <SelectItem key={wallet.id} value={wallet.id}>
                            {wallet.name || 'Billetera sin nombre'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </GroupedRow>
                  <GroupedRow label="Cuándo" htmlFor={frequencyId}>
                    <Select
                      value={frequencyFromFlags(expense)}
                      onValueChange={(value) =>
                        updateExpense(expense.id, {
                          isRecurring: true,
                          ...flagsFromFrequency(value as FortnightFrequency),
                        })
                      }
                    >
                      <SelectTrigger id={frequencyId} className={OVERLAY_ROW_TRIGGER_CLASS}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FORTNIGHT_FREQUENCY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </GroupedRow>
                </OnboardingItemCard>
                {hint ? <OverlayHint role="status">{hint}</OverlayHint> : null}
              </li>
            );
          })}
        </ul>
      )}

      <Button
        type="button"
        variant="ghost"
        onClick={handleSkip}
        className={`${OVERLAY_SECONDARY_BUTTON_CLASS} text-primary-text`}
      >
        Omitir por ahora
      </Button>
    </div>
  );
}
