import { PaymentMethodType } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import type {
  CreateWalletInput,
  UpdateWalletInput,
} from '@/schemas/wallet.schema';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import { isCreditWalletType } from '@/lib/finance/wallet-accounting';
import { resolveWalletAssignee } from '@/lib/server/wallets/resolve-wallet-assignee';
import { parseWalletProviderIconKey } from '@/lib/wallet-provider-icons';
import type { WalletListItem } from '@/types/catalog';

const ASSIGNEE_INCLUDE = {
  assignee: { select: { id: true, name: true } },
} as const;

const mapWalletRowToListDto = (
  w: {
    id: number;
    name: string;
    provider_icon_key: string | null;
    amount: unknown;
    credit_limit: unknown;
    type: string;
    active: boolean;
    cutoff_day: number | null;
    due_day: number | null;
    assignee_user_id: number | null;
    assignee: { id: number; name: string } | null;
  },
  spent: number,
) => {
  const amountNum = Number(w.amount);
  return {
    id: w.id,
    name: w.name,
    provider_icon_key: parseWalletProviderIconKey(w.provider_icon_key),
    amount: amountNum,
    credit_limit: w.credit_limit == null ? null : Number(w.credit_limit),
    type: w.type,
    active: w.active,
    cutoff_day: w.cutoff_day,
    due_day: w.due_day,
    spent_amount: spent,
    remaining_amount: amountNum - spent,
    assignee_user_id: w.assignee_user_id ?? null,
    assignee: w.assignee ? { id: w.assignee.id, name: w.assignee.name } : null,
  };
};

type WalletServiceError = Error & { code?: string };

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

export async function listWalletsByOwner(
  ownerFilter: OwnerFilter,
): Promise<WalletListItem[]> {
  const wallets = await prisma.wallet.findMany({
    where: ownerFilter,
    include: ASSIGNEE_INCLUDE,
    orderBy: [
      { active: 'desc' },
      { name: 'asc' },
    ],
  });

  wallets.sort((a, b) => {
    if (a.active !== b.active) {
      return a.active ? -1 : 1;
    }
    const ca = isCreditWalletType(a.type as PaymentMethodType);
    const cb = isCreditWalletType(b.type as PaymentMethodType);
    if (ca !== cb) {
      return ca ? 1 : -1;
    }
    return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
  });

  const walletIds = wallets.map((w) => w.id);
  const expenseSums =
    walletIds.length === 0
      ? []
      : await prisma.expense.groupBy({
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
    return mapWalletRowToListDto(w, spent);
  });
}

export async function createWalletForDefaultUser(data: CreateWalletInput) {
  const defaultUser = await prisma.user.findFirst({
    where: { active: true },
    select: { id: true },
  });

  if (!defaultUser) {
    const error = new Error('No active user found to own wallet') as WalletServiceError;
    error.code = 'NO_DEFAULT_USER';
    throw error;
  }

  const assignee_user_id = await resolveWalletAssignee(
    'user',
    defaultUser.id,
    data.assignee_user_id,
  );

  return prisma.wallet.create({
    data: {
      name: data.name,
      amount: data.amount,
      credit_limit: data.credit_limit,
      type: data.type,
      provider_icon_key: data.provider_icon_key ?? null,
      active: data.active,
      cutoff_day: data.cutoff_day,
      due_day: data.due_day,
      user_id: defaultUser.id,
      house_id: null,
      assignee_user_id,
    },
  });
}

export async function createWalletForUser(
  userId: number,
  data: CreateWalletInput,
) {
  const assignee_user_id = await resolveWalletAssignee('user', userId, data.assignee_user_id);

  return prisma.wallet.create({
    data: {
      name: data.name,
      amount: data.amount,
      credit_limit: data.credit_limit,
      type: data.type,
      provider_icon_key: data.provider_icon_key ?? null,
      active: data.active,
      cutoff_day: data.cutoff_day,
      due_day: data.due_day,
      user_id: userId,
      house_id: null,
      assignee_user_id,
    },
  });
}

export async function createWalletForOwner(
  ownerType: 'user' | 'house',
  ownerId: number,
  data: CreateWalletInput,
) {
  const assignee_user_id = await resolveWalletAssignee(
    ownerType,
    ownerId,
    data.assignee_user_id,
  );

  return prisma.wallet.create({
    data: {
      name: data.name,
      amount: data.amount,
      credit_limit: data.credit_limit,
      type: data.type,
      provider_icon_key: data.provider_icon_key ?? null,
      active: data.active,
      cutoff_day: data.cutoff_day,
      due_day: data.due_day,
      user_id: ownerType === 'user' ? ownerId : null,
      house_id: ownerType === 'house' ? ownerId : null,
      assignee_user_id,
    },
    include: ASSIGNEE_INCLUDE,
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
    const error = new Error('Wallet not found') as WalletServiceError;
    error.code = 'P2025';
    throw error;
  }

  const { assignee_user_id: assigneePatch, ...rest } = data;
  const ownerType = existing.house_id != null ? 'house' : 'user';
  const ownerId = existing.house_id ?? existing.user_id;
  if (ownerId == null) {
    const error = new Error('Wallet has no owner') as WalletServiceError;
    error.code = 'P2025';
    throw error;
  }

  let assignee_user_id: number | null | undefined;
  if (assigneePatch !== undefined) {
    assignee_user_id = await resolveWalletAssignee(ownerType, ownerId, assigneePatch);
  }

  const prismaData = {
    ...rest,
    ...(assigneePatch !== undefined ? { assignee_user_id } : {}),
  };

  return prisma.wallet.update({
    where: { id },
    data: prismaData,
    include: ASSIGNEE_INCLUDE,
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
    ) as WalletServiceError;
    error.code = 'WALLET_IN_USE';
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
    const error = new Error('Wallet not found') as WalletServiceError;
    error.code = 'P2025';
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
    ) as WalletServiceError;
    error.code = 'WALLET_IN_USE';
    throw error;
  }

  await prisma.wallet.delete({ where: { id } });
}

