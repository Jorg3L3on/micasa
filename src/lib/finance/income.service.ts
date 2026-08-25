import { coerceToCalendarDate, formatCalendarDate } from '@/lib/calendar-dates';
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

export type UpdateIncomeForOwnerInput = {
  id: number;
  ownerFilter: OwnerFilter;
  amount: number;
  walletId?: number;
  forceWalletCredit?: boolean;
};

export async function listIncomesForFortnight(
  ownerFilter: OwnerFilter,
  fortnightId: number,
) {
  const fortnight = await prisma.fortnight.findFirst({
    where: { id: fortnightId, ...ownerFilter },
    select: { id: true },
  });
  if (!fortnight) {
    throw new Error('Quincena no válida para este contexto');
  }

  const incomes = await prisma.income.findMany({
    where: { ...ownerFilter, fortnight_id: fortnightId },
    orderBy: { received_at: 'asc' },
    include: {
      wallet: { select: { id: true, name: true } },
    },
  });

  return incomes.map((income) => ({
    id: income.id,
    amount: Number(income.amount),
    source: income.source,
    received_at: formatCalendarDate(income.received_at),
    fortnight_id: income.fortnight_id,
    income_template_id: income.income_template_id,
    wallet_id: income.wallet_id,
    wallet_name: income.wallet?.name ?? null,
  }));
}

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

/** Same wallet delta rules as PUT /api/incomes?id=… */
export async function updateIncomeForOwner(input: UpdateIncomeForOwnerInput) {
  const income = await prisma.income.findFirst({
    where: { id: input.id, ...input.ownerFilter },
  });
  if (!income) {
    throw new Error('Ingreso no encontrado');
  }

  if (income.source === '__OVERRIDE__') {
    throw new Error('No se puede editar el override de ingreso de la quincena');
  }

  const oldAmount = Number(income.amount);
  const newAmount = input.amount;
  const oldWalletId = income.wallet_id;
  const newWalletId =
    input.walletId !== undefined ? input.walletId : oldWalletId;

  if (newWalletId == null) {
    throw new Error(
      'La billetera es requerida. Asigna una billetera de efectivo o débito a este ingreso.',
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (oldWalletId === null && newWalletId != null) {
      await applyWalletAmountDelta(tx, newWalletId, newAmount);
    } else if (oldWalletId != null && newWalletId != null) {
      if (oldWalletId === newWalletId) {
        if (input.forceWalletCredit === true) {
          await applyWalletAmountDelta(tx, newWalletId, newAmount);
        } else {
          const delta = newAmount - oldAmount;
          if (delta !== 0) {
            await applyWalletAmountDelta(tx, newWalletId, delta);
          }
        }
      } else {
        await applyWalletAmountDelta(tx, oldWalletId, -oldAmount);
        await applyWalletAmountDelta(tx, newWalletId, newAmount);
      }
    }

    return tx.income.update({
      where: { id: input.id },
      data: {
        amount: newAmount,
        wallet_id: newWalletId,
      },
    });
  });

  const wallet = await prisma.wallet.findUnique({
    where: { id: updated.wallet_id ?? undefined },
    select: { amount: true, name: true },
  });

  return {
    income_id: updated.id,
    amount: Number(updated.amount),
    received_at: formatCalendarDate(updated.received_at),
    wallet_id: updated.wallet_id,
    wallet_name: wallet?.name ?? null,
    new_balance: wallet ? Number(wallet.amount) : null,
  };
}

/** Reverses wallet credit then deletes the income row. */
export async function deleteIncomeForOwner(
  id: number,
  ownerFilter: OwnerFilter,
) {
  const income = await prisma.income.findFirst({
    where: { id, ...ownerFilter },
  });
  if (!income) {
    throw new Error('Ingreso no encontrado');
  }

  if (income.source === '__OVERRIDE__') {
    throw new Error('No se puede eliminar el override de ingreso de la quincena');
  }

  await prisma.$transaction(async (tx) => {
    if (income.wallet_id != null) {
      await applyWalletAmountDelta(tx, income.wallet_id, -Number(income.amount));
    }
    await tx.income.delete({ where: { id } });
  });

  return { deleted: true, income_id: id };
}
