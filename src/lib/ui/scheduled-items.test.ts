import { describe, expect, it } from 'vitest';
import type {
  ExpenseTemplateListItem,
  IncomeTemplateListItem,
} from '@/types/catalog';
import {
  compareByDueDay,
  dayOptions,
  fromExpenseTemplate,
  fromIncomeTemplate,
  isValidDueDay,
  nearestValidDueDay,
  netAfterExpenses,
  NO_FIXED_DAY_LABEL,
  perMonth,
  perYear,
  scheduleLabel,
  scheduleLabels,
  sectionize,
  summarize,
  type ScheduledItem,
} from './scheduled-items';

// Fixtures only: made-up names and amounts.
const expense = (
  overrides: Partial<ExpenseTemplateListItem> = {},
): ExpenseTemplateListItem => ({
  id: 1,
  name: 'Gasto demo',
  category: 'Hogar',
  categoryIcon: null,
  categoryId: 10,
  suggestedAmount: 100,
  paymentMethod: 'Débito demo',
  paymentMethodId: 5,
  paymentMethodProviderIconKey: null,
  paymentMethodType: 'DEBIT_CARD',
  paymentMethodCutoffDay: null,
  active: true,
  totalEstimatedAmount: 100,
  dueDayFirst: null,
  dueDaySecond: null,
  dueDay: null,
  cutoffDay: null,
  isRecurring: true,
  appliesFirstFortnight: true,
  appliesSecondFortnight: false,
  isSubscription: false,
  ...overrides,
});

const income = (
  overrides: Partial<IncomeTemplateListItem> = {},
): IncomeTemplateListItem => ({
  id: 1,
  name: 'Ingreso demo',
  suggestedAmount: 1000,
  source: null,
  categoryId: null,
  walletId: null,
  categoryName: null,
  categoryIcon: null,
  appliesFirstFortnight: true,
  appliesSecondFortnight: true,
  active: true,
  userId: null,
  userName: null,
  ...overrides,
});

const e = (overrides: Partial<ExpenseTemplateListItem> = {}): ScheduledItem =>
  fromExpenseTemplate(expense(overrides));

const names = (items: ScheduledItem[]) => items.map((i) => i.name);

describe('fromExpenseTemplate', () => {
  it('reads suggestedAmount, not totalEstimatedAmount', () => {
    const item = e({ suggestedAmount: null, totalEstimatedAmount: 450 });
    expect(item.amount).toBeNull();
  });

  it('keeps per-quincena days and ignores the derived dueDay when they exist', () => {
    const item = e({ dueDayFirst: 5, dueDaySecond: null, dueDay: 5 });
    expect(item.dueDayFirst).toBe(5);
    expect(item.dueDaySecond).toBeNull();
  });

  it('applies a legacy due_day to both quincenas when no specific day is set', () => {
    const item = e({ dueDayFirst: null, dueDaySecond: null, dueDay: 8 });
    expect(item.dueDayFirst).toBe(8);
    expect(item.dueDaySecond).toBe(8);
  });
});

describe('fromIncomeTemplate', () => {
  it('maps quincenas and has no due day nor subscription', () => {
    const item = fromIncomeTemplate(income({ appliesSecondFortnight: false }));
    expect(item).toMatchObject({
      kind: 'income',
      amount: 1000,
      appliesFirst: true,
      appliesSecond: false,
      dueDayFirst: null,
      dueDaySecond: null,
      isSubscription: false,
    });
  });
});

describe('summarize', () => {
  it('counts an item with no amount as variable, never as 0', () => {
    const summary = summarize([
      e({ id: 1, suggestedAmount: 200 }),
      e({ id: 2, suggestedAmount: null }),
    ]);
    expect(summary.first).toEqual({ total: 200, count: 2, variableCount: 1 });
    expect(summary.monthTotal).toBe(200);
    expect(summary.monthVariableCount).toBe(1);
  });

  it('counts an item in both quincenas in both', () => {
    const summary = summarize([
      e({ suggestedAmount: 150, appliesFirstFortnight: true, appliesSecondFortnight: true }),
    ]);
    expect(summary.first).toEqual({ total: 150, count: 1, variableCount: 0 });
    expect(summary.second).toEqual({ total: 150, count: 1, variableCount: 0 });
    expect(summary.monthTotal).toBe(300);
  });

  it('a variable item in both quincenas is one variable item in the month', () => {
    const summary = summarize([
      e({ suggestedAmount: null, appliesFirstFortnight: true, appliesSecondFortnight: true }),
    ]);
    expect(summary.first.variableCount).toBe(1);
    expect(summary.second.variableCount).toBe(1);
    expect(summary.monthVariableCount).toBe(1);
  });

  it('ignores inactive items', () => {
    const summary = summarize([
      e({ id: 1, suggestedAmount: 100 }),
      e({ id: 2, suggestedAmount: 999, active: false }),
    ]);
    expect(summary.first).toEqual({ total: 100, count: 1, variableCount: 0 });
    expect(summary.monthTotal).toBe(100);
  });

  it('ignores a non-repeating expense (no quincena), even when isRecurring is set', () => {
    const summary = summarize([
      e({ id: 1, suggestedAmount: 100 }),
      e({
        id: 2,
        suggestedAmount: 500,
        isRecurring: false,
        appliesFirstFortnight: false,
        appliesSecondFortnight: false,
      }),
      e({
        id: 3,
        suggestedAmount: 700,
        isRecurring: true,
        appliesFirstFortnight: false,
        appliesSecondFortnight: false,
      }),
    ]);
    expect(summary.first.count).toBe(1);
    expect(summary.second.count).toBe(0);
    expect(summary.monthTotal).toBe(100);
  });

  it('sums subscriptions per month, once per quincena they occur in', () => {
    const summary = summarize([
      e({ id: 1, suggestedAmount: 99.9, isSubscription: true }),
      e({
        id: 2,
        suggestedAmount: 50,
        isSubscription: true,
        appliesFirstFortnight: true,
        appliesSecondFortnight: true,
      }),
      e({ id: 3, suggestedAmount: null, isSubscription: true }),
      e({ id: 4, suggestedAmount: 300, isSubscription: false }),
      e({ id: 5, suggestedAmount: 80, isSubscription: true, active: false }),
    ]);
    expect(summary.subscriptionsMonthTotal).toBe(199.9);
  });

  it('adds cents without floating-point drift', () => {
    const summary = summarize([
      e({ id: 1, suggestedAmount: 0.1 }),
      e({ id: 2, suggestedAmount: 0.2 }),
    ]);
    expect(summary.first.total).toBe(0.3);
  });

  it('works for incomes, with no subscriptions', () => {
    const summary = summarize([
      fromIncomeTemplate(income({ id: 1, suggestedAmount: 12000 })),
      fromIncomeTemplate(income({ id: 2, suggestedAmount: null, appliesSecondFortnight: false })),
    ]);
    expect(summary.first).toEqual({ total: 12000, count: 2, variableCount: 1 });
    expect(summary.second).toEqual({ total: 12000, count: 1, variableCount: 0 });
    expect(summary.monthTotal).toBe(24000);
    expect(summary.subscriptionsMonthTotal).toBe(0);
  });

  it('is all zeros for an empty list', () => {
    expect(summarize([])).toEqual({
      first: { total: 0, count: 0, variableCount: 0 },
      second: { total: 0, count: 0, variableCount: 0 },
      monthTotal: 0,
      monthVariableCount: 0,
      subscriptionsMonthTotal: 0,
    });
  });
});

describe('sectionize', () => {
  const items = [
    e({ id: 1, name: 'Luz', dueDayFirst: 10 }),
    e({ id: 2, name: 'Agua', dueDayFirst: 10 }),
    e({ id: 3, name: 'Renta', dueDayFirst: 3 }),
    e({ id: 4, name: 'Despensa' }),
    e({ id: 5, name: 'Cine', dueDayFirst: null }),
    e({
      id: 6,
      name: 'Internet',
      appliesFirstFortnight: false,
      appliesSecondFortnight: true,
      dueDaySecond: 18,
    }),
    e({
      id: 7,
      name: 'Gimnasio',
      appliesFirstFortnight: true,
      appliesSecondFortnight: true,
      dueDayFirst: 7,
      dueDaySecond: 22,
    }),
    e({
      id: 8,
      name: 'Regalo',
      appliesFirstFortnight: false,
      appliesSecondFortnight: false,
      isRecurring: false,
    }),
    e({ id: 9, name: 'Seguro', active: false, dueDayFirst: 1 }),
    e({
      id: 10,
      name: 'Antiguo',
      active: false,
      appliesFirstFortnight: false,
      appliesSecondFortnight: false,
    }),
  ];

  it('orders the 1ª by due day, ties by name, no day last by name', () => {
    const { programados } = sectionize(items, 'first');
    expect(names(programados)).toEqual([
      'Renta',
      'Gimnasio',
      'Agua',
      'Luz',
      'Cine',
      'Despensa',
    ]);
  });

  it('orders the 2ª by the 2ª day', () => {
    const { programados } = sectionize(items, 'second');
    expect(names(programados)).toEqual(['Internet', 'Gimnasio']);
  });

  it('orders Todas by the first due day', () => {
    const { programados } = sectionize(items, 'all');
    expect(names(programados)).toEqual([
      'Renta',
      'Gimnasio',
      'Agua',
      'Luz',
      'Internet',
      'Cine',
      'Despensa',
    ]);
  });

  it('puts expenses with no quincena under sinProgramar, only in Todas', () => {
    expect(names(sectionize(items, 'all').sinProgramar)).toEqual(['Regalo']);
    expect(sectionize(items, 'first').sinProgramar).toEqual([]);
    expect(sectionize(items, 'second').sinProgramar).toEqual([]);
  });

  it('puts inactive items under inactivos, filtered by quincena in a quincena view', () => {
    expect(names(sectionize(items, 'all').inactivos)).toEqual(['Antiguo', 'Seguro']);
    expect(names(sectionize(items, 'first').inactivos)).toEqual(['Seguro']);
    expect(sectionize(items, 'second').inactivos).toEqual([]);
  });

  it('never repeats an item across sections', () => {
    const { programados, sinProgramar, inactivos } = sectionize(items, 'all');
    const ids = [...programados, ...sinProgramar, ...inactivos].map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(items.length);
  });

  it('does not mutate the input', () => {
    const copy = [...items];
    sectionize(items, 'all');
    expect(items).toEqual(copy);
  });

  it('breaks a full tie (same day, same name) by id', () => {
    const a = e({ id: 2, name: 'Pago', dueDayFirst: 4 });
    const b = e({ id: 1, name: 'pago', dueDayFirst: 4 });
    expect([a, b].sort(compareByDueDay('first')).map((i) => i.id)).toEqual([1, 2]);
  });
});

describe('scheduleLabel', () => {
  it('shows the quincena and its day', () => {
    expect(scheduleLabel(e({ dueDayFirst: 12 }), 'FIRST')).toBe('1ª · día 12');
  });

  it('shows the quincena alone with no fixed day', () => {
    const item = e({ appliesFirstFortnight: false, appliesSecondFortnight: true });
    expect(scheduleLabel(item, 'SECOND')).toBe('2ª');
  });

  it('is null for a quincena the item does not occur in', () => {
    expect(scheduleLabel(e({ dueDayFirst: 5 }), 'SECOND')).toBeNull();
  });

  it('lists both quincenas, 1ª first; none when not scheduled', () => {
    const both = e({
      appliesFirstFortnight: true,
      appliesSecondFortnight: true,
      dueDayFirst: 5,
      dueDaySecond: 20,
    });
    expect(scheduleLabels(both)).toEqual(['1ª · día 5', '2ª · día 20']);
    expect(
      scheduleLabels(e({ appliesFirstFortnight: false, appliesSecondFortnight: false })),
    ).toEqual([]);
  });
});

describe('perMonth and perYear', () => {
  it('multiplies by the quincenas the item occurs in', () => {
    const both = e({
      suggestedAmount: 250.5,
      appliesFirstFortnight: true,
      appliesSecondFortnight: true,
    });
    expect(perMonth(both)).toBe(501);
    expect(perYear(both)).toBe(6012);
    expect(perMonth(e({ suggestedAmount: 99 }))).toBe(99);
    expect(perYear(e({ suggestedAmount: 99 }))).toBe(1188);
  });

  it('is null for a variable item', () => {
    expect(perMonth(e({ suggestedAmount: null }))).toBeNull();
    expect(perYear(e({ suggestedAmount: null }))).toBeNull();
  });

  it('is null for an item that does not repeat', () => {
    const once = e({ appliesFirstFortnight: false, appliesSecondFortnight: false });
    expect(perMonth(once)).toBeNull();
    expect(perYear(once)).toBeNull();
  });
});

describe('dayOptions', () => {
  const days = (period: 'FIRST' | 'SECOND') =>
    dayOptions(period)
      .map((o) => o.value)
      .filter((v): v is number => v !== null);

  it('offers 1..14 for the 1ª quincena', () => {
    expect(days('FIRST')).toEqual(Array.from({ length: 14 }, (_, i) => i + 1));
  });

  it('offers 15..30 for the 2ª quincena', () => {
    expect(days('SECOND')).toEqual(Array.from({ length: 16 }, (_, i) => i + 15));
  });

  it('starts with "Sin día fijo" and labels days', () => {
    const options = dayOptions('FIRST');
    expect(options[0]).toEqual({ value: null, label: NO_FIXED_DAY_LABEL });
    expect(options[1]).toEqual({ value: 1, label: 'Día 1' });
  });

  it('never offers day 15 in the 1ª nor 31 anywhere', () => {
    expect(days('FIRST')).not.toContain(15);
    expect(days('SECOND')).not.toContain(31);
  });
});

describe('isValidDueDay and nearestValidDueDay', () => {
  it('validates the limits of each quincena', () => {
    expect(isValidDueDay('FIRST', 14)).toBe(true);
    expect(isValidDueDay('FIRST', 15)).toBe(false);
    expect(isValidDueDay('SECOND', 15)).toBe(true);
    expect(isValidDueDay('SECOND', 31)).toBe(false);
    expect(isValidDueDay('FIRST', 0)).toBe(false);
  });

  it('maps legacy values to the closest valid day', () => {
    expect(nearestValidDueDay('FIRST', 15)).toBe(14);
    expect(nearestValidDueDay('SECOND', 31)).toBe(30);
    expect(nearestValidDueDay('SECOND', 3)).toBe(15);
    expect(nearestValidDueDay('FIRST', 9)).toBe(9);
    expect(nearestValidDueDay('FIRST', null)).toBeNull();
  });
});

describe('netAfterExpenses', () => {
  const incomes = [
    fromIncomeTemplate(income({ id: 1, suggestedAmount: 20000 })),
    fromIncomeTemplate(income({ id: 2, suggestedAmount: 3000, appliesSecondFortnight: false })),
    // Inactive and variable incomes add nothing.
    fromIncomeTemplate(income({ id: 3, suggestedAmount: 9000, active: false })),
    fromIncomeTemplate(income({ id: 4, suggestedAmount: null })),
  ];
  const expenses = [
    fromExpenseTemplate(expense({ id: 1, suggestedAmount: 8000, appliesSecondFortnight: true })),
    fromExpenseTemplate(expense({ id: 2, suggestedAmount: 1500 })),
    fromExpenseTemplate(expense({ id: 3, suggestedAmount: 30000, appliesFirstFortnight: false, appliesSecondFortnight: true })),
    fromExpenseTemplate(expense({ id: 4, suggestedAmount: 700, active: false })),
    fromExpenseTemplate(expense({ id: 5, suggestedAmount: null })),
  ];

  it('is income minus expenses per quincena, both from summarize', () => {
    const net = netAfterExpenses(summarize(incomes), summarize(expenses));
    // 1ª: 20000 + 3000 - 8000 - 1500; 2ª: 20000 - 8000 - 30000.
    expect(net).toEqual({ first: 13500, second: -18000 });
  });

  it('equals the incomes when there are no gastos programados', () => {
    expect(netAfterExpenses(summarize(incomes), summarize([]))).toEqual({
      first: 23000,
      second: 20000,
    });
  });

  it('is null when the expense list failed to load, never 0', () => {
    expect(netAfterExpenses(summarize(incomes), null)).toBeNull();
  });
});
