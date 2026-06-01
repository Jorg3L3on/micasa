import { formatCalendarDate, coerceToCalendarDate } from '@/lib/calendar-dates';
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
import { getFortnightPeriodForDay } from '@/lib/fortnight-calendar';
import { resolveOrCreateFortnight } from '@/lib/fortnights';

const creditCardWalletTypes: PaymentMethodType[] = [
  PaymentMethodType.CREDIT_CARD,
  PaymentMethodType.DEPARTMENT_STORE_CARD,
];

const creditCardWalletWhere = {
  type: {
    in: creditCardWalletTypes,
  },
};

const CREDIT_CARD_ASSIGNEE_INCLUDE = {
  assignee: { select: { id: true, name: true } },
} as const;

const mapWalletToCreditCardDto = (
  wallet: {
    id: number;
    name: string;
    provider_icon_key: string | null;
    amount: unknown;
    credit_limit: unknown;
    temporary_credit_limit?: unknown;
    temporary_credit_limit_as_of?: Date | null;
    type: string;
    active: boolean;
    cutoff_day: number | null;
    due_day: number | null;
    assignee_user_id: number | null;
    assignee: { id: number; name: string } | null;
  },
  spent: number,
) => {
  const currentBalance = Number(wallet.amount);
  const creditLimit =
    wallet.credit_limit == null ? null : Number(wallet.credit_limit);
  const temporaryCreditLimit =
    wallet.temporary_credit_limit == null
      ? null
      : Number(wallet.temporary_credit_limit);

  return {
    id: wallet.id,
    name: wallet.name,
    provider_icon_key: wallet.provider_icon_key,
    amount: currentBalance,
    credit_limit: creditLimit,
    temporary_credit_limit: temporaryCreditLimit,
    temporary_credit_limit_as_of:
      wallet.temporary_credit_limit_as_of == null
        ? null
        : wallet.temporary_credit_limit_as_of.toISOString(),
    available_credit: getWalletAvailableCredit({
      amount: currentBalance,
      credit_limit: creditLimit,
      temporary_credit_limit: temporaryCreditLimit,
    }),
    type: wallet.type,
    active: wallet.active,
    cutoff_day: wallet.cutoff_day,
    due_day: wallet.due_day,
    spent_amount: spent,
    remaining_amount: currentBalance - spent,
    assignee_user_id: wallet.assignee_user_id ?? null,
    assignee: wallet.assignee
      ? { id: wallet.assignee.id, name: wallet.assignee.name }
      : null,
  };
};

export async function listCreditCardsByOwner(ownerFilter: OwnerFilter) {
  const wallets = await prisma.wallet.findMany({
    where: {
      ...ownerFilter,
      ...creditCardWalletWhere,
    },
    include: CREDIT_CARD_ASSIGNEE_INCLUDE,
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
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

  return wallets.map((w) =>
    mapWalletToCreditCardDto(w, spentMap.get(w.id) ?? 0),
  );
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
    include: CREDIT_CARD_ASSIGNEE_INCLUDE,
  });

  if (!wallet) {
    const error = new Error('Tarjeta no encontrada');
    (error as { code?: string }).code = 'P2025';
    throw error;
  }

  const spentAgg = await prisma.expense.aggregate({
    where: {
      wallet_id: id,
      is_paid: false,
    },
    _sum: { amount: true },
  });
  const spent = Number(spentAgg._sum.amount ?? 0);

  return mapWalletToCreditCardDto(wallet, spent);
}

export async function createCreditCardForOwner(
  ownerType: 'user' | 'house',
  ownerId: number,
  data: CreateCreditCardInput,
) {
  const wallet = await createWalletForOwner(ownerType, ownerId, data);
  return mapWalletToCreditCardDto(wallet, 0);
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

  const spentAgg = await prisma.expense.aggregate({
    where: {
      wallet_id: id,
      is_paid: false,
    },
    _sum: { amount: true },
  });
  const spent = Number(spentAgg._sum.amount ?? 0);

  return mapWalletToCreditCardDto(wallet, spent);
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
    creditInstallmentCurrent: input.credit_installment_current ?? null,
    creditInstallmentTotal: input.credit_installment_total ?? null,
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
        paid_at: coerceToCalendarDate(input.paid_at),
        note: input.note ?? null,
        credit_card_wallet_id: creditCardWallet.id,
        source_wallet_id: sourceWallet.id,
        user_id: creditCardWallet.user_id,
        house_id: creditCardWallet.house_id,
      },
      include: {
        source_wallet: { select: { id: true, name: true, provider_icon_key: true } },
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

      const paidAt = coerceToCalendarDate(input.paid_at);
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
          payment_date: coerceToCalendarDate(input.paid_at),
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
      paid_at: formatCalendarDate(payment.paid_at),
      note: payment.note ?? null,
      source_wallet_id: payment.source_wallet_id,
      source_wallet_name: payment.source_wallet.name,
      source_wallet_provider_icon_key: payment.source_wallet.provider_icon_key ?? null,
      credit_card_wallet_id: payment.credit_card_wallet_id,
      credit_card_wallet_name: payment.credit_card_wallet.name,
      expense_id: expenseId,
    };
  }, { timeout: 30000, maxWait: 10000 });
}

export async function isCardPaymentGeneratedExpense(
  expenseId: number,
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0] = prisma,
): Promise<boolean> {
  const payment = await tx.creditCardPayment.findFirst({
    where: { expense_id: expenseId },
    select: { id: true },
  });
  return payment != null;
}

async function deleteCardPaymentGeneratedExpense(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  expenseId: number,
) {
  await tx.expense.delete({ where: { id: expenseId } });
}

export async function reverseCreditCardPayment(
  creditCardId: number,
  paymentId: number,
  ownerFilter: OwnerFilter,
) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.creditCardPayment.findFirst({
      where: {
        id: paymentId,
        credit_card_wallet_id: creditCardId,
        ...ownerFilter,
      },
      select: {
        id: true,
        amount: true,
        expense_id: true,
        source_wallet_id: true,
        credit_card_wallet_id: true,
      },
    });

    if (!payment) {
      const error = new Error('Pago no encontrado');
      (error as { code?: string }).code = 'PAYMENT_NOT_FOUND';
      throw error;
    }

    const amount = Number(payment.amount);

    await applyWalletAmountDelta(tx, payment.source_wallet_id, amount);
    await applyWalletAmountDelta(tx, payment.credit_card_wallet_id, amount);

    if (payment.expense_id != null) {
      await deleteCardPaymentGeneratedExpense(tx, payment.expense_id);
    }

    await tx.creditCardPayment.delete({ where: { id: payment.id } });

    return {
      id: payment.id,
      amount,
      expense_id: payment.expense_id,
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
      source_wallet: { select: { id: true, name: true, provider_icon_key: true } },
      credit_card_wallet: { select: { id: true, name: true } },
    },
    orderBy: { paid_at: 'desc' },
  });

  return payments.map((payment) => ({
    id: payment.id,
    amount: Number(payment.amount),
    paid_at: formatCalendarDate(payment.paid_at),
    note: payment.note ?? null,
    source_wallet_id: payment.source_wallet_id,
    source_wallet_name: payment.source_wallet.name,
    source_wallet_provider_icon_key: payment.source_wallet.provider_icon_key ?? null,
    credit_card_wallet_id: payment.credit_card_wallet_id,
    credit_card_wallet_name: payment.credit_card_wallet.name,
  }));
}
