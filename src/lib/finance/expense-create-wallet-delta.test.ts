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

import { createExpense } from '@/lib/finance/expense.service';

describe('createExpense applyWalletDelta', () => {
  const categoryFindUnique = vi.fn();
  const fortnightFindUnique = vi.fn();
  const walletFindUnique = vi.fn();
  const expenseCreate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getPaidExpenseWalletDelta.mockImplementation(
      (_type: string, amount: number) => -Math.abs(amount),
    );

    categoryFindUnique.mockResolvedValue({ id: 10, name: 'Salud' });
    fortnightFindUnique.mockResolvedValue({
      id: 5,
      user_id: 1,
      house_id: null,
      period: 'FIRST',
    });
    walletFindUnique.mockResolvedValue({
      id: 20,
      user_id: 1,
      house_id: null,
      type: 'DEBIT_CARD',
      amount: 5000,
      credit_limit: null,
      temporary_credit_limit: null,
    });
    expenseCreate.mockResolvedValue({
      id: 99,
      description: 'Doctor',
      amount: 2500,
      is_paid: true,
      payment_date: new Date('2026-09-26T12:00:00.000Z'),
      created_at: new Date('2026-09-26T12:00:00.000Z'),
      wallet_id: 20,
      category: { name: 'Salud', icon: null },
      wallet: { id: 20, name: 'BBVA' },
    });

    transactionFn.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        category: { findUnique: categoryFindUnique },
        fortnight: { findUnique: fortnightFindUnique },
        wallet: { findUnique: walletFindUnique },
        expense: { create: expenseCreate },
        expenseTemplate: { findUnique: vi.fn() },
      };
      return fn(tx);
    });
  });

  it('applies wallet delta by default when paid', async () => {
    await createExpense({
      fortnightId: 5,
      categoryId: 10,
      description: 'Doctor',
      amount: 2500,
      isPaid: true,
      paymentDate: '2026-09-26',
      walletId: 20,
    });

    expect(assertPaidChargeAllowedForWallet).toHaveBeenCalled();
    expect(applyWalletAmountDelta).toHaveBeenCalledWith(
      expect.anything(),
      20,
      -2500,
    );
  });

  it('skips wallet delta and balance assert when applyWalletDelta is false', async () => {
    await createExpense({
      fortnightId: 5,
      categoryId: 10,
      description: 'Doctor',
      amount: 2500,
      isPaid: true,
      paymentDate: '2026-09-26',
      walletId: 20,
      applyWalletDelta: false,
    });

    expect(expenseCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          is_paid: true,
          wallet_id: 20,
          amount: 2500,
        }),
      }),
    );
    expect(assertPaidChargeAllowedForWallet).not.toHaveBeenCalled();
    expect(applyWalletAmountDelta).not.toHaveBeenCalled();
  });

  it('does not apply wallet delta for unpaid expenses', async () => {
    expenseCreate.mockResolvedValueOnce({
      id: 100,
      description: 'Doctor futuro',
      amount: 2500,
      is_paid: false,
      payment_date: null,
      created_at: new Date('2026-08-21T12:00:00.000Z'),
      wallet_id: null,
      category: { name: 'Salud', icon: null },
      wallet: null,
    });

    await createExpense({
      fortnightId: 5,
      categoryId: 10,
      description: 'Doctor futuro',
      amount: 2500,
      isPaid: false,
      paymentDate: null,
      walletId: null,
    });

    expect(assertPaidChargeAllowedForWallet).not.toHaveBeenCalled();
    expect(applyWalletAmountDelta).not.toHaveBeenCalled();
  });
});
