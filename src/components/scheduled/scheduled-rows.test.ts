import { describe, expect, it } from 'vitest';
import type {
  ExpenseTemplateListItem,
  IncomeTemplateListItem,
} from '@/types/catalog';
import {
  chipCounts,
  countLine,
  expenseRows,
  filterRows,
  incomeRows,
  matchesQuery,
  mobileLine,
  programadosCount,
  splitPercent,
  subscriptionsCount,
  whenText,
} from './scheduled-rows';
import { ownerContextFromSearchParams } from './owner-context';

// Fixtures only: made-up names, wallets and whole-number figures.
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
  appliesSecondFortnight: false,
  active: true,
  userId: null,
  userName: null,
  ...overrides,
});

const [oneExpense] = expenseRows([expense()]);

describe('expenseRows and incomeRows', () => {
  it('maps category and wallet of an expense', () => {
    expect(oneExpense.detail).toBe('Hogar');
    expect(oneExpense.walletName).toBe('Débito demo');
    expect(oneExpense.item.kind).toBe('expense');
  });

  it('names the income wallet from the wallet list and joins category and source', () => {
    const [row] = incomeRows(
      [income({ walletId: 7, categoryName: 'Salario', source: 'Empresa demo' })],
      [{ id: 7, name: 'Cuenta demo', provider_icon_key: null }],
    );
    expect(row.walletName).toBe('Cuenta demo');
    expect(row.detail).toBe('Salario · Empresa demo');
  });

  it('leaves the wallet empty when the income has none or it is unknown', () => {
    const rows = incomeRows([income(), income({ id: 2, walletId: 99 })], []);
    expect(rows.map((r) => r.walletName)).toEqual([null, null]);
    expect(rows[0].detail).toBeNull();
  });
});

describe('search and chips', () => {
  const rows = expenseRows([
    expense({ id: 1, name: 'Electricidad', category: 'Vivienda' }),
    expense({ id: 2, name: 'Música', isSubscription: true }),
    expense({ id: 3, name: 'Gasolina', suggestedAmount: null }),
    expense({ id: 4, name: 'Viejo', active: false, isSubscription: true }),
  ]);

  it('matches name, category and wallet without accents or case', () => {
    expect(matchesQuery(rows[1], 'musica')).toBe(true);
    expect(matchesQuery(rows[0], 'VIVIENDA')).toBe(true);
    expect(matchesQuery(rows[0], 'debito')).toBe(true);
    expect(matchesQuery(rows[0], 'renta')).toBe(false);
    expect(matchesQuery(rows[0], '   ')).toBe(true);
  });

  it('filters by subscription and by variable amount together with the query', () => {
    const ids = (f: Parameters<typeof filterRows>[1]) =>
      filterRows(rows, f).map((r) => r.item.id);
    expect(ids({ query: '', subscriptionsOnly: true, variableOnly: false })).toEqual([2, 4]);
    expect(ids({ query: '', subscriptionsOnly: false, variableOnly: true })).toEqual([3]);
    expect(ids({ query: 'gas', subscriptionsOnly: false, variableOnly: false })).toEqual([3]);
  });

  it('counts chips over active items only', () => {
    expect(chipCounts(rows)).toEqual({ subscriptions: 1, variable: 1 });
    expect(programadosCount(rows)).toBe(3);
    expect(subscriptionsCount(rows)).toBe(1);
  });
});

describe('whenText and mobileLine', () => {
  const both = expenseRows([
    expense({
      appliesFirstFortnight: true,
      appliesSecondFortnight: true,
      dueDayFirst: 12,
      dueDaySecond: 26,
    }),
  ])[0];

  it('says the day inside a quincena view', () => {
    expect(whenText(both.item, 'first')).toBe('Día 12');
    expect(whenText(both.item, 'second')).toBe('Día 26');
    expect(mobileLine(both, 'first')).toBe('Día 12 · Débito demo');
  });

  it('lists both quincenas in Todas', () => {
    expect(whenText(both.item, 'all')).toBe('1ª · día 12, 2ª · día 26');
  });

  it('says Sin día fijo, Sin fecha and Sin billetera', () => {
    expect(whenText(oneExpense.item, 'first')).toBe('Sin día fijo');
    const [none] = expenseRows([
      expense({ appliesFirstFortnight: false, paymentMethod: null }),
    ]);
    expect(mobileLine(none, 'all')).toBe('Sin fecha · Sin billetera');
  });

  it('uses quincena words for incomes', () => {
    const [row] = incomeRows([income({ appliesSecondFortnight: true })], []);
    expect(whenText(row.item, 'all')).toBe('1ª y 2ª quincena');
    expect(whenText(row.item, 'second')).toBe('2ª quincena');
  });
});

describe('countLine and splitPercent', () => {
  it('says how many are variable', () => {
    expect(countLine('expense', 8, 1)).toBe('8 gastos · 1 con monto variable');
    expect(countLine('income', 1, 0)).toBe('1 ingreso');
    expect(countLine('expense', 8, 1, true)).toBe('8 gastos · 1 variable');
  });

  it('splits the month into shares that add to 100', () => {
    expect(splitPercent(3500, 2500)).toEqual({ first: 58, second: 42 });
    expect(splitPercent(1, 2)).toEqual({ first: 33, second: 67 });
    expect(splitPercent(0, 0)).toBeNull();
  });
});

describe('ownerContextFromSearchParams', () => {
  it('reads a house or user context and ignores anything else', () => {
    expect(ownerContextFromSearchParams({ ownerType: 'house', ownerId: '1' })).toEqual({
      ownerType: 'house',
      ownerId: 1,
    });
    expect(ownerContextFromSearchParams({ ownerType: 'team', ownerId: '1' })).toBeUndefined();
    expect(ownerContextFromSearchParams({ ownerType: 'user', ownerId: 'x' })).toBeUndefined();
    expect(ownerContextFromSearchParams({})).toBeUndefined();
  });
});
