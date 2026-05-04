import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { queryRaw, findManyWallets, findManyStatementImports } = vi.hoisted(
  () => ({
    queryRaw: vi.fn(),
    findManyWallets: vi.fn(),
    findManyStatementImports: vi.fn(),
  }),
);

vi.mock('@/lib/prisma', () => ({
  default: {
    $queryRaw: queryRaw,
    wallet: {
      findMany: findManyWallets,
    },
    creditCardStatementImport: {
      findMany: findManyStatementImports,
    },
  },
}));

import { getDuePaymentsForCurrentFortnight } from '@/lib/finance/credit-card-statement.service';

const userOwner = { user_id: 1, house_id: null } as const;

describe('getDuePaymentsForCurrentFortnight', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 2, 20, 15, 0, 0)));
    queryRaw.mockReset();
    findManyWallets.mockReset();
    findManyStatementImports.mockReset();
    findManyStatementImports.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns an empty list and skips SQL when there are no cards', async () => {
    findManyWallets.mockResolvedValue([]);
    const result = await getDuePaymentsForCurrentFortnight(userOwner);
    expect(result).toEqual([]);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('uses batched aggregates and returns rows with positive next due', async () => {
    findManyWallets.mockResolvedValue([
      {
        id: 7,
        name: 'Visa',
        type: 'CREDIT_CARD',
        amount: 50,
        cutoff_day: 15,
        due_day: 18,
      },
    ]);
    queryRaw
      .mockResolvedValueOnce([{ wallet_id: 7, total: 500 }])
      .mockResolvedValueOnce([{ credit_card_wallet_id: 7, total: 100 }]);

    const result = await getDuePaymentsForCurrentFortnight(userOwner);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      walletId: 7,
      walletName: 'Visa',
      nextDuePayment: 400,
      paymentsAppliedToStatement: 100,
      dueDay: 18,
      cutoff_day: 15,
    });
    expect(typeof result[0]?.statementDueDate).toBe('string');
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });

  it('ignores last_paid_period and still returns due when statement obligation remains', async () => {
    findManyWallets.mockResolvedValue([
      {
        id: 1,
        name: 'Visa',
        type: 'CREDIT_CARD',
        amount: 50,
        cutoff_day: 15,
        due_day: 18,
      },
    ]);
    queryRaw
      .mockResolvedValueOnce([{ wallet_id: 1, total: 500 }])
      .mockResolvedValueOnce([{ credit_card_wallet_id: 1, total: 100 }]);

    const result = await getDuePaymentsForCurrentFortnight(userOwner);

    expect(result).toHaveLength(1);
    expect(result[0]?.nextDuePayment).toBe(400);
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });

  it('batches two cards that share cutoff and due into one query pair', async () => {
    findManyWallets.mockResolvedValue([
      {
        id: 1,
        name: 'A',
        type: 'CREDIT_CARD',
        amount: 10,
        cutoff_day: 15,
        due_day: 18,
      },
      {
        id: 2,
        name: 'B',
        type: 'CREDIT_CARD',
        amount: 10,
        cutoff_day: 15,
        due_day: 18,
      },
    ]);
    queryRaw
      .mockResolvedValueOnce([
        { wallet_id: 1, total: 100 },
        { wallet_id: 2, total: 200 },
      ])
      .mockResolvedValueOnce([
        { credit_card_wallet_id: 1, total: 50 },
        { credit_card_wallet_id: 2, total: 0 },
      ]);

    const result = await getDuePaymentsForCurrentFortnight(userOwner);

    expect(queryRaw).toHaveBeenCalledTimes(2);
    expect(result.map((r) => r.walletId).sort()).toEqual([1, 2]);
    expect(result.find((r) => r.walletId === 1)?.nextDuePayment).toBe(50);
    expect(result.find((r) => r.walletId === 2)?.nextDuePayment).toBe(200);
  });
});
