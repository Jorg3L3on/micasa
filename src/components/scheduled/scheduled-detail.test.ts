import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  ExpenseTemplateListItem,
  IncomeTemplateListItem,
} from '@/types/catalog';
import { setExpenseTemplateActive } from '@/lib/api/expense-templates';
import { setIncomeTemplateActive } from '@/lib/api/incomes';
import { cutoffHint, detailCaption, detailRows } from './scheduled-detail';
import { expenseRows, incomeRows } from './scheduled-rows';

// Fixtures only: made-up names, wallets and whole-number figures.
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
  cutoffDay: null,
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
  appliesSecondFortnight: true,
  active: true,
  userId: 3,
  userName: 'Persona demo',
  ...overrides,
});

const expenseRow = (overrides?: Partial<ExpenseTemplateListItem>) =>
  expenseRows([expense(overrides)])[0];
const incomeRow = (overrides?: Partial<IncomeTemplateListItem>) =>
  incomeRows([income(overrides)], [{ id: 7, name: 'Cuenta demo', provider_icon_key: null }])[0];

const labels = (rows: ReturnType<typeof detailRows>) => rows.map((r) => `${r.label}: ${r.value}`);

describe('detailCaption', () => {
  it('says per month and per year for one quincena', () => {
    expect(detailCaption(expenseRow())).toBe('al mes · $3,600.00 al año');
  });

  it('adds "por quincena" when it occurs in both', () => {
    expect(detailCaption(incomeRow())).toBe(
      'por quincena · $10,000.00 al mes · $120,000.00 al año',
    );
  });

  it('has no caption when the amount is variable', () => {
    expect(detailCaption(expenseRow({ suggestedAmount: null }))).toBeNull();
  });

  it('says Sin programar when it applies to no quincena', () => {
    expect(
      detailCaption(expenseRow({ appliesFirstFortnight: false, dueDayFirst: null, dueDay: null })),
    ).toBe('Sin programar · no se crea solo');
  });
});

describe('detailRows', () => {
  it('shows Corte from the card for an expense paid with a credit card', () => {
    const row = expenseRow();
    expect(labels(detailRows(row))).toEqual([
      'Categoría: Hogar',
      'Paga con: Tarjeta demo',
      '1ª quincena: Día 5',
      'Corte: Día 12',
    ]);
    expect(cutoffHint(row)).toBe('El corte se toma de Tarjeta demo.');
  });

  it('shows Corte for a store card too', () => {
    const rows = detailRows(expenseRow({ paymentMethodType: 'DEPARTMENT_STORE_CARD' }));
    expect(rows.some((r) => r.key === 'cutoff')).toBe(true);
  });

  it('has no Corte for a debit wallet, a card with no cutoff, or no wallet', () => {
    for (const overrides of [
      { paymentMethodType: 'DEBIT_CARD' as const },
      { paymentMethodCutoffDay: null },
      {
        paymentMethod: null,
        paymentMethodId: null,
        paymentMethodType: null,
        paymentMethodCutoffDay: null,
      },
    ]) {
      const row = expenseRow(overrides);
      expect(detailRows(row).some((r) => r.key === 'cutoff')).toBe(false);
      expect(cutoffHint(row)).toBeNull();
    }
  });

  it('omits rows with no value and says Sin día fijo for a quincena with no day', () => {
    const row = expenseRow({
      category: '',
      paymentMethod: null,
      paymentMethodType: null,
      paymentMethodCutoffDay: null,
      appliesSecondFortnight: true,
      dueDayFirst: null,
      dueDaySecond: 26,
      dueDay: 26,
    });
    expect(labels(detailRows(row))).toEqual(['1ª quincena: Sin día fijo', '2ª quincena: Día 26']);
  });

  it('uses the legacy due day in both quincenas', () => {
    const row = expenseRow({
      appliesSecondFortnight: true,
      dueDayFirst: null,
      dueDaySecond: null,
      dueDay: 7,
      paymentMethodType: 'CASH',
    });
    expect(labels(detailRows(row))).toContain('2ª quincena: Día 7');
  });

  it('lists Billetera, both quincenas, Origen and Aporta for an income', () => {
    expect(labels(detailRows(incomeRow()))).toEqual([
      'Categoría: Salario',
      'Billetera: Cuenta demo',
      '1ª quincena: Sí',
      '2ª quincena: Sí',
      'Origen: Empresa demo',
      'Aporta: Persona demo',
    ]);
  });

  it('omits Origen and Aporta when empty', () => {
    const rows = detailRows(incomeRow({ source: '  ', userName: null }));
    expect(rows.map((r) => r.key)).not.toContain('source');
    expect(rows.map((r) => r.key)).not.toContain('contributor');
  });
});

describe('Activo toggle requests', () => {
  const fetchMock = vi.fn();

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  const lastCall = () => {
    const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    return { url, method: init.method, body: JSON.parse(String(init.body)) };
  };

  it('sends only { active } for an expense (PATCH) and an income (partial PUT)', async () => {
    fetchMock.mockImplementation(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await setExpenseTemplateActive(1, false);
    expect(lastCall()).toMatchObject({ method: 'PATCH', body: { active: false } });
    expect(lastCall().url).toContain('/api/expense-templates?id=1');

    await setIncomeTemplateActive(2, true);
    expect(lastCall()).toMatchObject({ method: 'PUT', body: { active: true } });
    expect(lastCall().url).toContain('/api/income-templates?id=2');
  });
});
