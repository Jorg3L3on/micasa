import { describe, expect, it } from 'vitest';
import {
  buildFirstStepsItems,
  firstNameOf,
  firstStepsDismissKey,
  firstStepsSubtitle,
  firstStepsTitle,
  isAccountWithinFirstStepsWindow,
  readFirstStepsDismissed,
  shouldShowFirstSteps,
  writeFirstStepsDismissed,
  type FirstStepsFacts,
  type FirstStepsStorage,
} from './first-steps';

const NOW = new Date('2026-11-15T18:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

const facts = (overrides: Partial<FirstStepsFacts> = {}): FirstStepsFacts => ({
  userId: 7,
  firstName: 'Mariana',
  onboardingCompleted: true,
  accountCreatedAt: new Date(NOW.getTime() - DAY),
  hasPaidExpense: false,
  hasExpenseTemplates: true,
  hasCreditCard: false,
  hasHouseGuest: false,
  ...overrides,
});

const show = (f: FirstStepsFacts, dismissed = false) =>
  shouldShowFirstSteps({ facts: f, items: buildFirstStepsItems(f), now: NOW, dismissed });

const memoryStorage = (): FirstStepsStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
};

const throwingStorage: FirstStepsStorage = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
};

describe('buildFirstStepsItems', () => {
  it('lists the four items of a fresh account, only the first one done', () => {
    const items = buildFirstStepsItems(facts());
    expect(items.map((i) => [i.id, i.done])).toEqual([
      ['account', true],
      ['paid-expense', false],
      ['credit-card', false],
      ['invite', false],
    ]);
    expect(items.map((i) => i.label)).toEqual([
      'Cuenta y quincenas creadas',
      'Marca un gasto como pagado',
      'Agrega tu tarjeta de crédito',
      'Invita a alguien a tu casa',
    ]);
    expect(items[0].href).toBeNull();
    expect(items[1].href).toBe('#panel-gastos');
  });

  it('marks items done from data', () => {
    const items = buildFirstStepsItems(
      facts({ hasPaidExpense: true, hasCreditCard: true, hasHouseGuest: true }),
    );
    expect(items.every((i) => i.done)).toBe(true);
  });

  it('asks for fixed expenses when Gastos fijos was skipped', () => {
    const items = buildFirstStepsItems(facts({ hasExpenseTemplates: false }), '?ownerType=user&ownerId=7');
    expect(items[1]).toEqual({
      id: 'fixed-expenses',
      label: 'Agrega tus gastos fijos',
      done: false,
      href: '/settings/expense-templates?ownerType=user&ownerId=7',
    });
    expect(items[2].href).toBe('/credit-cards?ownerType=user&ownerId=7');
  });

  it('goes back to the paid item once something was paid, even without templates', () => {
    const items = buildFirstStepsItems(facts({ hasExpenseTemplates: false, hasPaidExpense: true }));
    expect(items[1]).toMatchObject({ id: 'paid-expense', done: true });
  });
});

describe('shouldShowFirstSteps', () => {
  it('shows for a new account with items left', () => {
    expect(show(facts())).toBe(true);
  });

  it('hides when dismissed (Ocultar)', () => {
    expect(show(facts(), true)).toBe(false);
  });

  it('hides when every item is done', () => {
    expect(show(facts({ hasPaidExpense: true, hasCreditCard: true, hasHouseGuest: true }))).toBe(false);
  });

  it('hides before onboarding is complete', () => {
    expect(show(facts({ onboardingCompleted: false }))).toBe(false);
  });

  it('hides for accounts 30 days old or more', () => {
    expect(show(facts({ accountCreatedAt: new Date(NOW.getTime() - 29 * DAY) }))).toBe(true);
    expect(show(facts({ accountCreatedAt: new Date(NOW.getTime() - 30 * DAY) }))).toBe(false);
    expect(show(facts({ accountCreatedAt: new Date('2025-01-01T00:00:00.000Z') }))).toBe(false);
  });

  it('treats a creation date slightly in the future as new', () => {
    expect(isAccountWithinFirstStepsWindow(new Date(NOW.getTime() + 6 * 60 * 60 * 1000), NOW)).toBe(true);
  });
});

describe('copy', () => {
  it('greets by first name and counts done items', () => {
    expect(firstStepsTitle('Mariana')).toBe('Tu quincena está lista, Mariana');
    expect(firstStepsTitle(null)).toBe('Tu quincena está lista');
    expect(firstStepsSubtitle(buildFirstStepsItems(facts()))).toBe('Primeros pasos · 1 de 4');
    expect(firstStepsSubtitle(buildFirstStepsItems(facts({ hasCreditCard: true })))).toBe(
      'Primeros pasos · 2 de 4',
    );
  });

  it('takes the first word of the account name', () => {
    expect(firstNameOf('  Mariana  López ')).toBe('Mariana');
    expect(firstNameOf('')).toBeNull();
    expect(firstNameOf(null)).toBeNull();
  });
});

describe('dismissal storage', () => {
  it('is keyed by user id', () => {
    const storage = memoryStorage();
    expect(writeFirstStepsDismissed(storage, 7)).toBe(true);
    expect(storage.data.get(firstStepsDismissKey(7))).toBe('1');
    expect(readFirstStepsDismissed(storage, 7)).toBe(true);
    expect(readFirstStepsDismissed(storage, 8)).toBe(false);
  });

  it('tolerates a missing or throwing storage', () => {
    expect(readFirstStepsDismissed(null, 7)).toBe(false);
    expect(writeFirstStepsDismissed(null, 7)).toBe(false);
    expect(readFirstStepsDismissed(throwingStorage, 7)).toBe(false);
    expect(writeFirstStepsDismissed(throwingStorage, 7)).toBe(false);
  });
});
