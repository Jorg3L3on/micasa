import { coerceToCalendarDate } from '@/lib/calendar-dates';
import prisma from '@/lib/prisma';
import { applyWalletAmountDelta } from '@/lib/finance/wallet-accounting';
import type { OwnerFilter } from '@/lib/server/get-owner-context';

export type CreateIncomeForOwnerInput = {
  fortnightId: number;
  walletId: number;
  amount: number;
  description?: string | null;
  receivedAt: string;
  incomeTemplateId?: number | null;
};

export async function createIncomeForOwner(
  ownerFilter: OwnerFilter,
  input: CreateIncomeForOwnerInput,
) {
  const wallet = await prisma.wallet.findFirst({
    where: { id: input.walletId, ...ownerFilter },
    select: { id: true, type: true },
  });
  if (!wallet) {
    throw new Error('Billetera no encontrada en este contexto');
  }

  const fortnight = await prisma.fortnight.findFirst({
    where: { id: input.fortnightId, ...ownerFilter },
    select: { id: true },
  });
  if (!fortnight) {
    throw new Error('Quincena no válida para este contexto');
  }

  return prisma.$transaction(async (tx) => {
    const income = await tx.income.create({
      data: {
        fortnight_id: input.fortnightId,
        amount: input.amount,
        source: input.description?.trim() ? input.description.trim() : null,
        received_at: coerceToCalendarDate(input.receivedAt),
        income_template_id: input.incomeTemplateId ?? null,
        wallet_id: input.walletId,
        ...ownerFilter,
      },
    });

    await applyWalletAmountDelta(tx, input.walletId, input.amount);

    const updatedWallet = await tx.wallet.findUnique({
      where: { id: input.walletId },
      select: { amount: true },
    });

    return {
      income_id: income.id,
      amount: Number(income.amount),
      received_at: input.receivedAt,
      wallet_id: input.walletId,
      new_balance: updatedWallet ? Number(updatedWallet.amount) : null,
    };
  });
}
