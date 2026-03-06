import type { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { TransferType } from '@/generated/prisma/client';

export type CreateUserToHouseTransferInput = {
  userId: number;
  houseId: number;
  amount: number;
  userWalletId?: number | null;
  houseWalletId?: number | null;
  userFortnightId: number;
  houseFortnightId: number;
  note?: string | null;
  date?: Date;
};

export async function createUserToHouseTransferInTx(
  tx: Prisma.TransactionClient,
  input: CreateUserToHouseTransferInput,
) {
  const {
    userId,
    houseId,
    amount,
    userWalletId,
    houseWalletId,
    userFortnightId,
    houseFortnightId,
    note,
    date = new Date(),
  } = input;

  const transfer = await tx.transfer.create({
    data: {
      amount,
      type: TransferType.USER_TO_HOUSE,
      user_id: userId,
      house_id: houseId,
      note: note ?? undefined,
    },
  });

  const userExpense = await tx.expense.create({
    data: {
      description: note ?? 'Transferencia a casa',
      amount: amount.toString(),
      is_paid: true,
      payment_date: date,
      user_id: userId,
      house_id: null,
      fortnight_id: userFortnightId,
      wallet_id: userWalletId ?? null,
    },
  });

  const houseIncome = await tx.income.create({
    data: {
      amount: amount.toString(),
      source: note ?? 'Transferencia desde usuario',
      received_at: date,
      user_id: null,
      house_id: houseId,
      fortnight_id: houseFortnightId,
    },
  });

  if (userWalletId) {
    await tx.wallet.update({
      where: { id: userWalletId },
      data: { amount: { decrement: amount } },
    });
  }

  if (houseWalletId) {
    await tx.wallet.update({
      where: { id: houseWalletId },
      data: { amount: { increment: amount } },
    });
  }

  const updatedTransfer = await tx.transfer.update({
    where: { id: transfer.id },
    data: {
      user_expense_id: userExpense.id,
      house_income_id: houseIncome.id,
    } as any,
    include: {
      user_expense: true,
      house_income: true,
    } as any,
  });

  return updatedTransfer;
}

export async function createUserToHouseTransfer(
  input: CreateUserToHouseTransferInput,
) {
  return prisma.$transaction((tx) => createUserToHouseTransferInTx(tx, input));
}

