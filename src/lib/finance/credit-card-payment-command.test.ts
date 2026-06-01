import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  findFirstPayment,
  applyWalletAmountDelta,
  deleteExpense,
  deletePayment,
  transactionFn,
} = vi.hoisted(() => ({
  findFirstPayment: vi.fn(),
  applyWalletAmountDelta: vi.fn(),
  deleteExpense: vi.fn(),
  deletePayment: vi.fn(),
  transactionFn: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    $transaction: transactionFn,
    creditCardPayment: {
      findFirst: findFirstPayment,
    },
  },
}));

vi.mock('@/lib/finance/wallet-accounting', () => ({
  applyWalletAmountDelta,
}));

import {
  isCardPaymentGeneratedExpense,
  reverseCreditCardPayment,
} from '@/lib/finance/credit-card.service';

const ownerFilter = { user_id: 1, house_id: null } as const;

describe('reverseCreditCardPayment', () => {
  beforeEach(() => {
    findFirstPayment.mockReset();
    applyWalletAmountDelta.mockReset();
    deleteExpense.mockReset();
    deletePayment.mockReset();
    transactionFn.mockReset();

    transactionFn.mockImplementation(async (callback) => {
      const tx = {
        creditCardPayment: {
          findFirst: findFirstPayment,
          delete: deletePayment,
        },
        expense: {
          delete: deleteExpense,
        },
      };
      return callback(tx);
    });
  });

  it('restores source and card balances, deletes linked expense, and removes payment', async () => {
    findFirstPayment.mockResolvedValueOnce({
      id: 5,
      amount: 250,
      expense_id: 99,
      source_wallet_id: 2,
      credit_card_wallet_id: 7,
    });
    deleteExpense.mockResolvedValueOnce(undefined);
    deletePayment.mockResolvedValueOnce(undefined);

    const result = await reverseCreditCardPayment(7, 5, ownerFilter);

    expect(findFirstPayment).toHaveBeenCalledWith({
      where: {
        id: 5,
        credit_card_wallet_id: 7,
        ...ownerFilter,
      },
      select: {
        id: true,
        amount: true,
        expense_id: true,
        source_wallet_id: true,
        credit_card_wallet_id: true,
      },
    });
    expect(applyWalletAmountDelta).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      2,
      250,
    );
    expect(applyWalletAmountDelta).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      7,
      250,
    );
    expect(deleteExpense).toHaveBeenCalledWith({ where: { id: 99 } });
    expect(deletePayment).toHaveBeenCalledWith({ where: { id: 5 } });
    expect(result).toEqual({ id: 5, amount: 250, expense_id: 99 });
  });

  it('skips expense deletion when payment has no linked expense', async () => {
    findFirstPayment.mockResolvedValueOnce({
      id: 8,
      amount: 100,
      expense_id: null,
      source_wallet_id: 2,
      credit_card_wallet_id: 7,
    });
    deletePayment.mockResolvedValueOnce(undefined);

    const result = await reverseCreditCardPayment(7, 8, ownerFilter);

    expect(deleteExpense).not.toHaveBeenCalled();
    expect(result.expense_id).toBeNull();
  });

  it('throws PAYMENT_NOT_FOUND when payment is missing', async () => {
    findFirstPayment.mockResolvedValueOnce(null);

    await expect(reverseCreditCardPayment(7, 404, ownerFilter)).rejects.toMatchObject(
      { code: 'PAYMENT_NOT_FOUND' },
    );
    expect(applyWalletAmountDelta).not.toHaveBeenCalled();
  });
});

describe('isCardPaymentGeneratedExpense', () => {
  beforeEach(() => {
    findFirstPayment.mockReset();
  });

  it('returns true when expense is linked to a card payment', async () => {
    findFirstPayment.mockResolvedValueOnce({ id: 1 });

    await expect(isCardPaymentGeneratedExpense(42)).resolves.toBe(true);
    expect(findFirstPayment).toHaveBeenCalledWith({
      where: { expense_id: 42 },
      select: { id: true },
    });
  });

  it('returns false when expense is not linked', async () => {
    findFirstPayment.mockResolvedValueOnce(null);

    await expect(isCardPaymentGeneratedExpense(42)).resolves.toBe(false);
  });
});
