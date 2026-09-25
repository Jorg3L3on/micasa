import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getOwnerContext,
  incomeFindFirst,
  walletFindFirst,
  categoryFindFirst,
  incomeUpdate,
  incomeTemplateFindFirst,
  incomeTemplateUpdate,
  transactionFn,
  applyWalletAmountDelta,
} = vi.hoisted(() => ({
  getOwnerContext: vi.fn(),
  incomeFindFirst: vi.fn(),
  walletFindFirst: vi.fn(),
  categoryFindFirst: vi.fn(),
  incomeUpdate: vi.fn(),
  incomeTemplateFindFirst: vi.fn(),
  incomeTemplateUpdate: vi.fn(),
  transactionFn: vi.fn(),
  applyWalletAmountDelta: vi.fn(),
}));

vi.mock('@/lib/server/get-owner-context', () => ({
  getOwnerContext,
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    income: { findFirst: incomeFindFirst },
    wallet: { findFirst: walletFindFirst },
    category: { findFirst: categoryFindFirst },
    $transaction: transactionFn,
  },
}));

vi.mock('@/lib/finance/wallet-accounting', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/finance/wallet-accounting')>();
  return {
    ...actual,
    applyWalletAmountDelta,
  };
});

import { PUT } from './route';
import { INCOME_WALLET_REQUIRED_MESSAGE } from '@/lib/finance/income.service';

const ownerContext = {
  userId: 1,
  ownerType: 'user' as const,
  ownerId: 1,
  ownerFilter: { user_id: 1, house_id: null },
  role: 'owner' as const,
};

const putIncome = (body: unknown) =>
  PUT(
    new Request('http://localhost/api/incomes?id=12', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }) as Parameters<typeof PUT>[0],
  );

describe('PUT /api/incomes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOwnerContext.mockResolvedValue(ownerContext);
    incomeFindFirst.mockResolvedValue({
      id: 12,
      amount: 10000,
      wallet_id: null,
      category_id: 3,
      source: 'Nómina',
    });
    transactionFn.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        income: { update: incomeUpdate },
        incomeTemplate: {
          findFirst: incomeTemplateFindFirst,
          update: incomeTemplateUpdate,
        },
      }),
    );
    categoryFindFirst.mockResolvedValue({
      id: 4,
      kind: 'INCOME',
      active: true,
    });
    incomeUpdate.mockResolvedValue({
      id: 12,
      amount: 12500,
      source: 'Nómina',
      received_at: new Date('2026-09-15T12:00:00.000Z'),
      fortnight_id: 4,
      income_template_id: null,
      wallet_id: 7,
      category_id: 3,
    });
  });

  it('returns 400 when a legacy income is saved without a wallet', async () => {
    const response = await putIncome({ amount: 12500 });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe(INCOME_WALLET_REQUIRED_MESSAGE);
    expect(transactionFn).not.toHaveBeenCalled();
  });

  it('saves the amount and the assigned cash wallet together', async () => {
    walletFindFirst.mockResolvedValue({ id: 7, type: 'CASH' });

    const response = await putIncome({ amount: 12500, wallet_id: 7 });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.wallet_id).toBe(7);
    expect(body.amount).toBe(12500);
    expect(applyWalletAmountDelta).toHaveBeenCalledWith(
      expect.anything(),
      7,
      12500,
    );
    expect(incomeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 12500,
          wallet_id: 7,
        }),
      }),
    );
  });

  it('updates the income template and does not credit the wallet', async () => {
    incomeFindFirst.mockResolvedValue({
      id: 12,
      amount: 6000,
      wallet_id: null,
      category_id: 3,
      source: 'Salario Carmen',
      income_template_id: 9,
    });
    incomeTemplateFindFirst.mockResolvedValue({ id: 9 });
    incomeUpdate.mockResolvedValue({
      id: 12,
      amount: 6500,
      source: 'Salario Carmen',
      received_at: new Date('2026-09-15T12:00:00.000Z'),
      fortnight_id: 4,
      income_template_id: 9,
      wallet_id: null,
      category_id: 4,
    });

    const response = await putIncome({
      amount: 6500,
      category_id: 4,
      wallet_id: 7,
      sync_template: true,
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.amount).toBe(6500);
    expect(body.wallet_id).toBeNull();
    expect(body.template_updated).toBe(true);
    expect(walletFindFirst).not.toHaveBeenCalled();
    expect(applyWalletAmountDelta).not.toHaveBeenCalled();
    expect(incomeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          amount: 6500,
          category_id: 4,
        },
      }),
    );
    expect(incomeTemplateUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 9 },
        data: {
          suggested_amount: '6500',
          category_id: 4,
        },
      }),
    );
  });

  it('leaves an already assigned wallet balance unchanged', async () => {
    incomeFindFirst.mockResolvedValue({
      id: 12,
      amount: 17500,
      wallet_id: 7,
      category_id: 3,
      source: 'Salario Jorge',
      income_template_id: 10,
    });
    incomeTemplateFindFirst.mockResolvedValue({ id: 10 });
    incomeUpdate.mockResolvedValue({
      id: 12,
      amount: 18000,
      source: 'Salario Jorge',
      received_at: new Date('2026-09-15T12:00:00.000Z'),
      fortnight_id: 4,
      income_template_id: 10,
      wallet_id: 7,
      category_id: 3,
    });

    const response = await putIncome({
      amount: 18000,
      sync_template: true,
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.wallet_id).toBe(7);
    expect(body.template_updated).toBe(true);
    expect(applyWalletAmountDelta).not.toHaveBeenCalled();
    expect(incomeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { amount: 18000 },
      }),
    );
  });
});
