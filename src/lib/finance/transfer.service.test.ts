import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentMethodType } from '@/generated/prisma/client';
import { DomainError } from '@/lib/finance/domain-error';
import { parseCalendarDate } from '@/lib/calendar-dates';

vi.mock('@/lib/prisma', () => ({ default: {} }));

import { createUserToHouseTransferInTx } from '@/lib/finance/transfer.service';

const walletTypes: Record<number, PaymentMethodType> = {
  1: PaymentMethodType.CASH,
  2: PaymentMethodType.DEBIT_CARD,
  3: PaymentMethodType.CREDIT_CARD,
  4: PaymentMethodType.GOAL,
  5: PaymentMethodType.DEPARTMENT_STORE_CARD,
};

const makeTx = () => ({
  wallet: {
    findUnique: vi.fn(async ({ where }: { where: { id: number } }) =>
      walletTypes[where.id] ? { type: walletTypes[where.id] } : null,
    ),
    update: vi.fn(),
  },
  transfer: {
    create: vi.fn(async () => ({ id: 100 })),
    update: vi.fn(async () => ({ id: 100 })),
  },
  expense: { create: vi.fn(async () => ({ id: 200 })) },
  income: { create: vi.fn(async () => ({ id: 300 })) },
});

const baseInput = {
  userId: 7,
  houseId: 9,
  amount: 500,
  userFortnightId: 11,
  houseFortnightId: 12,
};

type Tx = Parameters<typeof createUserToHouseTransferInTx>[0];

describe('createUserToHouseTransferInTx wallet types', () => {
  let tx: ReturnType<typeof makeTx>;

  beforeEach(() => {
    tx = makeTx();
  });

  it('moves cash between funding wallets', async () => {
    await createUserToHouseTransferInTx(tx as unknown as Tx, {
      ...baseInput,
      userWalletId: 1,
      houseWalletId: 2,
    });
    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { amount: { decrement: 500 } },
    });
    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { amount: { increment: 500 } },
    });
  });

  it.each([
    ['credit card', 3],
    ['department store card', 5],
    ['goal', 4],
  ])('rejects a personal %s as source', async (_label, walletId) => {
    const promise = createUserToHouseTransferInTx(tx as unknown as Tx, {
      ...baseInput,
      userWalletId: walletId,
      houseWalletId: 2,
    });
    await expect(promise).rejects.toBeInstanceOf(DomainError);
    await expect(promise).rejects.toMatchObject({ code: 'VALIDATION', status: 400 });
    expect(tx.transfer.create).not.toHaveBeenCalled();
    expect(tx.wallet.update).not.toHaveBeenCalled();
  });

  it.each([
    ['credit card', 3],
    ['goal', 4],
  ])('rejects a house %s as destination', async (_label, walletId) => {
    await expect(
      createUserToHouseTransferInTx(tx as unknown as Tx, {
        ...baseInput,
        userWalletId: 1,
        houseWalletId: walletId,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(tx.wallet.update).not.toHaveBeenCalled();
  });

  it('stores received_at as the calendar instant of the transfer day', async () => {
    await createUserToHouseTransferInTx(tx as unknown as Tx, {
      ...baseInput,
      houseWalletId: 2,
      // 23:30 in Mexico City on 2026-03-14 (UTC is already the 15th).
      date: new Date('2026-03-15T05:30:00.000Z'),
    });
    expect(tx.income.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ received_at: parseCalendarDate('2026-03-14') }),
      }),
    );
  });
});
