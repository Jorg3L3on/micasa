import { describe, expect, it } from 'vitest';
import type {
  ExpenseTemplateListItem,
  IncomeTemplateListItem,
} from '@/types/catalog';
import {
  createExpenseTemplateSchema,
  updateExpenseTemplateSchema,
} from '@/schemas/expense-template.schema';
import { updateIncomeTemplateSchema } from '@/schemas/income-template.schema';
import {
  cardCutoffHint,
  daySelectOptions,
  expenseFormDefaults,
  expensePayload,
  expenseRepeats,
  expenseScheduleFor,
  formTitle,
  incomeFormDefaults,
  incomeFormSchema,
  incomePayload,
  NO_FIXED_DAY,
  NOT_APPLICABLE,
  submitLabel,
} from './scheduled-form';
import { expenseRows, incomeRows } from './scheduled-rows';

// Fixtures only: made-up names and whole-number figures.
const expense = (
  overrides: Partial<ExpenseTemplateListItem> = {},
): ExpenseTemplateListItem => ({
  id: 1,
  name: 'Gasto demo',
  category: 'Hogar',
  categoryIcon: null,
  categoryId: 10,
  suggestedAmount: 300,
  paymentMethod: 'Tarjeta demo',
  paymentMethodId: 5,
  paymentMethodProviderIconKey: null,
  paymentMethodType: 'CREDIT_CARD',
  paymentMethodCutoffDay: 12,
  active: true,
  totalEstimatedAmount: 300,
  dueDayFirst: 5,
  dueDaySecond: null,
  dueDay: 5,
  cutoffDay: 9,
  isRecurring: true,
  appliesFirstFortnight: true,
  appliesSecondFortnight: false,
  isSubscription: true,
  ...overrides,
});

const income = (
  overrides: Partial<IncomeTemplateListItem> = {},
): IncomeTemplateListItem => ({
  id: 2,
  name: 'Ingreso demo',
  suggestedAmount: 5000,
  source: 'Empresa demo',
  categoryId: 20,
  walletId: 7,
  categoryName: 'Salario',
  categoryIcon: null,
  appliesFirstFortnight: true,
  appliesSecondFortnight: false,
  active: true,
  userId: 3,
  userName: 'Persona demo',
  ...overrides,
});

const expenseRow = (overrides?: Partial<ExpenseTemplateListItem>) =>
  expenseRows([expense(overrides)])[0];
const incomeRow = (overrides?: Partial<IncomeTemplateListItem>) =>
  incomeRows([income(overrides)], [])[0];

describe('daySelectOptions', () => {
  it('offers No aplica, Sin día fijo, then 1-14 in the 1ª', () => {
    const options = daySelectOptions('FIRST');
    expect(options.slice(0, 3).map((o) => o.label)).toEqual(['No aplica', 'Sin día fijo', 'Día 1']);
    expect(options.at(-1)).toEqual({ value: '14', label: 'Día 14' });
    expect(options).toHaveLength(16);
  });

  it('offers 15-30 in the 2ª and never 31', () => {
    const values = daySelectOptions('SECOND').map((o) => o.value);
    expect(values.slice(0, 3)).toEqual([NOT_APPLICABLE, NO_FIXED_DAY, '15']);
    expect(values.at(-1)).toBe('30');
    expect(values).not.toContain('31');
  });
});

describe('titles', () => {
  it('names create and edit for both kinds', () => {
    expect(formTitle('expense', false)).toBe('Agregar gasto programado');
    expect(formTitle('income', true)).toBe('Editar ingreso programado');
    expect(submitLabel('income', false)).toBe('Agregar ingreso programado');
    expect(submitLabel('expense', true)).toBe('Guardar cambios');
  });
});

describe('expenseScheduleFor', () => {
  it('reads valid days and Sin día fijo as they are', () => {
    expect(
      expenseScheduleFor(
        expenseRow({ appliesSecondFortnight: true, dueDaySecond: null, dueDayFirst: 5 }),
      ),
    ).toEqual({ first: '5', second: NO_FIXED_DAY, adjustedHint: null });
  });

  it('a quincena that does not apply is No aplica', () => {
    expect(expenseScheduleFor(expenseRow()).second).toBe(NOT_APPLICABLE);
  });

  it('legacy 15 in the 1ª with an empty 2ª moves to 2ª · día 15', () => {
    const schedule = expenseScheduleFor(expenseRow({ dueDayFirst: 15, dueDay: 15 }));
    expect(schedule.first).toBe(NOT_APPLICABLE);
    expect(schedule.second).toBe('15');
    expect(schedule.adjustedHint).toMatch(/2ª · día 15/);
  });

  it('legacy 15 in the 1ª with the 2ª in use becomes 1ª · día 14', () => {
    const schedule = expenseScheduleFor(
      expenseRow({ dueDayFirst: 15, appliesSecondFortnight: true, dueDaySecond: 28 }),
    );
    expect(schedule).toMatchObject({ first: '14', second: '28' });
    expect(schedule.adjustedHint).toMatch(/día 14/);
  });

  it('legacy 31 in the 2ª becomes día 30', () => {
    const schedule = expenseScheduleFor(
      expenseRow({
        appliesFirstFortnight: false,
        dueDayFirst: null,
        appliesSecondFortnight: true,
        dueDaySecond: 31,
      }),
    );
    expect(schedule.second).toBe('30');
    expect(schedule.adjustedHint).toMatch(/día 30/);
  });

  it('a legacy-only due_day of 20 on both quincenas adjusts the 1ª to 14', () => {
    const schedule = expenseScheduleFor(
      expenseRow({
        appliesSecondFortnight: true,
        dueDayFirst: null,
        dueDaySecond: null,
        dueDay: 20,
      }),
    );
    expect(schedule).toMatchObject({ first: '14', second: '20' });
  });
});

describe('expensePayload', () => {
  it('derives applies and isRecurring from the selects, with no cutoffDay', () => {
    const payload = expensePayload({
      ...expenseFormDefaults(expenseRow()),
      first: '5',
      second: NO_FIXED_DAY,
    });
    expect(payload).toEqual({
      name: 'Gasto demo',
      categoryId: 10,
      suggestedAmount: 300,
      paymentMethodId: 5,
      active: true,
      isSubscription: true,
      appliesFirstFortnight: true,
      appliesSecondFortnight: true,
      isRecurring: true,
      dueDayFirst: 5,
      dueDaySecond: null,
    });
    expect('cutoffDay' in payload).toBe(false);
    expect(updateExpenseTemplateSchema.safeParse(payload).success).toBe(true);
  });

  it('No aplica on both does not repeat (Sin programar)', () => {
    const values = { ...expenseFormDefaults(expenseRow()), first: NOT_APPLICABLE, second: NOT_APPLICABLE };
    expect(expenseRepeats(values)).toBe(false);
    expect(expensePayload(values)).toMatchObject({
      appliesFirstFortnight: false,
      appliesSecondFortnight: false,
      isRecurring: false,
      dueDayFirst: null,
      dueDaySecond: null,
    });
    expect(createExpenseTemplateSchema.safeParse(expensePayload(values)).success).toBe(true);
  });

  it('an empty amount is sent as null (variable)', () => {
    const values = { ...expenseFormDefaults(expenseRow()), amount: 0 };
    expect(expensePayload(values).suggestedAmount).toBeNull();
  });

  it('a legacy item saved as opened passes the API schema', () => {
    const values = expenseFormDefaults(expenseRow({ dueDayFirst: 15, dueDay: 15 }));
    const payload = expensePayload(values);
    expect(payload).toMatchObject({ appliesFirstFortnight: false, dueDaySecond: 15 });
    expect(updateExpenseTemplateSchema.safeParse(payload).success).toBe(true);
  });
});

describe('income form', () => {
  it('opens with the stored ids and sends walletId and userId back', () => {
    const row = incomeRow();
    const values = incomeFormDefaults(row);
    expect(values).toMatchObject({ categoryId: 20, walletId: 7, source: 'Empresa demo' });
    const payload = incomePayload(values, row);
    expect(payload).toMatchObject({ walletId: 7, userId: 3, categoryId: 20 });
    expect(updateIncomeTemplateSchema.safeParse(payload).success).toBe(true);
  });

  it('needs at least one quincena', () => {
    const values = { ...incomeFormDefaults(null), name: 'Sueldo', categoryId: 20 };
    expect(incomeFormSchema.safeParse(values).success).toBe(true);
    const result = incomeFormSchema.safeParse({ ...values, first: false, second: false });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['first']);
  });
});

describe('cardCutoffHint', () => {
  it('names the card cutoff', () => {
    expect(cardCutoffHint({ name: 'Tarjeta demo', type: 'CREDIT_CARD', cutoff_day: 12 })).toBe(
      'Corte de Tarjeta demo: día 12.',
    );
  });

  it('says nothing for a debit wallet', () => {
    expect(cardCutoffHint({ name: 'Débito demo', type: 'DEBIT_CARD', cutoff_day: null })).toBeNull();
  });
});

describe('scheduledListHref', () => {
  it('keeps a valid owner context and drops anything else', async () => {
    const { scheduledListHref } = await import('./owner-context');
    expect(scheduledListHref('expense', { ownerType: 'house', ownerId: '1' })).toBe(
      '/settings/expense-templates?ownerType=house&ownerId=1',
    );
    expect(scheduledListHref('income', { ownerType: 'x', ownerId: '1' })).toBe(
      '/settings/income-templates',
    );
    expect(scheduledListHref('income', {})).toBe('/settings/income-templates');
  });
});
