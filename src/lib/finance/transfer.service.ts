import type { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { TransferType } from '@/generated/prisma/client';
import { coerceToCalendarDate, coerceToCalendarDayStart } from '@/lib/calendar-dates';
import { DomainError } from '@/lib/finance/domain-error';
import { isFundingWalletType } from '@/lib/finance/wallet-accounting';

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

/**
 * Both sides move cash: the user wallet is decremented and the house wallet
 * incremented. Credit cards would read that as paying down debt and goal
 * wallets sit outside liquidity, so only efectivo/débito may take part.
 */
async function assertTransferFundingWallet(
  tx: Prisma.TransactionClient,
  walletId: number,
  side: 'user' | 'house',
) {
  const wallet = await tx.wallet.findUnique({
    where: { id: walletId },
    select: { type: true },
  });
  if (!wallet || !isFundingWalletType(wallet.type)) {
    throw new DomainError(
      'VALIDATION',
      side === 'user'
        ? 'La billetera personal debe ser de efectivo o débito'
        : 'La billetera de la casa debe ser de efectivo o débito',
    );
  }
}

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

  if (userWalletId) await assertTransferFundingWallet(tx, userWalletId, 'user');
  if (houseWalletId) await assertTransferFundingWallet(tx, houseWalletId, 'house');

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
      payment_date: coerceToCalendarDayStart(date),
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
      received_at: coerceToCalendarDate(date),
      user_id: null,
      house_id: houseId,
      fortnight_id: houseFortnightId,
      wallet_id: houseWalletId ?? null,
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
    },
    include: {
      user_expense: true,
      house_income: true,
    },
  });

  return updatedTransfer;
}

export async function createUserToHouseTransfer(
  input: CreateUserToHouseTransferInput,
) {
  return prisma.$transaction((tx) => createUserToHouseTransferInTx(tx, input));
}
