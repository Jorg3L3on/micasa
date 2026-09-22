import { describe, expect, it } from 'vitest';
import {
  buildAccountsToday,
  getAccountLiveFigures,
  getLoanLiveFigures,
  getLoanProgressLabel,
  sortAccountsToday,
  toAccountTodayView,
} from '@/components/wallets/liquidity/liquidity-accounts-today';
import type { WalletListItem } from '@/types/catalog';
import type { LoanListItem } from '@/types/loans';

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

const loan = (
  overrides: Partial<LoanListItem> & Pick<LoanListItem, 'id' | 'name'>,
): LoanListItem => ({
  lender: 'Banamex',
  lenderId: 1,
  type: 'PERSONAL',
  status: 'ACTIVE',
  principalAmount: 10000,
  totalPayable: 10000,
  paymentAmount: 1000,
  paymentCount: 10,
  frequency: 'MONTHLY',
  startDate: '2026-03-01',
  paymentSource: 'WALLET',
  sourceWalletId: 1,
  sourceWalletName: 'Banamex',
  linkedWalletId: null,
  linkedWalletName: null,
  incomeTemplateId: null,
  incomeTemplateName: null,
  notes: null,
  paidAmount: 2000,
  remainingAmount: 8000,
  paidPayments: 2,
  remainingPayments: 8,
  nextPayment: null,
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

describe('getLoanLiveFigures', () => {
  it('shows remaining principal as debt and no free credit', () => {
    expect(
      getLoanLiveFigures({
        remainingAmount: 8000,
        totalPayable: 10000,
        principalAmount: 10000,
      }),
    ).toEqual({
      isCredit: true,
      debt: 8000,
      free: null,
      utilizationPct: 80,
      isUnrated: false,
    });
  });

  it('falls back to principal when total payable is missing', () => {
    expect(
      getLoanLiveFigures({
        remainingAmount: 2500,
        totalPayable: 0,
        principalAmount: 5000,
      }),
    ).toMatchObject({ debt: 2500, free: null, utilizationPct: 50 });
  });
});

describe('getLoanProgressLabel', () => {
  it('uses remaining cuotas and traffic-light tone', () => {
    expect(getLoanProgressLabel(12, 90)).toEqual({
      label: '12 cuotas',
      tone: 'destructive',
    });
    expect(getLoanProgressLabel(1, 20)).toEqual({
      label: '1 cuota',
      tone: 'emerald',
    });
    expect(getLoanProgressLabel(0, 10)).toEqual({
      label: 'Saldo pendiente',
      tone: 'muted',
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

describe('buildAccountsToday', () => {
  it('appends active loans after wallets and skips paid-off or paused ones', () => {
    const rows = buildAccountsToday(
      [wallet({ id: 1, name: 'Efectivo', type: 'CASH', amount: 20 })],
      [
        loan({ id: 2, name: 'Fonacot Jorge', type: 'PAYROLL', lender: 'FONACOT' }),
        loan({ id: 3, name: 'Viejo', status: 'PAID_OFF', remainingAmount: 0 }),
        loan({ id: 4, name: 'Pausado', status: 'PAUSED', remainingAmount: 4000 }),
        loan({ id: 5, name: 'Crédito auto Banamex' }),
      ],
    );

    expect(rows.map((row) => row.kind === 'wallet' ? row.wallet.name : row.loan.name)).toEqual([
      'Efectivo',
      'Crédito auto Banamex',
      'Fonacot Jorge',
    ]);
  });

  it('maps loan rows to remaining debt and Fonacot identity', () => {
    const [row] = buildAccountsToday(
      [],
      [loan({ id: 9, name: 'Fonacot Carmen', type: 'PAYROLL', lender: 'FONACOT' })],
    );
    expect(row).toBeDefined();
    const view = toAccountTodayView(row!);
    expect(view).toMatchObject({
      kind: 'loan',
      name: 'Fonacot Carmen',
      typeLabel: 'Préstamo de nómina',
      isFonacot: true,
      providerIconKey: null,
      figures: { debt: 8000, free: null, utilizationPct: 80 },
      badge: { label: '8 cuotas', tone: 'amber' },
    });
  });

  it('infers card logos from the wallet name when provider_icon_key is missing', () => {
    expect(
      toAccountTodayView({
        kind: 'wallet',
        wallet: wallet({ id: 1, name: 'BBVA Jorge', type: 'CASH', amount: 10 }),
      }).providerIconKey,
    ).toBe('BBVA');
    expect(
      toAccountTodayView({
        kind: 'wallet',
        wallet: wallet({ id: 2, name: 'DIDI Card', type: 'CREDIT_CARD', amount: 10 }),
      }).providerIconKey,
    ).toBe('DIDI');
    expect(
      toAccountTodayView({
        kind: 'wallet',
        wallet: wallet({ id: 3, name: 'C&A Departamental', type: 'DEPARTMENT_STORE_CARD', amount: 10 }),
      }).providerIconKey,
    ).toBe('CA');
    expect(
      toAccountTodayView({
        kind: 'wallet',
        wallet: wallet({ id: 4, name: 'Efectivo', type: 'CASH', amount: 10 }),
      }).providerIconKey,
    ).toBe('CASH_GENERIC');
    expect(
      toAccountTodayView({
        kind: 'wallet',
        wallet: wallet({
          id: 5,
          name: 'Otro',
          type: 'CREDIT_CARD',
          amount: 10,
          provider_icon_key: 'NU_BANK',
        }),
      }).providerIconKey,
    ).toBe('NU_BANK');
  });
});
