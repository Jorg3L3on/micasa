import { describe, expect, it } from 'vitest';
import { walletsAreValid } from './StepWallets';
import { incomesAreValid } from './StepIncomeTemplates';
import type {
  IncomeTemplateDraft,
  WalletDraft,
} from '@/components/onboarding/OnboardingContext';

const wallet = (patch: Partial<WalletDraft>): WalletDraft => ({
  id: Math.random().toString(36).slice(2),
  name: 'Billetera',
  type: 'CASH',
  providerIconKey: null,
  initialBalance: 0,
  creditLimit: 0,
  cutoffDay: null,
  dueDay: null,
  ...patch,
});

const income = (patch: Partial<IncomeTemplateDraft>): IncomeTemplateDraft => ({
  id: 'i1',
  name: 'Sueldo',
  amount: 18500,
  walletId: 'w1',
  source: '',
  appliesFirstFortnight: true,
  appliesSecondFortnight: true,
  ...patch,
});

describe('walletsAreValid', () => {
  const cash = wallet({ type: 'CASH', name: 'Efectivo' });
  const debit = wallet({ type: 'BANK', name: 'Nómina BBVA' });

  it('needs one cash and one debit wallet, all named', () => {
    expect(walletsAreValid([cash, debit])).toBe(true);
    expect(walletsAreValid([])).toBe(false);
    expect(walletsAreValid([cash])).toBe(false);
    expect(walletsAreValid([debit])).toBe(false);
    expect(walletsAreValid([cash, { ...debit, name: '  ' }])).toBe(false);
  });

  it('needs línea and both statement days on a credit card', () => {
    const card = wallet({ type: 'CREDIT', name: 'Tarjeta Oro' });
    expect(walletsAreValid([cash, debit, card])).toBe(false);
    expect(walletsAreValid([cash, debit, { ...card, creditLimit: 20000 }])).toBe(false);
    expect(
      walletsAreValid([cash, debit, { ...card, creditLimit: 20000, cutoffDay: 3, dueDay: 23 }]),
    ).toBe(true);
    expect(
      walletsAreValid([cash, debit, { ...card, creditLimit: 20000, cutoffDay: 32, dueDay: 23 }]),
    ).toBe(false);
  });
});

describe('incomesAreValid', () => {
  it('needs a name, a positive amount and a wallet on every income', () => {
    expect(incomesAreValid([income({})])).toBe(true);
    expect(incomesAreValid([])).toBe(false);
    expect(incomesAreValid([income({ name: ' ' })])).toBe(false);
    expect(incomesAreValid([income({ amount: 0 })])).toBe(false);
    expect(incomesAreValid([income({ amount: Number.NaN })])).toBe(false);
    expect(incomesAreValid([income({ walletId: '' })])).toBe(false);
    expect(incomesAreValid([income({}), income({ id: 'i2', amount: 0 })])).toBe(false);
  });
});
