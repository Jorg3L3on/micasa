import {
  coerceToCalendarDate,
  coerceToCalendarDayStart,
  formatCalendarDate,
} from '@/lib/calendar-dates';
import { PaymentMethodType, type Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import type {
  CreateCreditCardInput,
  CreateCreditCardPurchaseInput,
  NormalizedCreditCardPaymentInput,
  UpdateCreditCardInput,
} from '@/schemas/credit-card.schema';
import { coverScheduledPaymentForCardPayment } from '@/lib/finance/credit-card-scheduled-payment.service';
import { coverInstallmentPlanPaymentForCardPayment } from '@/lib/finance/credit-card-installment-plan.service';
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
  paymentCategoryKindForWallet,
  resolvePaymentCategoryId,
} from '@/lib/finance/payment-category';
import { getCalendarFortnightRefForYmd } from '@/lib/fortnight-calendar';
import { resolveOrCreateFortnight } from '@/lib/fortnights';
import { DomainError } from '@/lib/finance/domain-error';

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
    include_in_liquidity: boolean;
    cutoff_day: number | null;
    due_day: number | null;
    minimum_payment?: unknown;
    apr_annual?: unknown;
    cat_annual?: unknown;
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
    include_in_liquidity: wallet.include_in_liquidity,
    cutoff_day: wallet.cutoff_day,
    due_day: wallet.due_day,
    minimum_payment:
      wallet.minimum_payment == null ? null : Number(wallet.minimum_payment),
    apr_annual: wallet.apr_annual == null ? null : Number(wallet.apr_annual),
    cat_annual: wallet.cat_annual == null ? null : Number(wallet.cat_annual),
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
  const [wallet, spentAgg] = await Promise.all([
    prisma.wallet.findFirst({
      where: {
        id,
        ...ownerFilter,
        ...creditCardWalletWhere,
      },
      include: CREDIT_CARD_ASSIGNEE_INCLUDE,
    }),
    prisma.expense.aggregate({
      where: {
        wallet_id: id,
        is_paid: false,
      },
      _sum: { amount: true },
    }),
  ]);

  if (!wallet) {
    throw new DomainError('P2025', 'Tarjeta no encontrada');
  }

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
    throw new DomainError('INVALID_CREDIT_CARD', 'La billetera no es una tarjeta de crédito');
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

/**
 * Deletes a credit / department-store card wallet owned by the current context.
 * Refuses when expenses, templates, incomes, budget allocations, or transfers
 * still reference the wallet. Credit-card payments are removed; statement
 * imports and payment plans cascade. Loans that only *link* to this wallet
 * (e.g. Mercado Libre) are unlinked so they can remain after the card is gone.
 */
export async function deleteCreditCardForOwner(
  id: number,
  ownerFilter: OwnerFilter,
) {
  const existing = await prisma.wallet.findFirst({
    where: {
      id,
      ...ownerFilter,
      ...creditCardWalletWhere,
    },
    select: { id: true },
  });

  if (!existing) {
    throw new DomainError('P2025', 'Tarjeta no encontrada');
  }

  const [
    relatedExpense,
    relatedExpenseTemplate,
    relatedIncome,
    relatedBudgetAllocation,
    relatedTransfer,
  ] = await Promise.all([
    prisma.expense.findFirst({ where: { wallet_id: id }, select: { id: true } }),
    prisma.expenseTemplate.findFirst({
      where: { wallet_id: id },
      select: { id: true },
    }),
    prisma.income.findFirst({ where: { wallet_id: id }, select: { id: true } }),
    prisma.budgetAllocation.findFirst({
      where: { wallet_id: id },
      select: { id: true },
    }),
    prisma.walletTransfer.findFirst({
      where: {
        OR: [{ from_wallet_id: id }, { to_wallet_id: id }],
      },
      select: { id: true },
    }),
  ]);

  if (
    relatedExpense ||
    relatedExpenseTemplate ||
    relatedIncome ||
    relatedBudgetAllocation ||
    relatedTransfer
  ) {
    throw new DomainError('WALLET_IN_USE', 'La tarjeta tiene movimientos o plantillas asociadas y no puede eliminarse. Desactívala desde Editar si ya no la usas.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.loan.updateMany({
      where: { linked_wallet_id: id },
      data: { linked_wallet_id: null },
    });

    await tx.loan.updateMany({
      where: { source_wallet_id: id },
      data: { source_wallet_id: null },
    });

    await tx.loanPayment.updateMany({
      where: { source_wallet_id: id },
      data: { source_wallet_id: null },
    });

    await tx.creditCardPayment.deleteMany({
      where: {
        OR: [{ credit_card_wallet_id: id }, { source_wallet_id: id }],
      },
    });

    await tx.wallet.delete({ where: { id } });
  });
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
    throw new DomainError('P2025', 'Tarjeta no encontrada');
  }

  const alreadyInCardBalance = input.already_in_card_balance === true;

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
    // Ledger-only when saldo already matches the bank (JOR-74).
    applyWalletDelta: !alreadyInCardBalance,
  });
}

export async function createCreditCardPayment(
  creditCardId: number,
  ownerFilter: OwnerFilter,
  input: NormalizedCreditCardPaymentInput,
) {
  const result = await prisma.$transaction(async (tx) => {
    const creditCardWallet = await tx.wallet.findFirst({
      where: { id: creditCardId, ...ownerFilter },
      select: {
        id: true,
        name: true,
        type: true,
        amount: true,
        user_id: true,
        house_id: true,
      },
    });

    if (!creditCardWallet) {
      throw new DomainError('P2025', 'Tarjeta no encontrada');
    }

    ensureCreditWalletType(creditCardWallet);

    const isExternal = input.mode === 'external';
    const adjustsDebt = isExternal ? (input.adjusts_debt ?? true) : true;

    let sourceWallet:
      | {
          id: number;
          name: string;
          type: PaymentMethodType;
          amount: Prisma.Decimal | number | string;
          user_id: number | null;
          house_id: number | null;
          provider_icon_key?: string | null;
        }
      | null = null;

    if (!isExternal) {
      sourceWallet = await tx.wallet.findFirst({
        where: { id: input.source_wallet_id, ...ownerFilter },
        select: {
          id: true,
          name: true,
          type: true,
          amount: true,
          user_id: true,
          house_id: true,
          provider_icon_key: true,
        },
      });

      if (!sourceWallet) {
        throw new DomainError('WALLET_NOT_FOUND', 'Billetera de origen no encontrada');
      }

      ensureFundingWalletType(sourceWallet);

      if (creditCardWallet.id === sourceWallet.id) {
        throw new DomainError('INVALID_PAYMENT_SOURCE_WALLET', 'La billetera de origen debe ser distinta de la tarjeta');
      }

      if (
        creditCardWallet.user_id !== sourceWallet.user_id ||
        creditCardWallet.house_id !== sourceWallet.house_id
      ) {
        throw new DomainError('INVALID_PAYMENT_SOURCE_OWNER', 'La billetera de origen debe pertenecer al mismo titular');
      }

      const sourceBalance = toWalletAmountNumber(sourceWallet);
      if (sourceBalance < input.amount) {
        throw new DomainError('INSUFFICIENT_SOURCE_BALANCE', 'Saldo insuficiente en la billetera de origen');
      }
    }

    if (adjustsDebt) {
      const currentDebt = toWalletAmountNumber(creditCardWallet);
      if (input.amount > currentDebt) {
        throw new DomainError('INVALID_PAYMENT_AMOUNT', 'El monto del pago no puede superar la deuda actual de la tarjeta');
      }
    }

    const payment = await tx.creditCardPayment.create({
      data: {
        amount: input.amount,
        paid_at: coerceToCalendarDate(input.paid_at),
        note: input.note ?? null,
        credit_card_wallet_id: creditCardWallet.id,
        source_wallet_id: sourceWallet?.id ?? null,
        adjusts_debt: adjustsDebt,
        user_id: creditCardWallet.user_id,
        house_id: creditCardWallet.house_id,
      },
      include: {
        source_wallet: {
          select: { id: true, name: true, provider_icon_key: true },
        },
        credit_card_wallet: { select: { id: true, name: true } },
      },
    });

    if (sourceWallet) {
      await applyWalletAmountDelta(tx, sourceWallet.id, -input.amount);
    }

    if (adjustsDebt) {
      await applyWalletAmountDelta(tx, creditCardWallet.id, -input.amount);
    }

    let expenseId: number | null = null;
    if (
      !isExternal &&
      input.create_fortnight_expense === true &&
      sourceWallet
    ) {
      let categoryId = input.category_id ?? null;
      if (categoryId == null) {
        const kind = paymentCategoryKindForWallet(creditCardWallet.type);
        if (kind == null) {
          throw new DomainError('CATEGORY_NOT_FOUND', 'Esta tarjeta no tiene categoría de pago');
        }
        categoryId = await resolvePaymentCategoryId(tx, ownerFilter, kind);
      } else {
        const category = await tx.category.findFirst({
          where: { id: categoryId, kind: 'EXPENSE', ...ownerFilter },
        });
        if (!category) {
          throw new DomainError('CATEGORY_NOT_FOUND', 'Categoría no encontrada');
        }
      }

      const paidAt = coerceToCalendarDate(input.paid_at);

      let fortnight: Awaited<ReturnType<typeof resolveOrCreateFortnight>>;
      if (input.fortnight_id != null) {
        const existing = await tx.fortnight.findFirst({
          where: { id: input.fortnight_id, ...ownerFilter },
        });
        if (!existing) {
          throw new DomainError('FORTNIGHT_NOT_FOUND', 'Quincena no encontrada');
        }
        fortnight = existing;
      } else {
        const paidYmd = formatCalendarDate(paidAt);
        const { year: fnYear, month: fnMonth, period: fnPeriod } =
          getCalendarFortnightRefForYmd(paidYmd);

        const ownerUserId = creditCardWallet.user_id;
        const ownerHouseId = creditCardWallet.house_id;
        if (ownerUserId == null && ownerHouseId == null) {
          throw new DomainError('INVALID_CARD_OWNER', 'Titular de tarjeta inválido');
        }

        fortnight = await resolveOrCreateFortnight({
          ownerType: ownerUserId != null ? 'user' : 'house',
          ownerId: ownerUserId != null ? ownerUserId : ownerHouseId!,
          year: fnYear,
          month: fnMonth,
          period: fnPeriod,
          tx,
        });
      }

      const description =
        input.expense_description?.trim() ||
        `Pago tarjeta: ${creditCardWallet.name}`;

      const expense = await tx.expense.create({
        data: {
          fortnight_id: fortnight.id,
          wallet_id: sourceWallet.id,
          category_id: categoryId,
          description,
          amount: input.amount,
          is_paid: true,
          payment_date: coerceToCalendarDayStart(input.paid_at),
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

    // Settle the scheduled row / MSI cuota this payment covers in the same
    // transaction: a failed match rolls the payment back instead of leaving a
    // committed payment reported as an error.
    const paidAtYmd = formatCalendarDate(payment.paid_at);
    await coverScheduledPaymentForCardPayment(
      tx,
      creditCardWallet.id,
      ownerFilter,
      paidAtYmd,
      input.amount,
      payment.id,
    );
    await coverInstallmentPlanPaymentForCardPayment(
      tx,
      creditCardWallet.id,
      ownerFilter,
      paidAtYmd,
      input.amount,
      payment.id,
    );

    return {
      id: payment.id,
      amount: Number(payment.amount),
      paid_at: paidAtYmd,
      note: payment.note ?? null,
      source_wallet_id: payment.source_wallet_id,
      source_wallet_name: payment.source_wallet?.name ?? 'Ya pagado',
      source_wallet_provider_icon_key:
        payment.source_wallet?.provider_icon_key ?? null,
      credit_card_wallet_id: payment.credit_card_wallet_id,
      credit_card_wallet_name: payment.credit_card_wallet.name,
      expense_id: expenseId,
      adjusts_debt: payment.adjusts_debt,
      is_external: payment.source_wallet_id == null,
    };
  }, { timeout: 30000, maxWait: 10000 });

  return result;
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
        adjusts_debt: true,
      },
    });

    if (!payment) {
      throw new DomainError('PAYMENT_NOT_FOUND', 'Pago no encontrado');
    }

    const amount = Number(payment.amount);

    if (payment.source_wallet_id != null) {
      await applyWalletAmountDelta(tx, payment.source_wallet_id, amount);
    }
    if (payment.adjusts_debt) {
      await applyWalletAmountDelta(tx, payment.credit_card_wallet_id, amount);
    }

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
    throw new DomainError('P2025', 'Tarjeta no encontrada');
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
    source_wallet_name: payment.source_wallet?.name ?? 'Ya pagado',
    source_wallet_provider_icon_key:
      payment.source_wallet?.provider_icon_key ?? null,
    credit_card_wallet_id: payment.credit_card_wallet_id,
    credit_card_wallet_name: payment.credit_card_wallet.name,
  }));
}
