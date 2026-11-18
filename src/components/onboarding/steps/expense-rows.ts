import type { ExpenseTemplateDraft } from '@/components/onboarding/OnboardingContext';
import type { FortnightFrequency } from '@/components/onboarding/fortnight-frequency';

export type ExpensePresetIcon = 'home' | 'cart' | 'wifi' | 'bolt' | 'bus';

export type ExpensePreset = {
  label: string;
  name: string;
  /** Seeded category name (DEFAULT_CATEGORY_CATALOG); empty when unknown. */
  categoryName: string;
  icon: ExpensePresetIcon;
};

/** Common fixed costs, in chip order. Each chip fills everything except the amount. */
export const EXPENSE_PRESETS: ExpensePreset[] = [
  { label: 'Renta', name: 'Renta', categoryName: 'Renta', icon: 'home' },
  { label: 'Súper', name: 'Súper', categoryName: 'Supermercado', icon: 'cart' },
  { label: 'Internet', name: 'Internet', categoryName: 'Servicios del hogar', icon: 'wifi' },
  { label: 'Luz', name: 'Luz', categoryName: 'Servicios del hogar', icon: 'bolt' },
  { label: 'Transporte', name: 'Transporte', categoryName: 'Transporte', icon: 'bus' },
];

/** The preset an expense came from, matched by its (trimmed) name. */
export const presetForExpense = (
  expense: Pick<ExpenseTemplateDraft, 'name'>,
): ExpensePreset | undefined => {
  const name = expense.name.trim();
  return EXPENSE_PRESETS.find((preset) => preset.name === name);
};

/** First expense row that carries a preset's name: its chip shows pressed. */
export const expenseForPreset = (
  expenses: readonly ExpenseTemplateDraft[],
  preset: ExpensePreset,
): ExpenseTemplateDraft | undefined =>
  expenses.find((expense) => expense.name.trim() === preset.name);

/** 1ª / 2ª / Ambas segmented toggle on each expense row. */
export const EXPENSE_WHEN_SEGMENTS: { value: FortnightFrequency; label: string }[] = [
  { value: 'FIRST', label: '1ª' },
  { value: 'SECOND', label: '2ª' },
  { value: 'BOTH', label: 'Ambas' },
];

const joinSpanish = (items: string[]): string =>
  items.length <= 1
    ? (items[0] ?? '')
    : `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;

/**
 * What an expense row still needs, e.g. "Falta el monto de Renta.".
 * `null` when the row is complete.
 */
export const expenseRowHint = (
  expense: Pick<ExpenseTemplateDraft, 'name' | 'amount' | 'categoryId' | 'walletId'>,
): string | null => {
  const missing: string[] = [];
  const name = expense.name.trim();
  if (name === '') missing.push('el nombre');
  if (!(Number.isFinite(expense.amount) && expense.amount > 0)) missing.push('el monto');
  if (expense.categoryId === '') missing.push('la categoría');
  if (expense.walletId === '') missing.push('la billetera');
  if (missing.length === 0) return null;
  return `Falta ${joinSpanish(missing)} de ${name || 'este gasto'}.`;
};

/** Name, category or wallet missing: the row's detail fields stay open. */
export const expenseNeedsDetails = (
  expense: Pick<ExpenseTemplateDraft, 'name' | 'categoryId' | 'walletId'>,
  categoriesReady: boolean,
): boolean =>
  expense.name.trim() === '' ||
  expense.walletId === '' ||
  (categoriesReady && expense.categoryId === '');
