import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  findFirstWallet,
  findFirstExpense,
  findFirstExpenseTemplate,
  findFirstIncome,
  findFirstBudgetAllocation,
  findFirstWalletTransfer,
  transaction,
} = vi.hoisted(() => ({
  findFirstWallet: vi.fn(),
  findFirstExpense: vi.fn(),
  findFirstExpenseTemplate: vi.fn(),
  findFirstIncome: vi.fn(),
  findFirstBudgetAllocation: vi.fn(),
  findFirstWalletTransfer: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    wallet: { findFirst: findFirstWallet },
    expense: { findFirst: findFirstExpense },
    expenseTemplate: { findFirst: findFirstExpenseTemplate },
    income: { findFirst: findFirstIncome },
    budgetAllocation: { findFirst: findFirstBudgetAllocation },
    walletTransfer: { findFirst: findFirstWalletTransfer },
    $transaction: transaction,
  },
}));

import { deleteCreditCardForOwner } from '@/lib/finance/credit-card.service';

const ownerFilter = { user_id: 1, house_id: null };

describe('deleteCreditCardForOwner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstWallet.mockResolvedValue({ id: 33 });
    findFirstExpense.mockResolvedValue(null);
    findFirstExpenseTemplate.mockResolvedValue(null);
    findFirstIncome.mockResolvedValue(null);
    findFirstBudgetAllocation.mockResolvedValue(null);
    findFirstWalletTransfer.mockResolvedValue(null);
  });

  it('throws P2025 when the card is missing for the owner', async () => {
    findFirstWallet.mockResolvedValue(null);

    await expect(deleteCreditCardForOwner(33, ownerFilter)).rejects.toMatchObject({
      code: 'P2025',
      message: 'Tarjeta no encontrada',
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('throws WALLET_IN_USE when expenses still reference the card', async () => {
    findFirstExpense.mockResolvedValue({ id: 1 });

    await expect(deleteCreditCardForOwner(33, ownerFilter)).rejects.toMatchObject({
      code: 'WALLET_IN_USE',
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('unlinks loans, removes card payments, and deletes the wallet', async () => {
    const loanUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const loanPaymentUpdateMany = vi.fn().mockResolvedValue({ count: 0 });
    const creditCardPaymentDeleteMany = vi.fn().mockResolvedValue({ count: 2 });
    const walletDelete = vi.fn().mockResolvedValue({ id: 33 });

    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      await fn({
        loan: { updateMany: loanUpdateMany },
        loanPayment: { updateMany: loanPaymentUpdateMany },
        creditCardPayment: { deleteMany: creditCardPaymentDeleteMany },
        wallet: { delete: walletDelete },
      });
    });

    await deleteCreditCardForOwner(33, ownerFilter);

    expect(findFirstWallet).toHaveBeenCalledWith({
      where: {
        id: 33,
        ...ownerFilter,
        type: { in: ['CREDIT_CARD', 'DEPARTMENT_STORE_CARD'] },
      },
      select: { id: true },
    });
    expect(loanUpdateMany).toHaveBeenCalledWith({
      where: { linked_wallet_id: 33 },
      data: { linked_wallet_id: null },
    });
    expect(loanUpdateMany).toHaveBeenCalledWith({
      where: { source_wallet_id: 33 },
      data: { source_wallet_id: null },
    });
    expect(creditCardPaymentDeleteMany).toHaveBeenCalledWith({
      where: {
        OR: [{ credit_card_wallet_id: 33 }, { source_wallet_id: 33 }],
      },
    });
    expect(walletDelete).toHaveBeenCalledWith({ where: { id: 33 } });
  });
});
