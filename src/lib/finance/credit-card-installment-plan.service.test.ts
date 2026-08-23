import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OwnerFilter } from '@/lib/server/get-owner-context';

const {
  findFirstWallet,
  transaction,
  createPlan,
  updatePlan,
  deleteManyPayments,
  findFirstPlan,
  applyWalletAmountDelta,
} = vi.hoisted(() => ({
  findFirstWallet: vi.fn(),
  transaction: vi.fn(),
  createPlan: vi.fn(),
  updatePlan: vi.fn(),
  deleteManyPayments: vi.fn(),
  findFirstPlan: vi.fn(),
  applyWalletAmountDelta: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    wallet: { findFirst: findFirstWallet },
    $transaction: transaction,
    creditCardInstallmentPlan: {
      findMany: vi.fn(),
      findFirst: findFirstPlan,
      create: createPlan,
      update: updatePlan,
      delete: vi.fn(),
    },
    creditCardInstallmentPlanPayment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      deleteMany: deleteManyPayments,
    },
  },
}));

vi.mock('@/lib/finance/wallet-accounting', () => ({
  ensureCreditWalletType: vi.fn(),
  applyWalletAmountDelta,
}));

import {
  createInstallmentPlan,
  updateInstallmentPlan,
} from '@/lib/finance/credit-card-installment-plan.service';

const ownerFilter: OwnerFilter = { user_id: 1, house_id: null };

describe('createInstallmentPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstWallet.mockResolvedValue({
      id: 10,
      type: 'CREDIT_CARD',
      user_id: 1,
      house_id: null,
      due_day: 15,
      amount: 5000,
      credit_limit: 20000,
    });
    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        creditCardInstallmentPlan: {
          create: createPlan,
        },
      }),
    );
    createPlan.mockResolvedValue({
      id: 1,
      credit_card_wallet_id: 10,
      name: 'Laptop',
      installment_amount: 1500,
      total_installments: 9,
      paid_installments: 2,
      already_in_card_balance: true,
      status: 'ACTIVE',
      payments: Array.from({ length: 9 }, (_, index) => ({
        id: index + 1,
        sequence: index + 1,
        due_date: new Date('2026-03-15T12:00:00.000Z'),
        amount: 1500,
        status: index < 2 ? 'PAID' : 'SCHEDULED',
        paid_at: index < 2 ? new Date() : null,
      })),
    });
  });

  it('does not apply wallet delta when already in card balance', async () => {
    await createInstallmentPlan(10, ownerFilter, {
      name: 'Laptop',
      installment_amount: 1500,
      total_installments: 9,
      paid_installments: 2,
      next_due_date: '2026-03-15',
      already_in_card_balance: true,
    });

    expect(applyWalletAmountDelta).not.toHaveBeenCalled();
    expect(createPlan).toHaveBeenCalled();
  });

  it('applies remaining principal when it is a new purchase', async () => {
    await createInstallmentPlan(10, ownerFilter, {
      name: 'Laptop',
      installment_amount: 1500,
      total_installments: 9,
      paid_installments: 0,
      next_due_date: '2026-03-15',
      already_in_card_balance: false,
    });

    expect(applyWalletAmountDelta).toHaveBeenCalledWith(
      expect.anything(),
      10,
      13500,
    );
  });
});

const existingPlanRow = {
  id: 1,
  credit_card_wallet_id: 10,
  name: 'Laptop',
  installment_amount: 1500,
  total_installments: 9,
  paid_installments: 2,
  already_in_card_balance: true,
  status: 'ACTIVE' as const,
  payments: Array.from({ length: 9 }, (_, index) => ({
    id: index + 1,
    sequence: index + 1,
    due_date: new Date('2026-03-15T12:00:00.000Z'),
    amount: 1500,
    status: (index < 2 ? 'PAID' : 'SCHEDULED') as 'PAID' | 'SCHEDULED',
    paid_at: index < 2 ? new Date() : null,
    credit_card_payment_id: null,
  })),
};

describe('updateInstallmentPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstWallet.mockResolvedValue({
      id: 10,
      type: 'CREDIT_CARD',
      user_id: 1,
      house_id: null,
      due_day: 15,
      amount: 5000,
      credit_limit: 20000,
    });
    findFirstPlan.mockResolvedValue(existingPlanRow);
    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        creditCardInstallmentPlan: {
          update: updatePlan,
        },
        creditCardInstallmentPlanPayment: {
          deleteMany: deleteManyPayments,
        },
      }),
    );
    updatePlan.mockResolvedValue({
      ...existingPlanRow,
      name: 'Laptop Pro',
    });
  });

  it('updates only the name without touching payments or wallet', async () => {
    const result = await updateInstallmentPlan(1, 10, ownerFilter, {
      name: 'Laptop Pro',
      installment_amount: 1500,
      total_installments: 9,
      paid_installments: 2,
      next_due_date: '2026-03-15',
      already_in_card_balance: true,
    });

    expect(updatePlan).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { name: 'Laptop Pro' },
      include: expect.any(Object),
    });
    expect(deleteManyPayments).not.toHaveBeenCalled();
    expect(applyWalletAmountDelta).not.toHaveBeenCalled();
    expect(result.name).toBe('Laptop Pro');
  });

  it('does not apply wallet delta when already in card balance and amount changes', async () => {
    updatePlan.mockResolvedValue({
      ...existingPlanRow,
      installment_amount: 1600,
    });

    await updateInstallmentPlan(1, 10, ownerFilter, {
      name: 'Laptop',
      installment_amount: 1600,
      total_installments: 9,
      paid_installments: 2,
      next_due_date: '2026-03-15',
      already_in_card_balance: true,
    });

    expect(deleteManyPayments).toHaveBeenCalledWith({ where: { plan_id: 1 } });
    expect(applyWalletAmountDelta).not.toHaveBeenCalled();
  });

  it('applies wallet delta for scheduled amount changes on new purchases', async () => {
    findFirstPlan.mockResolvedValue({
      ...existingPlanRow,
      already_in_card_balance: false,
    });

    await updateInstallmentPlan(1, 10, ownerFilter, {
      name: 'Laptop',
      installment_amount: 1600,
      total_installments: 9,
      paid_installments: 2,
      next_due_date: '2026-03-15',
      already_in_card_balance: false,
    });

    expect(applyWalletAmountDelta).toHaveBeenCalledWith(
      expect.anything(),
      10,
      700,
    );
  });
});
