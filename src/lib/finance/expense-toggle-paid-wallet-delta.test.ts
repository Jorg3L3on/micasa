import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  applyWalletAmountDelta,
  assertPaidChargeAllowedForWallet,
  getPaidExpenseWalletDelta,
  transactionFn,
} = vi.hoisted(() => ({
  applyWalletAmountDelta: vi.fn(),
  assertPaidChargeAllowedForWallet: vi.fn(),
  getPaidExpenseWalletDelta: vi.fn(
    (_type: string, amount: number) => -Math.abs(amount),
  ),
  transactionFn: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    $transaction: transactionFn,
  },
}));

vi.mock('@/lib/finance/wallet-accounting', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/finance/wallet-accounting')>();
  return {
    ...actual,
    applyWalletAmountDelta,
    assertPaidChargeAllowedForWallet,
    getPaidExpenseWalletDelta,
  };
});

import { toggleExpensePaid } from '@/lib/finance/expense.service';

describe('toggleExpensePaid applyWalletDelta', () => {
  const expenseFindFirst = vi.fn();
  const transferFindFirst = vi.fn();
  const cardPaymentFindFirst = vi.fn();
  const walletFindUnique = vi.fn();
  const expenseUpdate = vi.fn();

  const unpaidExpense = {
    id: 12,
    amount: 1200,
    is_paid: false,
    wallet_id: 20,
    description: 'Leonardo',
    payment_date: null,
    created_at: new Date('2026-09-23T12:00:00.000Z'),
    category: { name: 'Servicios', icon: null },
    wallet: { id: 20, name: 'Banamex', type: 'DEBIT_CARD' },
    loan_payment: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getPaidExpenseWalletDelta.mockImplementation(
      (_type: string, amount: number) => -Math.abs(amount),
    );
    expenseFindFirst.mockResolvedValue(unpaidExpense);
    transferFindFirst.mockResolvedValue(null);
    cardPaymentFindFirst.mockResolvedValue(null);
    walletFindUnique.mockResolvedValue({
      type: 'DEBIT_CARD',
      amount: 400,
      credit_limit: null,
      temporary_credit_limit: null,
    });
    expenseUpdate.mockResolvedValue({
      ...unpaidExpense,
      is_paid: true,
      wallet: { name: 'Banamex', type: 'DEBIT_CARD' },
    });

    transactionFn.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        expense: {
          findFirst: expenseFindFirst,
          update: expenseUpdate,
        },
        transfer: { findFirst: transferFindFirst },
        creditCardPayment: { findFirst: cardPaymentFindFirst },
        wallet: { findUnique: walletFindUnique },
      };
      return fn(tx);
    });
  });

  it('debits the wallet by default when marking paid', async () => {
    await toggleExpensePaid({
      id: 12,
      paid: true,
      ownerFilter: { user_id: 1, house_id: null },
    });

    expect(assertPaidChargeAllowedForWallet).toHaveBeenCalled();
    expect(applyWalletAmountDelta).toHaveBeenCalledWith(
      expect.anything(),
      20,
      -1200,
    );
  });

  it('skips debit and balance assert when applyWalletDelta is false', async () => {
    await toggleExpensePaid({
      id: 12,
      paid: true,
      ownerFilter: { user_id: 1, house_id: null },
      applyWalletDelta: false,
    });

    expect(expenseUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ is_paid: true }),
      }),
    );
    expect(assertPaidChargeAllowedForWallet).not.toHaveBeenCalled();
    expect(applyWalletAmountDelta).not.toHaveBeenCalled();
  });
});
