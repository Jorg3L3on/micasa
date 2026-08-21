import { describe, expect, it } from 'vitest';
import {
  getAccountLiveFigures,
  sortAccountsToday,
} from '@/components/wallets/liquidity/liquidity-accounts-today';
import type { WalletListItem } from '@/types/catalog';

const wallet = (
  overrides: Partial<WalletListItem> & Pick<WalletListItem, 'id' | 'name' | 'type' | 'amount'>,
): WalletListItem => ({
  provider_icon_key: null,
  active: true,
  include_in_liquidity: true,
  cutoff_day: null,
  due_day: null,
  spent_amount: 0,
  remaining_amount: 0,
  assignee_user_id: null,
  assignee: null,
  ...overrides,
});

describe('getAccountLiveFigures', () => {
  it('shows cash and debit as free balance with no debt', () => {
    expect(
      getAccountLiveFigures({ type: 'CASH', amount: 1200 }),
    ).toEqual({
      isCredit: false,
      debt: null,
      free: 1200,
      utilizationPct: null,
      isUnrated: false,
    });
    expect(
      getAccountLiveFigures({ type: 'DEBIT_CARD', amount: 80 }),
    ).toMatchObject({ isCredit: false, debt: null, free: 80 });
  });

  it('splits credit into debt and remaining limit', () => {
    expect(
      getAccountLiveFigures({
        type: 'CREDIT_CARD',
        amount: 4000,
        credit_limit: 10000,
      }),
    ).toEqual({
      isCredit: true,
      debt: 4000,
      free: 6000,
      utilizationPct: 40,
      isUnrated: false,
    });
  });

  it('uses the higher of contractual and temporary credit limits', () => {
    expect(
      getAccountLiveFigures({
        type: 'CREDIT_CARD',
        amount: 2000,
        credit_limit: 5000,
        temporary_credit_limit: 8000,
      }),
    ).toMatchObject({ debt: 2000, free: 6000, utilizationPct: 25 });
  });

  it('shows em-dash figures when a card has no limit', () => {
    expect(
      getAccountLiveFigures({ type: 'DEPARTMENT_STORE_CARD', amount: 900 }),
    ).toEqual({
      isCredit: true,
      debt: 900,
      free: null,
      utilizationPct: null,
      isUnrated: true,
    });
  });
});

describe('sortAccountsToday', () => {
  it('keeps cash, then debit, then cards, and skips inactive wallets', () => {
    const sorted = sortAccountsToday([
      wallet({ id: 1, name: 'Visa', type: 'CREDIT_CARD', amount: 1 }),
      wallet({ id: 2, name: 'Efectivo', type: 'CASH', amount: 2 }),
      wallet({ id: 3, name: 'Old', type: 'CASH', amount: 3, active: false }),
      wallet({ id: 4, name: 'Banorte', type: 'DEBIT_CARD', amount: 4 }),
    ]);
    expect(sorted.map((row) => row.name)).toEqual(['Efectivo', 'Banorte', 'Visa']);
  });
});
