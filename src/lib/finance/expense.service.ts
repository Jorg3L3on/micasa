import prisma from '@/lib/prisma';

type CreateExpenseInput = {
  fortnightId: number;
  categoryId: number;
  description: string;
  amount: number;
  isPaid?: boolean;
  paymentDate?: string | null;
  expenseTemplateId?: number | null;
  walletId?: number | null;
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

async function mapExpenseToTransactionDto(expense: any) {
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

export async function createExpense(input: CreateExpenseInput) {
  const {
    fortnightId,
    categoryId,
    description,
    amount,
    isPaid = false,
    paymentDate,
    expenseTemplateId,
    walletId,
  } = input;

  if (amount <= 0) {
    const error = new Error('Amount must be greater than 0');
    (error as any).code = 'INVALID_AMOUNT';
    throw error;
  }

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
  });
  if (!category) {
    const error = new Error('Category not found');
    (error as any).code = 'CATEGORY_NOT_FOUND';
    throw error;
  }

  const fortnight = await prisma.fortnight.findUnique({
    where: { id: fortnightId },
    select: { id: true, user_id: true, house_id: true },
  });

  if (
    !fortnight ||
    (fortnight.user_id == null && fortnight.house_id == null) ||
    (fortnight.user_id != null && fortnight.house_id != null)
  ) {
    const error = new Error('Invalid fortnight for this transaction');
    (error as any).code = 'INVALID_FORTNIGHT';
    throw error;
  }

  let effectiveWalletId: number | null = walletId ?? null;
  let walletOwnerUserId: number | null = null;
  let walletOwnerHouseId: number | null = null;

  if (effectiveWalletId) {
    const wallet = await prisma.wallet.findUnique({
      where: { id: effectiveWalletId },
      select: { id: true, user_id: true, house_id: true },
    });
    if (!wallet) {
      const error = new Error('Wallet not found');
      (error as any).code = 'WALLET_NOT_FOUND';
      throw error;
    }

    walletOwnerUserId = wallet.user_id;
    walletOwnerHouseId = wallet.house_id;

    if (fortnight.user_id != null) {
      if (walletOwnerUserId !== fortnight.user_id || walletOwnerHouseId !== null) {
        const error = new Error(
          'Wallet does not belong to the same user as the fortnight',
        );
        (error as any).code = 'INVALID_WALLET_OWNER';
        throw error;
      }
    } else if (fortnight.house_id != null) {
      if (walletOwnerHouseId !== fortnight.house_id || walletOwnerUserId !== null) {
        const error = new Error(
          'Wallet does not belong to the same house as the fortnight',
        );
        (error as any).code = 'INVALID_WALLET_OWNER';
        throw error;
      }
    }
  }

  const created = await prisma.$transaction(async (tx) => {
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
        user_id: fortnight.user_id,
        house_id: fortnight.house_id,
      },
      include: {
        category: { select: { name: true } },
        wallet: { select: { id: true, name: true } },
      },
    });

    if (expense.is_paid && expense.wallet_id != null) {
      await tx.wallet.update({
        where: { id: expense.wallet_id },
        data: { amount: { decrement: expense.amount } },
      });
    }

    return expense;
  });

  return mapExpenseToTransactionDto(created);
}

export async function updateExpense(input: UpdateExpenseInput) {
  const { id, fortnightId, categoryId, description, amount, isPaid, paymentDate, walletId } =
    input;

  if (amount !== undefined && amount <= 0) {
    const error = new Error('Amount must be greater than 0');
    (error as any).code = 'INVALID_AMOUNT';
    throw error;
  }

  if (categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      const error = new Error('Category not found');
      (error as any).code = 'CATEGORY_NOT_FOUND';
      throw error;
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.expense.findUnique({
      where: { id },
      include: {
        category: { select: { name: true } },
        wallet: { select: { id: true, name: true } },
        fortnight: { select: { id: true, user_id: true, house_id: true } },
      },
    });

    if (!existing) {
      const error = new Error('Transaction not found');
      (error as any).code = 'P2025';
      throw error;
    }

    const linkedTransfer = await tx.transfer.findFirst({
      where: { user_expense_id: id } as any,
    });

    if (linkedTransfer) {
      const error = new Error('Cannot update expenses generated by transfers');
      (error as any).code = 'EXPENSE_TRANSFER_LOCKED';
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
        const error = new Error('Invalid fortnight for this transaction');
        (error as any).code = 'INVALID_FORTNIGHT';
        throw error;
      }

      newFortnight = ft;
    }

    const currentWalletId = existing.wallet_id;
    const requestedWalletId = walletId ?? currentWalletId;
    let newWalletId = requestedWalletId ?? null;

    if (requestedWalletId !== undefined && requestedWalletId !== null) {
      const wallet = await tx.wallet.findUnique({
        where: { id: requestedWalletId },
        select: { id: true, user_id: true, house_id: true },
      });

      if (!wallet) {
        const error = new Error('Wallet not found');
        (error as any).code = 'WALLET_NOT_FOUND';
        throw error;
      }

      if (newFortnight.user_id != null) {
        if (wallet.user_id !== newFortnight.user_id || wallet.house_id !== null) {
          const error = new Error(
            'Wallet does not belong to the same user as the fortnight',
          );
          (error as any).code = 'INVALID_WALLET_OWNER';
          throw error;
        }
      } else if (newFortnight.house_id != null) {
        if (wallet.house_id !== newFortnight.house_id || wallet.user_id !== null) {
          const error = new Error(
            'Wallet does not belong to the same house as the fortnight',
          );
          (error as any).code = 'INVALID_WALLET_OWNER';
          throw error;
        }
      }
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

    if (currentIsPaid && currentWalletId != null) {
      addDelta(currentWalletId, Number(currentAmount));
    }

    if (newIsPaid && newWalletId != null) {
      addDelta(newWalletId, -Number(newAmount));
    }

    for (const [walletIdStr, delta] of Object.entries(deltas)) {
      const walletIdNum = Number(walletIdStr);
      if (delta === 0) continue;

      await tx.wallet.update({
        where: { id: walletIdNum },
        data: {
          amount:
            delta > 0
              ? { increment: delta }
              : { decrement: Math.abs(delta) },
        },
      });
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
        wallet: { select: { name: true } },
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
        wallet: { select: { id: true, name: true } },
      },
    });

    if (!existing) {
      const error = new Error('Expense not found');
      (error as any).code = 'P2025';
      throw error;
    }

    const linkedTransfer = await tx.transfer.findFirst({
      where: { user_expense_id: id } as any,
    });

    if (linkedTransfer) {
      const error = new Error('Cannot change paid status for transfer expenses');
      (error as any).code = 'EXPENSE_TRANSFER_LOCKED';
      throw error;
    }

    const wasPaid = existing.is_paid;
    const willBePaid = paid;

    if (existing.wallet_id != null && wasPaid !== willBePaid) {
      if (willBePaid) {
        await tx.wallet.update({
          where: { id: existing.wallet_id },
          data: { amount: { decrement: existing.amount } },
        });
      } else {
        await tx.wallet.update({
          where: { id: existing.wallet_id },
          data: { amount: { increment: existing.amount } },
        });
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
        wallet: { select: { name: true } },
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
        transferAsUser: { select: { id: true } },
      },
    });

    if (!expense) {
      const error = new Error('Transaction not found');
      (error as any).code = 'P2025';
      throw error;
    }

    if (expense.transferAsUser != null) {
      const error = new Error(
        'Cannot delete expenses generated by transfers',
      );
      (error as any).code = 'EXPENSE_TRANSFER_LOCKED';
      throw error;
    }

    if (expense.is_paid === true && expense.wallet_id != null) {
      await tx.wallet.update({
        where: { id: expense.wallet_id },
        data: { amount: { increment: expense.amount } },
      });
    }

    await tx.expense.delete({
      where: { id },
    });
  });
}

