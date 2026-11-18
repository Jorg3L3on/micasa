import { describe, expect, it } from 'vitest';
import {
  BANK_CHIP_GROUPS,
  COMMON_BANK_KEYS,
  INCOME_WHEN_CHIPS,
  isMoreBankKey,
  monthlyIncomeEquivalent,
} from './onboarding-rows';
import { WALLET_PROVIDER_ICON_OPTIONS } from '@/lib/wallet-provider-icons';

describe('BANK_CHIP_GROUPS', () => {
  it('lists the common banks first, in order, from the provider catalog', () => {
    expect(BANK_CHIP_GROUPS.common.map((option) => option.key)).toEqual([
      ...COMMON_BANK_KEYS,
    ]);
  });

  it('puts every other real provider behind "Más bancos", never cash or the generic bank', () => {
    const shown = [...BANK_CHIP_GROUPS.common, ...BANK_CHIP_GROUPS.more].map(
      (option) => option.key,
    );
    const expected = WALLET_PROVIDER_ICON_OPTIONS.map((option) => option.key).filter(
      (key) => key !== 'CASH_GENERIC' && key !== 'GENERIC_BANK',
    );
    expect([...shown].sort()).toEqual([...expected].sort());
    expect(new Set(shown).size).toBe(shown.length);
  });

  it('opens the extra banks only for a provider among them', () => {
    expect(isMoreBankKey('AMEX')).toBe(true);
    expect(isMoreBankKey('BBVA')).toBe(false);
    expect(isMoreBankKey(null)).toBe(false);
    expect(isMoreBankKey('GENERIC_BANK')).toBe(false);
  });
});

describe('monthlyIncomeEquivalent', () => {
  it('doubles an amount received both fortnights', () => {
    expect(monthlyIncomeEquivalent(18500, 'BOTH')).toBe(37000);
  });

  it('keeps the amount when it arrives in one fortnight', () => {
    expect(monthlyIncomeEquivalent(18500, 'FIRST')).toBe(18500);
    expect(monthlyIncomeEquivalent(18500, 'SECOND')).toBe(18500);
  });

  it('is zero for empty or invalid amounts', () => {
    expect(monthlyIncomeEquivalent(0, 'BOTH')).toBe(0);
    expect(monthlyIncomeEquivalent(-5, 'BOTH')).toBe(0);
    expect(monthlyIncomeEquivalent(Number.NaN, 'BOTH')).toBe(0);
  });
});

it('offers the three "¿Cuándo lo recibes?" chips', () => {
  expect(INCOME_WHEN_CHIPS.map((chip) => chip.label)).toEqual([
    'Las dos quincenas',
    'Solo la 1ª',
    'Solo la 2ª',
  ]);
});
