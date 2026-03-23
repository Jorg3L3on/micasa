import { PaymentMethodType } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import type {
  CreateCreditCardInput,
  CreateCreditCardPaymentInput,
  CreateCreditCardPurchaseInput,
  UpdateCreditCardInput,
} from '@/schemas/credit-card.schema';
import {
  applyWalletAmountDelta,
  ensureCreditWalletType,
  ensureFundingWalletType,
  getWalletAvailableCredit,
  isCreditWalletType,
  toWalletAmountNumber,
} from '@/lib/finance/wallet-accounting';
import { createWalletForOwner, updateWalletMetadataForOwner } from '@/lib/finance/wallet.service';
import { createExpense } from '@/lib/finance/expense.service';
import {
  getFortnightPeriodForDay,
  resolveOrCreateFortnight,
} from '@/lib/fortnights';

const creditCardWalletTypes: PaymentMethodType[] = [
  PaymentMethodType.CREDIT_CARD,
  PaymentMethodType.DEPARTMENT_STORE_CARD,
];

const creditCardWalletWhere = {
  type: {
    in: creditCardWalletTypes,
  },
};

const mapWalletToCreditCardDto = (wallet: {
  id: number;
  name: string;
  amount: unknown;
  credit_limit: unknown;
  type: string;
  active: boolean;
  cutoff_day: number | null;
  due_day: number | null;
}) => {
  const currentBalance = Number(wallet.amount);
  const creditLimit =
    wallet.credit_limit == null ? null : Number(wallet.credit_limit);

  return {
    id: wallet.id,
    name: wallet.name,
    amount: currentBalance,
    credit_limit: creditLimit,
    available_credit: getWalletAvailableCredit({
      amount: currentBalance,
      credit_limit: creditLimit,
    }),
    type: wallet.type,
    active: wallet.active,
    cutoff_day: wallet.cutoff_day,
    due_day: wallet.due_day,
  };
};

export async function listCreditCardsByOwner(ownerFilter: OwnerFilter) {
  const wallets = await prisma.wallet.findMany({
    where: {
      ...ownerFilter,
      ...creditCardWalletWhere,
    },
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
  });

  return wallets.map(mapWalletToCreditCardDto);
}

export async function getCreditCardByOwner(
  id: number,
  ownerFilter: OwnerFilter,
) {
  const wallet = await prisma.wallet.findFirst({
    where: {
      id,
      ...ownerFilter,
      ...creditCardWalletWhere,
    },
  });

  if (!wallet) {
    const error = new Error('Tarjeta no encontrada');
    (error as { code?: string }).code = 'P2025';
    throw error;
  }

  return mapWalletToCreditCardDto(wallet);
}

export async function createCreditCardForOwner(
  ownerType: 'user' | 'house',
  ownerId: number,
  data: CreateCreditCardInput,
) {
  const wallet = await createWalletForOwner(ownerType, ownerId, data);
  return mapWalletToCreditCardDto(wallet);
}

export async function updateCreditCardForOwner(
  id: number,
  data: UpdateCreditCardInput,
  ownerFilter: OwnerFilter,
) {
  const wallet = await updateWalletMetadataForOwner(id, data, ownerFilter);

  if (!isCreditWalletType(wallet.type)) {
    const error = new Error('La billetera no es una tarjeta de crédito');
    (error as { code?: string }).code = 'INVALID_CREDIT_CARD';
    throw error;
  }

  return mapWalletToCreditCardDto(wallet);
}

export async function createCreditCardPurchase(
  creditCardId: number,
  ownerFilter: OwnerFilter,
  input: CreateCreditCardPurchaseInput,
) {
  const wallet = await prisma.wallet.findFirst({
    where: {
      id: creditCardId,
      ...ownerFilter,
      ...creditCardWalletWhere,
    },
    select: { id: true },
  });

  if (!wallet) {
    const error = new Error('Tarjeta no encontrada');
    (error as { code?: string }).code = 'P2025';
    throw error;
  }

  return createExpense({
    fortnightId: input.fortnight_id,
    categoryId: input.category_id,
    description: input.description,
    amount: input.amount,
    isPaid: true,
    paymentDate: input.payment_date ?? null,
    expenseTemplateId: input.expense_template_id ?? null,
    walletId: creditCardId,
    creditMsiCurrent: input.credit_msi_current ?? null,
    creditMsiTotal: input.credit_msi_total ?? null,
  });
}

export async function createCreditCardPayment(
  creditCardId: number,
  ownerFilter: OwnerFilter,
  input: CreateCreditCardPaymentInput,
) {
  return prisma.$transaction(async (tx) => {
    const [creditCardWallet, sourceWallet] = await Promise.all([
      tx.wallet.findFirst({
        where: { id: creditCardId, ...ownerFilter },
        select: {
          id: true,
          name: true,
          type: true,
          amount: true,
          user_id: true,
          house_id: true,
        },
      }),
      tx.wallet.findFirst({
        where: { id: input.source_wallet_id, ...ownerFilter },
        select: {
          id: true,
          name: true,
          type: true,
          amount: true,
          user_id: true,
          house_id: true,
        },
      }),
    ]);

    if (!creditCardWallet) {
      const error = new Error('Tarjeta no encontrada');
      (error as { code?: string }).code = 'P2025';
      throw error;
    }

    if (!sourceWallet) {
      const error = new Error('Billetera de origen no encontrada');
      (error as { code?: string }).code = 'WALLET_NOT_FOUND';
      throw error;
    }

    ensureCreditWalletType(creditCardWallet);
    ensureFundingWalletType(sourceWallet);

    if (creditCardWallet.id === sourceWallet.id) {
      const error = new Error(
        'La billetera de origen debe ser distinta de la tarjeta',
      );
      (error as { code?: string }).code = 'INVALID_PAYMENT_SOURCE_WALLET';
      throw error;
    }

    if (
      creditCardWallet.user_id !== sourceWallet.user_id ||
      creditCardWallet.house_id !== sourceWallet.house_id
    ) {
      const error = new Error(
        'La billetera de origen debe pertenecer al mismo titular',
      );
      (error as { code?: string }).code = 'INVALID_PAYMENT_SOURCE_OWNER';
      throw error;
    }

    const currentDebt = toWalletAmountNumber(creditCardWallet);
    if (input.amount > currentDebt) {
      const error = new Error(
        'El monto del pago no puede superar la deuda actual de la tarjeta',
      );
      (error as { code?: string }).code = 'INVALID_PAYMENT_AMOUNT';
      throw error;
    }

    const sourceBalance = toWalletAmountNumber(sourceWallet);
    if (sourceBalance < input.amount) {
      const error = new Error('Saldo insuficiente en la billetera de origen');
      (error as { code?: string }).code = 'INSUFFICIENT_SOURCE_BALANCE';
      throw error;
    }

    const payment = await tx.creditCardPayment.create({
      data: {
        amount: input.amount,
        paid_at: new Date(input.paid_at),
        note: input.note ?? null,
        credit_card_wallet_id: creditCardWallet.id,
        source_wallet_id: sourceWallet.id,
        user_id: creditCardWallet.user_id,
        house_id: creditCardWallet.house_id,
      },
      include: {
        source_wallet: { select: { id: true, name: true } },
        credit_card_wallet: { select: { id: true, name: true } },
      },
    });

    await applyWalletAmountDelta(tx, sourceWallet.id, -input.amount);
    await applyWalletAmountDelta(tx, creditCardWallet.id, -input.amount);

    let expenseId: number | null = null;
    if (input.create_fortnight_expense === true && input.category_id != null) {
      const category = await tx.category.findFirst({
        where: { id: input.category_id, ...ownerFilter },
      });
      if (!category) {
        const error = new Error('Categoría no encontrada');
        (error as { code?: string }).code = 'CATEGORY_NOT_FOUND';
        throw error;
      }

      const paidAt = new Date(input.paid_at);
      const fnYear = paidAt.getUTCFullYear();
      const fnMonth = paidAt.getUTCMonth() + 1;
      const fnDay = paidAt.getUTCDate();
      const fnPeriod = getFortnightPeriodForDay(fnDay);

      const ownerUserId = creditCardWallet.user_id;
      const ownerHouseId = creditCardWallet.house_id;
      if (ownerUserId == null && ownerHouseId == null) {
        const error = new Error('Titular de tarjeta inválido');
        (error as { code?: string }).code = 'INVALID_CARD_OWNER';
        throw error;
      }

      const fortnight = await resolveOrCreateFortnight({
        ownerType: ownerUserId != null ? 'user' : 'house',
        ownerId: ownerUserId != null ? ownerUserId : ownerHouseId!,
        year: fnYear,
        month: fnMonth,
        period: fnPeriod,
        tx,
      });

      const description =
        input.expense_description?.trim() ||
        `Pago tarjeta: ${creditCardWallet.name}`;

      const expense = await tx.expense.create({
        data: {
          fortnight_id: fortnight.id,
          wallet_id: sourceWallet.id,
          category_id: input.category_id,
          description,
          amount: input.amount,
          is_paid: true,
          payment_date: new Date(input.paid_at),
          expense_template_id: null,
          user_id: fortnight.user_id,
          house_id: fortnight.house_id,
        },
      });

      expenseId = expense.id;

      await tx.creditCardPayment.update({
        where: { id: payment.id },
        data: { expense_id: expenseId },
      });
    }

    return {
      id: payment.id,
      amount: Number(payment.amount),
      paid_at: payment.paid_at.toISOString().split('T')[0],
      note: payment.note ?? null,
      source_wallet_id: payment.source_wallet_id,
      source_wallet_name: payment.source_wallet.name,
      credit_card_wallet_id: payment.credit_card_wallet_id,
      credit_card_wallet_name: payment.credit_card_wallet.name,
      expense_id: expenseId,
    };
  });
}

export async function listCreditCardPaymentsByOwner(
  creditCardId: number,
  ownerFilter: OwnerFilter,
) {
  const wallet = await prisma.wallet.findFirst({
    where: {
      id: creditCardId,
      ...ownerFilter,
      ...creditCardWalletWhere,
    },
    select: { id: true },
  });

  if (!wallet) {
    const error = new Error('Tarjeta no encontrada');
    (error as { code?: string }).code = 'P2025';
    throw error;
  }

  const payments = await prisma.creditCardPayment.findMany({
    where: {
      ...ownerFilter,
      credit_card_wallet_id: creditCardId,
    },
    include: {
      source_wallet: { select: { id: true, name: true } },
      credit_card_wallet: { select: { id: true, name: true } },
    },
    orderBy: { paid_at: 'desc' },
  });

  return payments.map((payment) => ({
    id: payment.id,
    amount: Number(payment.amount),
    paid_at: payment.paid_at.toISOString().split('T')[0],
    note: payment.note ?? null,
    source_wallet_id: payment.source_wallet_id,
    source_wallet_name: payment.source_wallet.name,
    credit_card_wallet_id: payment.credit_card_wallet_id,
    credit_card_wallet_name: payment.credit_card_wallet.name,
  }));
}
