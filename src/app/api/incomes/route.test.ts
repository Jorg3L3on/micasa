import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getOwnerContext,
  incomeFindFirst,
  walletFindFirst,
  categoryFindFirst,
  incomeUpdate,
  incomeTemplateFindFirst,
  incomeTemplateUpdate,
  incomeCreate,
  resolveOrCreateFortnight,
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
  incomeCreate: vi.fn(),
  resolveOrCreateFortnight: vi.fn(),
  transactionFn: vi.fn(),
  applyWalletAmountDelta: vi.fn(),
}));

vi.mock('@/lib/server/get-owner-context', () => ({
  getOwnerContext,
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    income: { findFirst: incomeFindFirst, create: incomeCreate },
    wallet: { findFirst: walletFindFirst },
    category: { findFirst: categoryFindFirst },
    $transaction: transactionFn,
  },
}));

vi.mock('@/lib/fortnights', () => ({
  resolveOrCreateFortnight,
}));

vi.mock('@/lib/finance/wallet-accounting', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/finance/wallet-accounting')>();
  return {
    ...actual,
    applyWalletAmountDelta,
  };
});

import { POST, PUT } from './route';
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

  it('adds only the difference when the defined wallet was already credited', async () => {
    incomeFindFirst.mockResolvedValue({
      id: 12,
      amount: 12500,
      wallet_id: 7,
      wallet_credited: true,
      category_id: 3,
      source: 'Nómina',
    });
    walletFindFirst.mockResolvedValue({ id: 7, type: 'CASH' });

    const response = await putIncome({ amount: 13000, wallet_id: 7 });

    expect(response.status).toBe(200);
    expect(applyWalletAmountDelta).toHaveBeenCalledWith(
      expect.anything(),
      7,
      500,
    );
  });

});

describe('POST /api/incomes planned', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOwnerContext.mockResolvedValue(ownerContext);
    categoryFindFirst.mockResolvedValue({
      id: 4,
      kind: 'INCOME',
      active: true,
    });
    resolveOrCreateFortnight.mockResolvedValue({ id: 10 });
    walletFindFirst.mockResolvedValue({ id: 7, type: 'CASH' });
    incomeCreate.mockResolvedValue({
      id: 21,
      amount: 800,
      source: 'Bono',
      received_at: new Date('2026-09-20T12:00:00.000Z'),
      fortnight_id: 10,
      income_template_id: null,
      wallet_id: 7,
      category_id: 4,
    });
  });

  it('stores the wallet on the fortnight income without crediting it', async () => {
    const response = await POST(
      new Request('http://localhost/api/incomes?ownerType=user&ownerId=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 800,
          source: 'Bono',
          received_at: '2026-09-20',
          category_id: 4,
          wallet_id: 7,
          planned: true,
        }),
      }) as Parameters<typeof POST>[0],
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.wallet_id).toBe(7);
    expect(body.amount).toBe(800);
    expect(applyWalletAmountDelta).not.toHaveBeenCalled();
    expect(walletFindFirst).toHaveBeenCalled();
    expect(incomeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fortnight_id: 10,
          amount: 800,
          wallet_id: 7,
          category_id: 4,
          source: 'Bono',
        }),
      }),
    );
  });
});
