import { describe, expect, it } from 'vitest';
import { sumLoanOutstandingByWallet } from './wallet-loan-outstanding';

const loan = (
  overrides: Partial<Parameters<typeof sumLoanOutstandingByWallet>[0][number]>,
) => ({
  status: 'ACTIVE' as const,
  sourceWalletId: null,
  linkedWalletId: null,
  remainingAmount: 0,
  ...overrides,
});

describe('sumLoanOutstandingByWallet', () => {
  it('counts a loan for both its linked wallet and its payment source', () => {
    const totals = sumLoanOutstandingByWallet([
      loan({ linkedWalletId: 1, remainingAmount: 1000 }),
      loan({ sourceWalletId: 2, remainingAmount: 500 }),
    ]);
    expect(totals.get(1)).toBe(1000);
    expect(totals.get(2)).toBe(500);
  });

  it('counts a loan once when it is both linked to and paid from the same wallet', () => {
    const totals = sumLoanOutstandingByWallet([
      loan({ linkedWalletId: 1, sourceWalletId: 1, remainingAmount: 800 }),
    ]);
    expect(totals.get(1)).toBe(800);
  });

  it('adds several loans on one wallet', () => {
    const totals = sumLoanOutstandingByWallet([
      loan({ linkedWalletId: 1, remainingAmount: 300 }),
      loan({ sourceWalletId: 1, remainingAmount: 200 }),
    ]);
    expect(totals.get(1)).toBe(500);
  });

  it('ignores loans that are not active or have nothing left', () => {
    const totals = sumLoanOutstandingByWallet([
      loan({ status: 'PAID_OFF', linkedWalletId: 1, remainingAmount: 900 }),
      loan({ status: 'CANCELLED', linkedWalletId: 1, remainingAmount: 900 }),
      loan({ linkedWalletId: 1, remainingAmount: 0 }),
    ]);
    expect(totals.has(1)).toBe(false);
  });
});
