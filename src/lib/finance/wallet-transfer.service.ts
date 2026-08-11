import type { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { parseCalendarDate } from '@/lib/calendar-dates';
import {
  applyWalletAmountDelta,
  isFundingWalletType,
  toWalletAmountNumber,
} from '@/lib/finance/wallet-accounting';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import type { CreateWalletTransferInput } from '@/schemas/wallet-transfer.schema';

export type WalletTransferCodedError = Error & { code?: string; status?: number };

function codedError(
  message: string,
  code: string,
  status = 400,
): WalletTransferCodedError {
  const error = new Error(message) as WalletTransferCodedError;
  error.code = code;
  error.status = status;
  return error;
}

function matchesOwner(
  wallet: { user_id: number | null; house_id: number | null },
  ownerFilter: OwnerFilter,
): boolean {
  if (ownerFilter.house_id == null) {
    return wallet.user_id === ownerFilter.user_id && wallet.house_id == null;
  }
  return wallet.house_id === ownerFilter.house_id && wallet.user_id == null;
}

export type CreateWalletTransferResult = {
  id: number;
  amount: number;
  fee_amount: number;
  from_wallet_id: number;
  to_wallet_id: number;
  note: string | null;
  transferred_at: string;
  exclude_from_report: boolean;
  from_wallet_amount: number;
  to_wallet_amount: number;
};

export async function createWalletTransferForOwner(
  ownerFilter: OwnerFilter,
  input: CreateWalletTransferInput,
): Promise<CreateWalletTransferResult> {
  const feeAmount = input.fee_amount ?? 0;

  return prisma.$transaction(async (tx) => {
    const wallets = await tx.wallet.findMany({
      where: {
        id: { in: [input.from_wallet_id, input.to_wallet_id] },
        ...ownerFilter,
      },
    });

    const fromWallet = wallets.find((w) => w.id === input.from_wallet_id);
    const toWallet = wallets.find((w) => w.id === input.to_wallet_id);

    if (!fromWallet || !toWallet) {
      throw codedError(
        'No se encontraron las billeteras',
        'WALLET_NOT_FOUND',
        404,
      );
    }

    if (!matchesOwner(fromWallet, ownerFilter) || !matchesOwner(toWallet, ownerFilter)) {
      throw codedError(
        'Las billeteras deben pertenecer al contexto activo',
        'WALLET_OWNER_MISMATCH',
        403,
      );
    }

    if (!isFundingWalletType(fromWallet.type) || !isFundingWalletType(toWallet.type)) {
      throw codedError(
        'Solo se puede transferir entre efectivo y débito',
        'INVALID_WALLET_TYPE',
      );
    }

    if (!fromWallet.active || !toWallet.active) {
      throw codedError(
        'Ambas billeteras deben estar activas',
        'INACTIVE_WALLET',
      );
    }

    const transferredAt = parseCalendarDate(input.transferred_at);

    const ownerData: Prisma.WalletTransferCreateInput = {
      amount: input.amount,
      fee_amount: feeAmount,
      note: input.note?.trim() ? input.note.trim() : null,
      transferred_at: transferredAt,
      exclude_from_report: input.exclude_from_report ?? true,
      from_wallet: { connect: { id: fromWallet.id } },
      to_wallet: { connect: { id: toWallet.id } },
      ...(ownerFilter.house_id == null
        ? { user: { connect: { id: ownerFilter.user_id } } }
        : { house: { connect: { id: ownerFilter.house_id } } }),
    };

    const transfer = await tx.walletTransfer.create({
      data: ownerData,
    });

    const sourceDelta = -(input.amount + feeAmount);
    await applyWalletAmountDelta(tx, fromWallet.id, sourceDelta);
    await applyWalletAmountDelta(tx, toWallet.id, input.amount);

    const [updatedFrom, updatedTo] = await Promise.all([
      tx.wallet.findUniqueOrThrow({ where: { id: fromWallet.id } }),
      tx.wallet.findUniqueOrThrow({ where: { id: toWallet.id } }),
    ]);

    return {
      id: transfer.id,
      amount: Number(transfer.amount),
      fee_amount: Number(transfer.fee_amount),
      from_wallet_id: transfer.from_wallet_id,
      to_wallet_id: transfer.to_wallet_id,
      note: transfer.note,
      transferred_at: input.transferred_at,
      exclude_from_report: transfer.exclude_from_report,
      from_wallet_amount: toWalletAmountNumber(updatedFrom),
      to_wallet_amount: toWalletAmountNumber(updatedTo),
    };
  });
}
