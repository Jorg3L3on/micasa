import { describe, expect, it } from 'vitest';
import {
  clearOnboardingDraft,
  getBrowserDraftStorage,
  loadOnboardingDraft,
  onboardingDraftKey,
  saveOnboardingDraft,
  type DraftStorage,
} from '@/components/onboarding/onboarding-draft-storage';
import type {
  ExpenseTemplateDraft,
  IncomeTemplateDraft,
  WalletDraft,
} from '@/components/onboarding/OnboardingContext';

const TOTAL_STEPS = 4;

const memoryStorage = (): DraftStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
};

const throwingStorage: DraftStorage = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
  removeItem: () => {
    throw new Error('SecurityError');
  },
};

const wallet: WalletDraft = {
  id: 'w-debit',
  name: 'Nómina BBVA',
  type: 'BANK',
  providerIconKey: 'BBVA',
  initialBalance: 12340,
  creditLimit: 0,
  cutoffDay: null,
  dueDay: null,
};

const income: IncomeTemplateDraft = {
  id: 'i-sueldo',
  name: 'Sueldo',
  amount: 9250,
  walletId: 'w-debit',
  source: '',
  appliesFirstFortnight: true,
  appliesSecondFortnight: true,
};

const expense: ExpenseTemplateDraft = {
  id: 'e-renta',
  name: 'Renta',
  amount: 7500,
  categoryId: '12',
  walletId: 'w-debit',
  isRecurring: true,
  appliesFirstFortnight: true,
  appliesSecondFortnight: false,
};

const draft = {
  step: 2,
  wallets: [wallet],
  incomeTemplates: [income],
  expenseTemplates: [expense],
};

describe('onboarding draft storage', () => {
  it('saves and restores step, wallets, incomes and expenses', () => {
    const storage = memoryStorage();
    expect(saveOnboardingDraft(storage, '41', draft)).toBe(true);

    expect(loadOnboardingDraft(storage, '41', TOTAL_STEPS)).toEqual({
      version: 1,
      ...draft,
    });
  });

  it('keys the draft by user id, so another user does not see it', () => {
    const storage = memoryStorage();
    saveOnboardingDraft(storage, '41', draft);

    expect(onboardingDraftKey('41')).not.toBe(onboardingDraftKey('42'));
    expect(loadOnboardingDraft(storage, '42', TOTAL_STEPS)).toBeNull();
  });

  it('clears the draft for that user only', () => {
    const storage = memoryStorage();
    saveOnboardingDraft(storage, '41', draft);
    saveOnboardingDraft(storage, '42', { ...draft, step: 1 });

    clearOnboardingDraft(storage, '41');

    expect(loadOnboardingDraft(storage, '41', TOTAL_STEPS)).toBeNull();
    expect(loadOnboardingDraft(storage, '42', TOTAL_STEPS)?.step).toBe(1);
  });

  it('swallows a throwing storage on save, restore and clear', () => {
    expect(saveOnboardingDraft(throwingStorage, '41', draft)).toBe(false);
    expect(loadOnboardingDraft(throwingStorage, '41', TOTAL_STEPS)).toBeNull();
    expect(() => clearOnboardingDraft(throwingStorage, '41')).not.toThrow();
  });

  it('works without any storage', () => {
    expect(getBrowserDraftStorage()).toBeNull();
    expect(saveOnboardingDraft(null, '41', draft)).toBe(false);
    expect(loadOnboardingDraft(null, '41', TOTAL_STEPS)).toBeNull();
    expect(() => clearOnboardingDraft(null, '41')).not.toThrow();
  });

  it('ignores corrupt or foreign data and clamps the step', () => {
    const storage = memoryStorage();
    const key = onboardingDraftKey('41');

    storage.setItem(key, '{not json');
    expect(loadOnboardingDraft(storage, '41', TOTAL_STEPS)).toBeNull();

    storage.setItem(key, JSON.stringify({ version: 99, ...draft }));
    expect(loadOnboardingDraft(storage, '41', TOTAL_STEPS)).toBeNull();

    storage.setItem(key, JSON.stringify({ version: 1, ...draft, wallets: 'x' }));
    expect(loadOnboardingDraft(storage, '41', TOTAL_STEPS)).toBeNull();

    storage.setItem(key, JSON.stringify({ version: 1, ...draft, step: 9 }));
    expect(loadOnboardingDraft(storage, '41', TOTAL_STEPS)?.step).toBe(3);
  });
});
