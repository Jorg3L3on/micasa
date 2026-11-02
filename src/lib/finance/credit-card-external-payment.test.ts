import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  transactionFn,
  findFirstWallet,
  createPayment,
  applyWalletAmountDelta,
  coverScheduled,
  coverInstallmentPlan,
} = vi.hoisted(() => ({
  transactionFn: vi.fn(),
  findFirstWallet: vi.fn(),
  createPayment: vi.fn(),
  applyWalletAmountDelta: vi.fn(),
  coverScheduled: vi.fn(),
  coverInstallmentPlan: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    $transaction: transactionFn,
    wallet: { findFirst: findFirstWallet },
  },
}));

vi.mock('@/lib/finance/wallet-accounting', () => ({
  applyWalletAmountDelta,
  ensureCreditWalletType: vi.fn(),
  ensureFundingWalletType: vi.fn(),
  toWalletAmountNumber: (value: unknown) => Number(value),
}));

vi.mock('@/lib/finance/credit-card-scheduled-payment.service', () => ({
  coverScheduledPaymentForCardPayment: coverScheduled,
}));

vi.mock('@/lib/finance/credit-card-installment-plan.service', () => ({
  coverInstallmentPlanPaymentForCardPayment: coverInstallmentPlan,
}));

import { createCreditCardPayment } from '@/lib/finance/credit-card.service';

const ownerFilter = { user_id: 1, house_id: null } as const;

const creditCardWallet = {
  id: 7,
  name: 'Tarjeta prueba',
  type: 'CREDIT_CARD',
  amount: 500,
  user_id: 1,
  house_id: null,
};

describe('createCreditCardPayment external mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    coverScheduled.mockResolvedValue(null);
    coverInstallmentPlan.mockResolvedValue(null);
    transactionFn.mockImplementation(async (callback) =>
      callback({
        wallet: { findFirst: findFirstWallet },
        creditCardPayment: {
          create: createPayment,
          update: vi.fn(),
        },
        category: { findFirst: vi.fn() },
        fortnight: { findFirst: vi.fn() },
        expense: { create: vi.fn() },
      }),
    );
    findFirstWallet.mockResolvedValue(creditCardWallet);
    createPayment.mockResolvedValue({
      id: 12,
      amount: 100,
      paid_at: new Date('2026-06-05T12:00:00.000Z'),
      note: null,
      source_wallet_id: null,
      adjusts_debt: true,
      credit_card_wallet_id: 7,
      source_wallet: null,
      credit_card_wallet: { id: 7, name: 'Tarjeta prueba' },
    });
  });

  it('registers external payment and reduces card debt without touching wallets', async () => {
    const result = await createCreditCardPayment(7, ownerFilter, {
      mode: 'external',
      amount: 100,
      paid_at: '2026-06-05',
      note: null,
      adjusts_debt: true,
    });

    expect(applyWalletAmountDelta).toHaveBeenCalledTimes(1);
    expect(applyWalletAmountDelta).toHaveBeenCalledWith(
      expect.anything(),
      7,
      -100,
    );
    expect(result.is_external).toBe(true);
    expect(coverScheduled).toHaveBeenCalled();
    expect(coverInstallmentPlan).toHaveBeenCalled();
  });

  it('matches scheduled rows inside the payment transaction', async () => {
    await createCreditCardPayment(7, ownerFilter, {
      mode: 'external',
      amount: 100,
      paid_at: '2026-06-05',
      note: null,
      adjusts_debt: true,
    });

    const txClient = coverScheduled.mock.calls[0]![0];
    expect(txClient).toHaveProperty('creditCardPayment');
    expect(coverScheduled).toHaveBeenCalledWith(txClient, 7, ownerFilter, '2026-06-05', 100, 12);
    expect(coverInstallmentPlan).toHaveBeenCalledWith(
      txClient,
      7,
      ownerFilter,
      '2026-06-05',
      100,
      12,
    );
  });

  it('runs the match before the transaction commits and fails the payment with it', async () => {
    let insideTransaction = false;
    const callback = transactionFn.getMockImplementation()!;
    transactionFn.mockImplementationOnce(async (fn) => {
      insideTransaction = true;
      try {
        return await callback(fn);
      } finally {
        insideTransaction = false;
      }
    });
    coverInstallmentPlan.mockImplementationOnce(async () => {
      expect(insideTransaction).toBe(true);
      throw new Error('match failed');
    });

    await expect(
      createCreditCardPayment(7, ownerFilter, {
        mode: 'external',
        amount: 100,
        paid_at: '2026-06-05',
        note: null,
        adjusts_debt: true,
      }),
    ).rejects.toThrow('match failed');
    expect(coverInstallmentPlan).toHaveBeenCalledTimes(1);
  });

  it('supports ledger-only mode without reducing debt', async () => {
    createPayment.mockResolvedValueOnce({
      id: 13,
      amount: 100,
      paid_at: new Date('2026-06-05T12:00:00.000Z'),
      note: 'Ya pagado en app',
      source_wallet_id: null,
      adjusts_debt: false,
      credit_card_wallet_id: 7,
      source_wallet: null,
      credit_card_wallet: { id: 7, name: 'Tarjeta prueba' },
    });

    await createCreditCardPayment(7, ownerFilter, {
      mode: 'external',
      amount: 100,
      paid_at: '2026-06-05',
      note: 'Ya pagado en app',
      adjusts_debt: false,
    });

    expect(applyWalletAmountDelta).not.toHaveBeenCalled();
  });
});
