import { describe, expect, it } from 'vitest';
import type {
  ExpenseTemplateDraft,
  IncomeTemplateDraft,
  WalletDraft,
} from '@/components/onboarding/OnboardingContext';
import { computeOnboardingPreview } from '@/components/onboarding/onboarding-preview';
import {
  firstName,
  formatQuincenaRange,
  shortList,
  summaryGroups,
  summaryQuincenaTiles,
  summaryTitle,
  todayQuincenaCaption,
  upcomingFortnights,
} from './onboarding-summary';
import { parseCalendarDate } from '@/lib/calendar-dates';

const wallet = (patch: Partial<WalletDraft>): WalletDraft => ({
  id: 'w',
  name: 'Billetera',
  type: 'CASH',
  providerIconKey: null,
  initialBalance: 0,
  creditLimit: 0,
  cutoffDay: null,
  dueDay: null,
  ...patch,
});

const income = (patch: Partial<IncomeTemplateDraft> = {}): IncomeTemplateDraft => ({
  id: 'i1',
  name: 'Sueldo',
  amount: 18500,
  walletId: 'w2',
  source: '',
  appliesFirstFortnight: true,
  appliesSecondFortnight: true,
  ...patch,
});

const expense = (
  name: string,
  amount: number,
  when: 'FIRST' | 'SECOND' | 'BOTH',
): ExpenseTemplateDraft => ({
  id: name,
  name,
  amount,
  categoryId: '1',
  walletId: 'w2',
  isRecurring: true,
  appliesFirstFortnight: when !== 'SECOND',
  appliesSecondFortnight: when !== 'FIRST',
});

// The canvas example: Renta 1ª, Súper both, Internet and Luz 2ª.
const drafts = {
  wallets: [
    wallet({ id: 'w1', name: 'Efectivo', initialBalance: 640 }),
    wallet({ id: 'w2', name: 'Nómina BBVA', type: 'BANK', initialBalance: 12500 }),
    wallet({ id: 'w3', name: 'Tarjeta Oro', type: 'CREDIT', creditLimit: 20000 }),
  ],
  incomeTemplates: [income()],
  expenseTemplates: [
    expense('Renta', 7500, 'FIRST'),
    expense('Súper', 2400, 'BOTH'),
    expense('Internet', 599, 'SECOND'),
    expense('Luz', 450, 'SECOND'),
  ],
};

describe('upcomingFortnights', () => {
  it('starts with the quincena in progress', () => {
    const [a, b] = upcomingFortnights('2026-11-01', '2026-11-15');
    expect([a.period, a.month, b.period, b.month]).toEqual(['SECOND', 11, 'FIRST', 12]);
    expect(upcomingFortnights('2026-11-01', '2026-11-03')[0].period).toBe('FIRST');
  });

  it('puts the last day of the month in the 1ª of the next month', () => {
    const [a] = upcomingFortnights('2026-11-01', '2026-11-30');
    expect([a.period, a.month]).toEqual(['FIRST', 12]);
  });
});

describe('summaryQuincenaTiles', () => {
  it('leads with the free amount of the next two quincenas from computeOnboardingPreview', () => {
    const preview = computeOnboardingPreview(drafts);
    const tiles = summaryQuincenaTiles(drafts, '2026-11-01', '2026-11-15');
    expect(tiles).toHaveLength(2);
    expect(tiles[0].preview).toEqual(preview.second);
    expect(tiles[1].preview).toEqual(preview.first);
    expect(tiles.map((tile) => tile.preview.free)).toEqual([15051, 8600]);
    expect(tiles.map((tile) => tile.barPercent)).toEqual([19, 54]);
    expect(tiles[0].title).toBe('2ª quincena · 15 – 29 nov');
    expect(tiles[1].title).toBe('1ª quincena · 30 nov – 14 dic');
    expect(tiles[0].ariaLabel).toBe('Segunda quincena de noviembre');
    expect(tiles[1].ariaLabel).toBe('Primera quincena de diciembre');
  });
});

describe('formatQuincenaRange', () => {
  it('drops the repeated month inside one month', () => {
    expect(
      formatQuincenaRange(parseCalendarDate('2026-11-15'), parseCalendarDate('2026-11-29')),
    ).toBe('15 – 29 nov');
  });
});

describe('todayQuincenaCaption', () => {
  it('names the quincena today falls in', () => {
    expect(todayQuincenaCaption('2026-11-01', '2026-11-15')).toBe(
      'Hoy empiezas en la 2ª de noviembre.',
    );
    expect(todayQuincenaCaption('2026-11-01', '2026-11-30')).toBe(
      'Hoy empiezas en la 1ª de diciembre.',
    );
  });
});

describe('summary title', () => {
  it('greets by first name and falls back without one', () => {
    expect(firstName('  Mariana López ')).toBe('Mariana');
    expect(summaryTitle('Mariana López')).toBe('Esto te queda libre, Mariana');
    expect(summaryTitle(null)).toBe('Esto te queda libre');
    expect(summaryTitle('   ')).toBe('Esto te queda libre');
  });
});

describe('summaryGroups', () => {
  it('one row per group with a short list and a total', () => {
    const [wallets, incomes, expenses] = summaryGroups(drafts);
    expect(wallets).toMatchObject({
      key: 'wallets',
      title: '3 billeteras',
      subtitle: 'Efectivo, Nómina BBVA, Tarjeta Oro',
      total: 13140,
    });
    expect(incomes).toMatchObject({
      key: 'incomes',
      title: '1 ingreso',
      subtitle: 'Sueldo, cada quincena',
      total: 37000,
      totalSuffix: 'al mes',
    });
    expect(expenses).toMatchObject({
      key: 'expenses',
      title: '4 gastos fijos',
      subtitle: 'Renta, Súper, Internet y 1 más',
      total: 13349,
      totalSuffix: 'al mes',
    });
  });

  it('shows "Sin gastos fijos" without a total after Omitir', () => {
    const [, , expenses] = summaryGroups({ ...drafts, expenseTemplates: [] });
    expect(expenses).toMatchObject({ title: 'Sin gastos fijos', total: null });
  });

  it('singular and frequency copy', () => {
    const [w, i, e] = summaryGroups({
      wallets: [drafts.wallets[0]],
      incomeTemplates: [income({ appliesSecondFortnight: false })],
      expenseTemplates: [expense('Renta', 7500, 'FIRST')],
    });
    expect(w.title).toBe('1 billetera');
    expect(i.subtitle).toBe('Sueldo, la 1ª quincena');
    expect(i.total).toBe(18500);
    expect(e.title).toBe('1 gasto fijo');
  });
});

describe('shortList', () => {
  it('skips blank names', () => {
    expect(shortList(['Efectivo', ' ', 'BBVA'])).toBe('Efectivo, BBVA');
  });
});
