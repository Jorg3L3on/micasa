import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentMethodType } from '@/generated/prisma/client';
import { createWalletTransferSchema } from '@/schemas/wallet-transfer.schema';
import { mapWalletTransferToMovements } from '@/lib/finance/wallet-movements';

const {
  transaction,
  txWalletFindMany,
  txWalletTransferCreate,
  txWalletUpdate,
  txWalletFindUniqueOrThrow,
} = vi.hoisted(() => ({
  transaction: vi.fn(),
  txWalletFindMany: vi.fn(),
  txWalletTransferCreate: vi.fn(),
  txWalletUpdate: vi.fn(),
  txWalletFindUniqueOrThrow: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    $transaction: transaction,
  },
}));

import { createWalletTransferForOwner } from '@/lib/finance/wallet-transfer.service';

const ownerFilter = { user_id: 1, house_id: null } as const;

const cashWallet = {
  id: 10,
  name: 'Efectivo',
  type: PaymentMethodType.CASH,
  amount: 5000,
  active: true,
  user_id: 1,
  house_id: null,
};

const debitWallet = {
  id: 20,
  name: 'Débito',
  type: PaymentMethodType.DEBIT_CARD,
  amount: 2000,
  active: true,
  user_id: 1,
  house_id: null,
};

const creditWallet = {
  id: 30,
  name: 'TC',
  type: PaymentMethodType.CREDIT_CARD,
  amount: 1000,
  active: true,
  user_id: 1,
  house_id: null,
};

describe('createWalletTransferSchema', () => {
  it('accepts a valid transfer and defaults fee/exclude', () => {
    const parsed = createWalletTransferSchema.parse({
      from_wallet_id: 1,
      to_wallet_id: 2,
      amount: 1000,
      transferred_at: '2026-08-10',
    });
    expect(parsed.fee_amount).toBe(0);
    expect(parsed.exclude_from_report).toBe(true);
  });

  it('rejects same from/to wallet', () => {
    const result = createWalletTransferSchema.safeParse({
      from_wallet_id: 1,
      to_wallet_id: 1,
      amount: 100,
      transferred_at: '2026-08-10',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-positive amount', () => {
    const result = createWalletTransferSchema.safeParse({
      from_wallet_id: 1,
      to_wallet_id: 2,
      amount: 0,
      transferred_at: '2026-08-10',
    });
    expect(result.success).toBe(false);
  });
});

describe('mapWalletTransferToMovements', () => {
  const transfer = {
    id: 55,
    amount: 1000,
    fee_amount: 30,
    transferred_at: new Date('2026-08-10T12:00:00.000Z'),
    note: 'Ahorro',
    from_wallet_id: 10,
    to_wallet_id: 20,
    from_wallet: { name: 'Efectivo' },
    to_wallet: { name: 'Débito' },
  };

  it('maps source wallet to transfer out + fee lines', () => {
    const movements = mapWalletTransferToMovements(transfer, 10);
    expect(movements).toHaveLength(2);
    expect(movements[0]).toMatchObject({
      kind: 'wallet_transfer',
      direction: 'out',
      amount: 1000,
      description: 'Transferencia a Débito: Ahorro',
    });
    expect(movements[1]).toMatchObject({
      kind: 'wallet_transfer_fee',
      direction: 'out',
      amount: 30,
      description: 'Comisión de transferencia: Ahorro',
    });
  });

  it('maps destination wallet to a single inflow', () => {
    const movements = mapWalletTransferToMovements(transfer, 20);
    expect(movements).toEqual([
      expect.objectContaining({
        kind: 'wallet_transfer',
        direction: 'in',
        amount: 1000,
        description: 'Transferencia desde Efectivo: Ahorro',
      }),
    ]);
  });

  it('omits fee line when fee is zero', () => {
    const movements = mapWalletTransferToMovements(
      { ...transfer, fee_amount: 0 },
      10,
    );
    expect(movements).toHaveLength(1);
    expect(movements[0]?.kind).toBe('wallet_transfer');
  });
});

describe('createWalletTransferForOwner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        wallet: {
          findMany: txWalletFindMany,
          update: txWalletUpdate,
          findUniqueOrThrow: txWalletFindUniqueOrThrow,
        },
        walletTransfer: {
          create: txWalletTransferCreate,
        },
      };
      return fn(tx);
    });
    txWalletUpdate.mockResolvedValue({});
  });

  it('debits source by amount+fee and credits dest by amount', async () => {
    txWalletFindMany.mockResolvedValue([cashWallet, debitWallet]);
    txWalletTransferCreate.mockResolvedValue({
      id: 1,
      amount: 1000,
      fee_amount: 30,
      from_wallet_id: 10,
      to_wallet_id: 20,
      note: null,
      exclude_from_report: true,
    });
    txWalletFindUniqueOrThrow
      .mockResolvedValueOnce({ ...cashWallet, amount: 3970 })
      .mockResolvedValueOnce({ ...debitWallet, amount: 3000 });

    const result = await createWalletTransferForOwner(ownerFilter, {
      from_wallet_id: 10,
      to_wallet_id: 20,
      amount: 1000,
      fee_amount: 30,
      transferred_at: '2026-08-10',
      exclude_from_report: true,
      note: null,
    });

    expect(txWalletUpdate).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { amount: { decrement: 1030 } },
    });
    expect(txWalletUpdate).toHaveBeenCalledWith({
      where: { id: 20 },
      data: { amount: { increment: 1000 } },
    });
    expect(result.from_wallet_amount).toBe(3970);
    expect(result.to_wallet_amount).toBe(3000);
  });

  it('allows transfer that leaves a negative source balance', async () => {
    txWalletFindMany.mockResolvedValue([
      { ...cashWallet, amount: 100 },
      debitWallet,
    ]);
    txWalletTransferCreate.mockResolvedValue({
      id: 2,
      amount: 500,
      fee_amount: 0,
      from_wallet_id: 10,
      to_wallet_id: 20,
      note: null,
      exclude_from_report: true,
    });
    txWalletFindUniqueOrThrow
      .mockResolvedValueOnce({ ...cashWallet, amount: -400 })
      .mockResolvedValueOnce({ ...debitWallet, amount: 2500 });

    await expect(
      createWalletTransferForOwner(ownerFilter, {
        from_wallet_id: 10,
        to_wallet_id: 20,
        amount: 500,
        fee_amount: 0,
        transferred_at: '2026-08-10',
        exclude_from_report: true,
        note: null,
      }),
    ).resolves.toMatchObject({ from_wallet_amount: -400 });
  });

  it('rejects credit wallets', async () => {
    txWalletFindMany.mockResolvedValue([cashWallet, creditWallet]);

    await expect(
      createWalletTransferForOwner(ownerFilter, {
        from_wallet_id: 10,
        to_wallet_id: 30,
        amount: 100,
        fee_amount: 0,
        transferred_at: '2026-08-10',
        exclude_from_report: true,
        note: null,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_WALLET_TYPE' });
  });

  it('rejects when a wallet is missing from owner scope', async () => {
    txWalletFindMany.mockResolvedValue([cashWallet]);

    await expect(
      createWalletTransferForOwner(ownerFilter, {
        from_wallet_id: 10,
        to_wallet_id: 20,
        amount: 100,
        fee_amount: 0,
        transferred_at: '2026-08-10',
        exclude_from_report: true,
        note: null,
      }),
    ).rejects.toMatchObject({ code: 'WALLET_NOT_FOUND' });
  });
});
