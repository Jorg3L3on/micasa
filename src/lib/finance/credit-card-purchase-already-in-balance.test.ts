import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createExpense, findFirstWallet } = vi.hoisted(() => ({
  createExpense: vi.fn(),
  findFirstWallet: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    wallet: { findFirst: findFirstWallet },
  },
}));

vi.mock('@/lib/finance/expense.service', () => ({
  createExpense,
}));

import { createCreditCardPurchase } from '@/lib/finance/credit-card.service';

const ownerFilter = { user_id: 1, house_id: null } as const;

describe('createCreditCardPurchase already_in_card_balance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstWallet.mockResolvedValue({ id: 7 });
    createExpense.mockResolvedValue({
      id: 42,
      description: 'Compra bitácora',
      amount: 250,
    });
  });

  it('raises debt by default (applyWalletDelta true)', async () => {
    await createCreditCardPurchase(7, ownerFilter, {
      fortnight_id: 1,
      category_id: 2,
      description: 'Compra normal',
      amount: 100,
      payment_date: '2026-08-20',
      already_in_card_balance: false,
    });

    expect(createExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        walletId: 7,
        amount: 100,
        isPaid: true,
        applyWalletDelta: true,
      }),
    );
  });

  it('skips debt when already_in_card_balance is true', async () => {
    await createCreditCardPurchase(7, ownerFilter, {
      fortnight_id: 1,
      category_id: 2,
      description: 'Cargo ya en saldo',
      amount: 250,
      payment_date: '2026-08-15',
      already_in_card_balance: true,
    });

    expect(createExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        walletId: 7,
        amount: 250,
        isPaid: true,
        description: 'Cargo ya en saldo',
        applyWalletDelta: false,
      }),
    );
  });

  it('omitted already_in_card_balance still raises debt', async () => {
    await createCreditCardPurchase(7, ownerFilter, {
      fortnight_id: 1,
      category_id: 2,
      description: 'Legacy payload',
      amount: 50,
      payment_date: '2026-08-10',
    });

    expect(createExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        applyWalletDelta: true,
      }),
    );
  });
});
