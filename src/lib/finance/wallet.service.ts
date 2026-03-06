import prisma from '@/lib/prisma';
import type {
  CreateWalletInput,
  UpdateWalletInput,
} from '@/schemas/wallet.schema';

export async function listWallets() {
  return prisma.wallet.findMany({
    orderBy: [
      { active: 'desc' },
      { name: 'asc' },
    ],
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

export async function updateWalletMetadata(id: number, data: UpdateWalletInput) {
  const { amount: _ignoredAmount, ...updateFields } = data;
  return prisma.wallet.update({
    where: { id },
    data: updateFields,
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

