import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getOwnerContext,
  incomeFindFirst,
  walletFindFirst,
  incomeUpdate,
  transactionFn,
  applyWalletAmountDelta,
} = vi.hoisted(() => ({
  getOwnerContext: vi.fn(),
  incomeFindFirst: vi.fn(),
  walletFindFirst: vi.fn(),
  incomeUpdate: vi.fn(),
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
      }),
    );
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
});
