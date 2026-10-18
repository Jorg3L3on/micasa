import { describe, expect, it } from 'vitest';
import { onboardingCompleteSchema } from '@/schemas/onboarding.schema';

const wallet = (id: string, type: 'CASH' | 'BANK' | 'CREDIT' = 'BANK') => ({
  id,
  name: `Billetera ${id}`,
  type,
  providerIconKey: null,
});

const income = {
  id: 'i1',
  name: 'Sueldo',
  amount: 15000,
  walletId: 'w2',
  appliesFirstFortnight: true,
  appliesSecondFortnight: true,
};

const expense = {
  id: 'e1',
  name: 'Renta',
  amount: 6000,
  categoryId: '12',
  walletId: 'w2',
  isRecurring: true,
  appliesFirstFortnight: true,
  appliesSecondFortnight: false,
};

const base = {
  wallets: [wallet('w1', 'CASH'), wallet('w2')],
  incomeTemplates: [income],
  expenseTemplates: [expense],
  startDate: '2026-10-01',
};

describe('onboardingCompleteSchema', () => {
  it('accepts a complete draft and defaults balance and source', () => {
    const result = onboardingCompleteSchema.parse(base);
    expect(result.wallets[0].initialBalance).toBe(0);
    expect(result.incomeTemplates[0].source).toBe('');
  });

  it('accepts zero expense templates (the step is skippable)', () => {
    expect(
      onboardingCompleteSchema.safeParse({ ...base, expenseTemplates: [] }).success,
    ).toBe(true);
  });

  it('rejects a template that points at an unknown wallet', () => {
    const result = onboardingCompleteSchema.safeParse({
      ...base,
      expenseTemplates: [{ ...expense, walletId: 'missing' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a zero amount and a blank name', () => {
    expect(
      onboardingCompleteSchema.safeParse({
        ...base,
        incomeTemplates: [{ ...income, amount: 0 }],
      }).success,
    ).toBe(false);
    expect(
      onboardingCompleteSchema.safeParse({
        ...base,
        wallets: [{ ...wallet('w1', 'CASH'), name: '  ' }, wallet('w2')],
      }).success,
    ).toBe(false);
  });

  it('rejects an income that applies to no fortnight', () => {
    expect(
      onboardingCompleteSchema.safeParse({
        ...base,
        incomeTemplates: [
          { ...income, appliesFirstFortnight: false, appliesSecondFortnight: false },
        ],
      }).success,
    ).toBe(false);
  });

  it('requires a credit line and statement days for credit cards', () => {
    const credit = { ...wallet('w3', 'CREDIT') };
    expect(
      onboardingCompleteSchema.safeParse({ ...base, wallets: [...base.wallets, credit] })
        .success,
    ).toBe(false);
    expect(
      onboardingCompleteSchema.safeParse({
        ...base,
        wallets: [
          ...base.wallets,
          { ...credit, creditLimit: 20000, cutoffDay: 5, dueDay: 25 },
        ],
      }).success,
    ).toBe(true);
  });

  it('rejects an invalid start date', () => {
    expect(
      onboardingCompleteSchema.safeParse({ ...base, startDate: '2026-02-30' }).success,
    ).toBe(false);
  });
});
