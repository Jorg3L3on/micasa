import { describe, expect, it } from 'vitest';
import type { ExpenseTemplateDraft } from '@/components/onboarding/OnboardingContext';
import { expensesAreValid } from './StepExpenseTemplates';
import {
  EXPENSE_PRESETS,
  EXPENSE_WHEN_SEGMENTS,
  expenseForPreset,
  expenseNeedsDetails,
  expenseRowHint,
  presetForExpense,
} from './expense-rows';
import { flagsFromFrequency } from '@/components/onboarding/fortnight-frequency';

const expense = (patch: Partial<ExpenseTemplateDraft> = {}): ExpenseTemplateDraft => ({
  id: 'e1',
  name: 'Renta',
  amount: 7500,
  categoryId: '12',
  walletId: 'w1',
  isRecurring: true,
  appliesFirstFortnight: true,
  appliesSecondFortnight: false,
  ...patch,
});

describe('expense presets', () => {
  it('keeps the chip order and the seeded category mapping', () => {
    expect(EXPENSE_PRESETS.map((preset) => preset.label)).toEqual([
      'Renta',
      'Súper',
      'Internet',
      'Luz',
      'Transporte',
    ]);
    expect(
      Object.fromEntries(EXPENSE_PRESETS.map((preset) => [preset.name, preset.categoryName])),
    ).toEqual({
      Renta: 'Renta',
      Súper: 'Supermercado',
      Internet: 'Servicios del hogar',
      Luz: 'Servicios del hogar',
      Transporte: 'Transporte',
    });
  });

  it('a chip is pressed while a row carries its name', () => {
    const renta = EXPENSE_PRESETS[0];
    expect(expenseForPreset([], renta)).toBeUndefined();
    expect(expenseForPreset([expense({ id: 'a', name: ' Renta ' })], renta)?.id).toBe('a');
    expect(presetForExpense(expense({ name: 'Luz' }))?.icon).toBe('bolt');
    expect(presetForExpense(expense({ name: 'Colegiatura' }))).toBeUndefined();
  });

  it('maps the 1ª / 2ª / Ambas toggle onto the fortnight flags', () => {
    expect(
      EXPENSE_WHEN_SEGMENTS.map((segment) => [segment.label, flagsFromFrequency(segment.value)]),
    ).toEqual([
      ['1ª', { appliesFirstFortnight: true, appliesSecondFortnight: false }],
      ['2ª', { appliesFirstFortnight: false, appliesSecondFortnight: true }],
      ['Ambas', { appliesFirstFortnight: true, appliesSecondFortnight: true }],
    ]);
  });
});

describe('expenseRowHint', () => {
  it('names the missing amount and the expense', () => {
    expect(expenseRowHint(expense({ name: 'Internet', amount: 0 }))).toBe(
      'Falta el monto de Internet.',
    );
    expect(expenseRowHint(expense({ amount: Number.NaN }))).toBe('Falta el monto de Renta.');
  });

  it('lists every missing field and falls back to "este gasto"', () => {
    expect(expenseRowHint(expense({ name: '', amount: 0, categoryId: '' }))).toBe(
      'Falta el nombre, el monto y la categoría de este gasto.',
    );
    expect(expenseRowHint(expense({ walletId: '' }))).toBe('Falta la billetera de Renta.');
  });

  it('is null on a complete row, in step with expensesAreValid', () => {
    const complete = expense();
    expect(expenseRowHint(complete)).toBeNull();
    expect(expensesAreValid([complete])).toBe(true);
    for (const patch of [{ amount: 0 }, { name: ' ' }, { categoryId: '' }, { walletId: '' }]) {
      const row = expense(patch);
      expect(expenseRowHint(row)).not.toBeNull();
      expect(expensesAreValid([complete, row])).toBe(false);
    }
  });
});

describe('expensesAreValid', () => {
  it('lets an empty list through so the step can be skipped', () => {
    expect(expensesAreValid([])).toBe(true);
  });
});

describe('expenseNeedsDetails', () => {
  it('opens the detail fields when name, wallet or (loaded) category is missing', () => {
    expect(expenseNeedsDetails(expense(), true)).toBe(false);
    expect(expenseNeedsDetails(expense({ name: '' }), true)).toBe(true);
    expect(expenseNeedsDetails(expense({ walletId: '' }), true)).toBe(true);
    expect(expenseNeedsDetails(expense({ categoryId: '' }), true)).toBe(true);
    expect(expenseNeedsDetails(expense({ categoryId: '' }), false)).toBe(false);
  });
});
