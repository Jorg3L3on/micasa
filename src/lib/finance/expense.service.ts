import prisma from '@/lib/prisma';
import { PaymentMethodType, Prisma } from '@/generated/prisma/client';
import {
  applyWalletAmountDelta,
  assertPaidChargeAllowedForWallet,
  getPaidExpenseWalletDelta,
  isCreditWalletType,
  isFundingWalletType,
} from '@/lib/finance/wallet-accounting';
import { resolveTemplateDueDay } from '@/lib/finance/expense-template-due';

type ExpenseServiceError = Error & { code?: string };

type ExpenseTransactionDtoSource = {
  id: number;
  description: string;
  amount: unknown;
  is_paid: boolean;
  payment_date: Date | string | null;
  created_at: Date | string;
  category?: { name: string | null } | null;
  wallet?: { name: string | null } | null;
};

export type CreateExpenseInput = {
  fortnightId: number;
  categoryId: number;
  description: string;
  amount: number;
  isPaid?: boolean;
  paymentDate?: string | null;
  expenseTemplateId?: number | null;
  walletId?: number | null;
  statementImportId?: number | null;
  creditInstallmentCurrent?: number | null;
  creditInstallmentTotal?: number | null;
};

type UpdateExpenseInput = {
  id: number;
  fortnightId?: number;
  categoryId?: number;
  description?: string;
  amount?: number;
  isPaid?: boolean;
  paymentDate?: string | null;
  walletId?: number | null;
};

type TogglePaidInput = {
  id: number;
  paid: boolean;
};

type DeleteExpenseInput = {
  id: number;
};

export type ExpenseWithMeta = Awaited<
  ReturnType<typeof mapExpenseToTransactionDto>
>;

async function mapExpenseToTransactionDto(expense: ExpenseTransactionDtoSource) {
  const dateValue = expense.payment_date || expense.created_at;
  const dateStr =
    dateValue instanceof Date
      ? dateValue.toISOString().split('T')[0]
      : new Date(dateValue).toISOString().split('T')[0];

  return {
    id: expense.id,
    date: dateStr,
    description: expense.description,
    amount: expense.amount,
    category: expense.category?.name ?? '',
    paymentMethod: expense.wallet?.name || 'Efectivo',
    type: 'expense' as const,
    is_paid: expense.is_paid,
    payment_date: expense.payment_date,
  };
}

export type ListExpensesOptions = {
  fortnightIds?: number[];
  is_paid?: boolean;
};

export async function listExpenses(
  userId: number,
  options?: ListExpensesOptions,
) {
  const memberships = await prisma.houseMember.findMany({
    where: { user_id: userId },
    select: { house_id: true },
  });
  const houseIds = memberships.map((m) => m.house_id);

  const where: {
    wallet: { OR: { user_id?: number; house_id?: { in: number[] } }[] };
    fortnight_id?: { in: number[] };
    is_paid?: boolean;
  } = {
    wallet: {
      OR: [{ user_id: userId }, { house_id: { in: houseIds } }],
    },
  };

  if (options?.fortnightIds !== undefined) {
    where.fortnight_id = { in: options.fortnightIds };
  }
  if (options?.is_paid !== undefined) {
    where.is_paid = options.is_paid;
  }

  return prisma.expense.findMany({
    where,
    include: {
      category: { select: { name: true } },
      wallet: { select: { name: true } },
    },
    orderBy: { created_at: 'desc' },
  });
}

/** Creates expense + wallet delta inside an existing transaction (e.g. pantry receipt import). */
export async function createExpenseInTransaction(
  tx: Prisma.TransactionClient,
  input: CreateExpenseInput,
) {
  const {
    fortnightId,
    categoryId,
    description,
    amount,
    isPaid = false,
    paymentDate,
    expenseTemplateId,
    walletId,
    statementImportId,
    creditInstallmentCurrent,
    creditInstallmentTotal,
  } = input;

  if (amount <= 0) {
    const error = new Error('Amount must be greater than 0') as ExpenseServiceError;
    error.code = 'INVALID_AMOUNT';
    throw error;
  }

  const category = await tx.category.findUnique({
    where: { id: categoryId },
  });
  if (!category) {
    const error = new Error('Category not found') as ExpenseServiceError;
    error.code = 'CATEGORY_NOT_FOUND';
    throw error;
  }

  const fortnight = await tx.fortnight.findUnique({
    where: { id: fortnightId },
    select: { id: true, user_id: true, house_id: true, period: true },
  });

  if (
    !fortnight ||
    (fortnight.user_id == null && fortnight.house_id == null) ||
    (fortnight.user_id != null && fortnight.house_id != null)
  ) {
    const error = new Error('Invalid fortnight for this transaction') as ExpenseServiceError;
    error.code = 'INVALID_FORTNIGHT';
    throw error;
  }

  const effectiveWalletId: number | null = walletId ?? null;
  let walletType: PaymentMethodType | null = null;

  if (effectiveWalletId) {
    const wallet = await tx.wallet.findUnique({
      where: { id: effectiveWalletId },
      select: {
        id: true,
        user_id: true,
        house_id: true,
        type: true,
        amount: true,
        credit_limit: true,
      },
    });
    if (!wallet) {
      const error = new Error('Wallet not found') as ExpenseServiceError;
      error.code = 'WALLET_NOT_FOUND';
      throw error;
    }

    walletType = wallet.type;

    if (fortnight.user_id != null) {
      if (wallet.user_id !== fortnight.user_id || wallet.house_id !== null) {
        const error = new Error(
          'Wallet does not belong to the same user as the fortnight',
        ) as ExpenseServiceError;
        error.code = 'INVALID_WALLET_OWNER';
        throw error;
      }
    } else if (fortnight.house_id != null) {
      if (wallet.house_id !== fortnight.house_id || wallet.user_id !== null) {
        const error = new Error(
          'Wallet does not belong to the same house as the fortnight',
        ) as ExpenseServiceError;
        error.code = 'INVALID_WALLET_OWNER';
        throw error;
      }
    }

    if (isPaid) {
      assertPaidChargeAllowedForWallet(wallet, amount);
    }
  }

  let resolvedDueDay: number | null = null;
  if (expenseTemplateId) {
    const template = await tx.expenseTemplate.findUnique({
      where: { id: expenseTemplateId },
      select: { due_day: true, due_day_first_fortnight: true, due_day_second_fortnight: true },
    });
    if (template) {
      resolvedDueDay = resolveTemplateDueDay(fortnight.period, template) ?? null;
    }
  }

  const expense = await tx.expense.create({
    data: {
      fortnight_id: fortnightId,
      wallet_id: effectiveWalletId ?? undefined,
      category_id: categoryId,
      description,
      amount,
      is_paid: isPaid,
      payment_date: paymentDate ? new Date(paymentDate) : null,
      expense_template_id: expenseTemplateId || null,
      due_day: resolvedDueDay,
      statement_import_id: statementImportId ?? null,
      credit_installment_current: creditInstallmentCurrent ?? null,
      credit_installment_total: creditInstallmentTotal ?? null,
      user_id: fortnight.user_id,
      house_id: fortnight.house_id,
    },
    include: {
      category: { select: { name: true } },
      wallet: { select: { id: true, name: true } },
    },
  });

  if (expense.is_paid && expense.wallet_id != null && walletType != null) {
    await applyWalletAmountDelta(
      tx,
      expense.wallet_id,
      getPaidExpenseWalletDelta(walletType, Number(expense.amount)),
    );
  }

  return expense;
}

export async function createExpense(input: CreateExpenseInput) {
  const created = await prisma.$transaction(async (tx) =>
    createExpenseInTransaction(tx, input),
  );
  return mapExpenseToTransactionDto(created);
}

export async function updateExpense(input: UpdateExpenseInput) {
  const { id, fortnightId, categoryId, description, amount, isPaid, paymentDate, walletId } =
    input;

  if (amount !== undefined && amount <= 0) {
    const error = new Error('Amount must be greater than 0') as ExpenseServiceError;
    error.code = 'INVALID_AMOUNT';
    throw error;
  }

  if (categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      const error = new Error('Category not found') as ExpenseServiceError;
      error.code = 'CATEGORY_NOT_FOUND';
      throw error;
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.expense.findUnique({
      where: { id },
      include: {
        category: { select: { name: true } },
        wallet: { select: { id: true, name: true, type: true } },
        fortnight: { select: { id: true, user_id: true, house_id: true } },
      },
    });

    if (!existing) {
      const error = new Error('Transaction not found') as ExpenseServiceError;
      error.code = 'P2025';
      throw error;
    }

    const linkedTransfer = await tx.transfer.findFirst({
      where: { user_expense_id: id },
    });

    if (linkedTransfer) {
      const error = new Error(
        'Cannot update expenses generated by transfers',
      ) as ExpenseServiceError;
      error.code = 'EXPENSE_TRANSFER_LOCKED';
      throw error;
    }

    const currentFortnight = existing.fortnight;
    let newFortnight = currentFortnight;

    if (fortnightId !== undefined) {
      const ft = await tx.fortnight.findUnique({
        where: { id: fortnightId },
        select: { id: true, user_id: true, house_id: true },
      });

      if (
        !ft ||
        (ft.user_id == null && ft.house_id == null) ||
        (ft.user_id != null && ft.house_id != null)
      ) {
        const error = new Error(
          'Invalid fortnight for this transaction',
        ) as ExpenseServiceError;
        error.code = 'INVALID_FORTNIGHT';
        throw error;
      }

      newFortnight = ft;
    }

    const currentWalletId = existing.wallet_id;
    const currentWalletType = existing.wallet?.type ?? null;
    const requestedWalletId = walletId ?? currentWalletId;
    const newWalletId = requestedWalletId ?? null;
    let newWalletType = currentWalletType;

    if (requestedWalletId !== undefined && requestedWalletId !== null) {
      const wallet = await tx.wallet.findUnique({
        where: { id: requestedWalletId },
        select: { id: true, user_id: true, house_id: true, type: true },
      });

      if (!wallet) {
        const error = new Error('Wallet not found') as ExpenseServiceError;
        error.code = 'WALLET_NOT_FOUND';
        throw error;
      }

      if (newFortnight.user_id != null) {
        if (wallet.user_id !== newFortnight.user_id || wallet.house_id !== null) {
          const error = new Error(
            'Wallet does not belong to the same user as the fortnight',
          ) as ExpenseServiceError;
          error.code = 'INVALID_WALLET_OWNER';
          throw error;
        }
      } else if (newFortnight.house_id != null) {
        if (wallet.house_id !== newFortnight.house_id || wallet.user_id !== null) {
          const error = new Error(
            'Wallet does not belong to the same house as the fortnight',
          ) as ExpenseServiceError;
          error.code = 'INVALID_WALLET_OWNER';
          throw error;
        }
      }

      newWalletType = wallet.type;
    }

    const currentIsPaid = existing.is_paid;
    const newIsPaid = isPaid !== undefined ? isPaid : currentIsPaid;

    const currentAmount = existing.amount;
    const newAmount = amount !== undefined ? amount : currentAmount;

    type WalletDeltaMap = Record<number, number>;
    const deltas: WalletDeltaMap = {};

    const addDelta = (walletIdNum: number | null, delta: number) => {
      if (!walletIdNum) return;
      deltas[walletIdNum] = (deltas[walletIdNum] ?? 0) + delta;
    };

    if (currentIsPaid && currentWalletId != null && currentWalletType != null) {
      addDelta(
        currentWalletId,
        -getPaidExpenseWalletDelta(currentWalletType, Number(currentAmount)),
      );
    }

    if (newIsPaid && newWalletId != null && newWalletType != null) {
      addDelta(
        newWalletId,
        getPaidExpenseWalletDelta(newWalletType, Number(newAmount)),
      );
    }

    for (const [walletIdStr, delta] of Object.entries(deltas)) {
      if (delta === 0) continue;
      const walletIdNum = Number(walletIdStr);
      const w = await tx.wallet.findUnique({
        where: { id: walletIdNum },
        select: { type: true, amount: true, credit_limit: true },
      });
      if (!w) continue;
      const projected = Number(w.amount) + delta;
      if (isCreditWalletType(w.type)) {
        const limit =
          w.credit_limit == null ? null : Number(w.credit_limit);
        if (limit != null && projected > limit) {
          const error = new Error(
            'El gasto supera el crédito disponible',
          ) as ExpenseServiceError;
          error.code = 'CREDIT_LIMIT_EXCEEDED';
          throw error;
        }
      } else if (isFundingWalletType(w.type) && projected < 0) {
        const error = new Error(
          'Saldo insuficiente en la billetera',
        ) as ExpenseServiceError;
        error.code = 'INSUFFICIENT_WALLET_BALANCE';
        throw error;
      }
    }

    for (const [walletIdStr, delta] of Object.entries(deltas)) {
      const walletIdNum = Number(walletIdStr);
      await applyWalletAmountDelta(tx, walletIdNum, delta);
    }

    const updateData: Record<string, unknown> = {};
    if (fortnightId !== undefined) updateData.fortnight_id = fortnightId;
    if (walletId !== undefined) updateData.wallet_id = newWalletId;
    if (categoryId !== undefined) updateData.category_id = categoryId;
    if (description !== undefined) updateData.description = description;
    if (amount !== undefined) updateData.amount = amount;
    if (isPaid !== undefined) updateData.is_paid = isPaid;
    if (paymentDate !== undefined) {
      updateData.payment_date = paymentDate ? new Date(paymentDate) : null;
    }

    updateData.user_id = newFortnight.user_id;
    updateData.house_id = newFortnight.house_id;

    const expense = await tx.expense.update({
      where: { id },
      data: updateData,
      include: {
        category: { select: { name: true } },
        wallet: { select: { name: true, type: true } },
      },
    });

    return expense;
  });

  return mapExpenseToTransactionDto(updated);
}

export async function toggleExpensePaid(input: TogglePaidInput) {
  const { id, paid } = input;

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.expense.findUnique({
      where: { id },
      include: {
        category: { select: { name: true } },
        wallet: { select: { id: true, name: true, type: true } },
      },
    });

    if (!existing) {
      const error = new Error('Expense not found') as ExpenseServiceError;
      error.code = 'P2025';
      throw error;
    }

    const linkedTransfer = await tx.transfer.findFirst({
      where: { user_expense_id: id },
    });

    if (linkedTransfer) {
      const error = new Error(
        'Cannot change paid status for transfer expenses',
      ) as ExpenseServiceError;
      error.code = 'EXPENSE_TRANSFER_LOCKED';
      throw error;
    }

    const wasPaid = existing.is_paid;
    const willBePaid = paid;

    if (
      existing.wallet_id != null &&
      existing.wallet?.type != null &&
      wasPaid !== willBePaid
    ) {
      if (willBePaid) {
        const w = await tx.wallet.findUnique({
          where: { id: existing.wallet_id },
          select: { type: true, amount: true, credit_limit: true },
        });
        if (w) {
          assertPaidChargeAllowedForWallet(w, Number(existing.amount));
        }
      }

      const expenseDelta = getPaidExpenseWalletDelta(
        existing.wallet.type,
        Number(existing.amount),
      );

      if (willBePaid) {
        await applyWalletAmountDelta(tx, existing.wallet_id, expenseDelta);
      } else {
        await applyWalletAmountDelta(tx, existing.wallet_id, -expenseDelta);
      }
    }

    const expense = await tx.expense.update({
      where: { id },
      data: {
        is_paid: willBePaid,
        payment_date: willBePaid ? new Date() : null,
      },
      include: {
        category: { select: { name: true } },
        wallet: { select: { name: true, type: true } },
      },
    });

    return expense;
  });

  return updated;
}

export async function deleteExpense(input: DeleteExpenseInput) {
  const { id } = input;

  await prisma.$transaction(async (tx) => {
    const expense = await tx.expense.findUnique({
      where: { id },
      select: {
        id: true,
        wallet_id: true,
        amount: true,
        is_paid: true,
        wallet: { select: { type: true } },
        transferAsUser: { select: { id: true } },
      },
    });

    if (!expense) {
      const error = new Error('Transaction not found') as ExpenseServiceError;
      error.code = 'P2025';
      throw error;
    }

    if (expense.transferAsUser != null) {
      const error = new Error(
        'Cannot delete expenses generated by transfers',
      ) as ExpenseServiceError;
      error.code = 'EXPENSE_TRANSFER_LOCKED';
      throw error;
    }

    if (
      expense.is_paid === true &&
      expense.wallet_id != null &&
      expense.wallet?.type != null
    ) {
      const expenseDelta = getPaidExpenseWalletDelta(
        expense.wallet.type,
        Number(expense.amount),
      );

      await applyWalletAmountDelta(tx, expense.wallet_id, -expenseDelta);
    }

    await tx.expense.delete({
      where: { id },
    });
  });
}

