import prisma from '@/lib/prisma';
import type {
  CreateWalletInput,
  UpdateWalletInput,
} from '@/schemas/wallet.schema';
import type { OwnerFilter } from '@/lib/server/get-owner-context';

export async function listWallets(userId: number) {
  const memberships = await prisma.houseMember.findMany({
    where: {
      user_id: userId,
    },
    select: {
      house_id: true,
    },
  });
  const houseIds = memberships.map((m) => m.house_id);

  return prisma.wallet.findMany({
    where: {
      OR: [
        { user_id: userId },
        { house_id: { in: houseIds } },
      ],
    },
    orderBy: [
      { active: 'desc' },
      { name: 'asc' },
    ],
  });
}

export async function listWalletsByOwner(ownerFilter: OwnerFilter) {
  const wallets = await prisma.wallet.findMany({
    where: ownerFilter,
    orderBy: [
      { active: 'desc' },
      { name: 'asc' },
    ],
  });

  const walletIds = wallets.map((w) => w.id);
  const expenseSums = await prisma.expense.groupBy({
    by: ['wallet_id'],
    where: {
      wallet_id: { in: walletIds },
      is_paid: false,
    },
    _sum: { amount: true },
  });

  const spentMap = new Map(
    expenseSums.map((e) => [e.wallet_id, Number(e._sum.amount ?? 0)]),
  );

  return wallets.map((w) => {
    const spent = spentMap.get(w.id) ?? 0;
    return {
      ...w,
      spent_amount: spent,
      remaining_amount: Number(w.amount) - spent,
    };
  });
}

export async function createWalletForDefaultUser(data: CreateWalletInput) {
  const defaultUser = await prisma.user.findFirst({
    where: { active: true },
    select: { id: true },
  });

  if (!defaultUser) {
    const error = new Error('No active user found to own wallet');
    (error as any).code = 'NO_DEFAULT_USER';
    throw error;
  }

  return prisma.wallet.create({
    data: {
      name: data.name,
      amount: data.amount,
      type: data.type,
      active: data.active,
      cutoff_day: data.cutoff_day,
      due_day: data.due_day,
      user_id: defaultUser.id,
      house_id: null,
    },
  });
}

export async function createWalletForUser(
  userId: number,
  data: CreateWalletInput,
) {
  return prisma.wallet.create({
    data: {
      name: data.name,
      amount: data.amount,
      type: data.type,
      active: data.active,
      cutoff_day: data.cutoff_day,
      due_day: data.due_day,
      user_id: userId,
      house_id: null,
    },
  });
}

export async function createWalletForOwner(
  ownerType: 'user' | 'house',
  ownerId: number,
  data: CreateWalletInput,
) {
  return prisma.wallet.create({
    data: {
      name: data.name,
      amount: data.amount,
      type: data.type,
      active: data.active,
      cutoff_day: data.cutoff_day,
      due_day: data.due_day,
      user_id: ownerType === 'user' ? ownerId : null,
      house_id: ownerType === 'house' ? ownerId : null,
    },
  });
}

export async function updateWalletMetadata(id: number, data: UpdateWalletInput) {
  return prisma.wallet.update({
    where: { id },
    data,
  });
}

export async function updateWalletMetadataForOwner(
  id: number,
  data: UpdateWalletInput,
  ownerFilter: OwnerFilter,
) {
  const existing = await prisma.wallet.findFirst({
    where: { id, ...ownerFilter },
  });
  if (!existing) {
    const error = new Error('Wallet not found');
    (error as any).code = 'P2025';
    throw error;
  }
  return prisma.wallet.update({
    where: { id },
    data,
  });
}

export async function deleteWalletIfUnused(id: number) {
  const relatedExpense = await prisma.expense.findFirst({
    where: { wallet_id: id },
  });
  const relatedExpenseTemplate = await prisma.expenseTemplate.findFirst({
    where: { wallet_id: id },
  });

  if (relatedExpense || relatedExpenseTemplate) {
    const error = new Error(
      'La cartera tiene gastos o plantillas asociadas y no puede eliminarse',
    );
    (error as any).code = 'WALLET_IN_USE';
    throw error;
  }

  await prisma.wallet.delete({ where: { id } });
}

export async function deleteWalletIfUnusedForOwner(
  id: number,
  ownerFilter: OwnerFilter,
) {
  const existing = await prisma.wallet.findFirst({
    where: { id, ...ownerFilter },
  });
  if (!existing) {
    const error = new Error('Wallet not found');
    (error as any).code = 'P2025';
    throw error;
  }
  const relatedExpense = await prisma.expense.findFirst({
    where: { wallet_id: id },
  });
  const relatedExpenseTemplate = await prisma.expenseTemplate.findFirst({
    where: { wallet_id: id },
  });

  if (relatedExpense || relatedExpenseTemplate) {
    const error = new Error(
      'La cartera tiene gastos o plantillas asociadas y no puede eliminarse',
    );
    (error as any).code = 'WALLET_IN_USE';
    throw error;
  }

  await prisma.wallet.delete({ where: { id } });
}

