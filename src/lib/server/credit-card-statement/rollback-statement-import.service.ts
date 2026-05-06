import prisma from '@/lib/prisma';
import { StatementImportProvider } from '@/generated/prisma/client';
import {
  applyWalletAmountDelta,
  getPaidExpenseWalletDelta,
} from '@/lib/finance/wallet-accounting';
import type { OwnerFilter } from '@/lib/server/get-owner-context';

export type RollbackStatementImportResult = {
  expensesRemoved: number;
};

/**
 * Deletes all expenses created for a statement import, reverses wallet balances,
 * and removes the import row. Fails if any linked expense is locked (transfer / pago vinculado).
 */
export async function rollbackCreditCardStatementImport(input: {
  creditCardWalletId: number;
  importId: number;
  ownerFilter: OwnerFilter;
}): Promise<RollbackStatementImportResult> {
  const { creditCardWalletId, importId, ownerFilter } = input;

  const importRow = await prisma.creditCardStatementImport.findFirst({
    where: {
      id: importId,
      wallet_id: creditCardWalletId,
      ...ownerFilter,
    },
    select: { id: true, provider: true, total_due: true, created_at: true },
  });

  if (!importRow) {
    const err = new Error('Importación no encontrada') as Error & {
      code?: string;
    };
    err.code = 'IMPORT_NOT_FOUND';
    throw err;
  }

  return prisma.$transaction(async (tx) => {
    const previousImport = await tx.creditCardStatementImport.findFirst({
      where: {
        wallet_id: creditCardWalletId,
        ...ownerFilter,
        id: { not: importId },
        created_at: { lt: importRow.created_at },
      },
      orderBy: { created_at: 'desc' },
      select: { total_due: true },
    });

    const expenses = await tx.expense.findMany({
      where: { statement_import_id: importId },
      select: {
        id: true,
        amount: true,
        wallet_id: true,
        is_paid: true,
        wallet: { select: { type: true } },
        transferAsUser: { select: { id: true } },
        credit_card_payment: { select: { id: true } },
      },
    });

    for (const ex of expenses) {
      if (ex.transferAsUser != null) {
        const err = new Error(
          'Hay un gasto de esta importación vinculado a una transferencia; no se puede revertir automáticamente.',
        ) as Error & { code?: string };
        err.code = 'EXPENSE_TRANSFER_LOCKED';
        throw err;
      }
      if (ex.credit_card_payment != null) {
        const err = new Error(
          'Hay un gasto de esta importación vinculado a un pago de tarjeta; elimina o desvincula ese pago primero.',
        ) as Error & { code?: string };
        err.code = 'EXPENSE_PAYMENT_LINKED';
        throw err;
      }
      if (ex.wallet_id != null && ex.wallet_id !== creditCardWalletId) {
        const err = new Error(
          'Un gasto de esta importación fue movido a otra billetera; revierte los cambios manualmente.',
        ) as Error & { code?: string };
        err.code = 'EXPENSE_WALLET_MISMATCH';
        throw err;
      }
    }

    for (const ex of expenses) {
      if (
        ex.is_paid === true &&
        ex.wallet_id != null &&
        ex.wallet?.type != null
      ) {
        const expenseDelta = getPaidExpenseWalletDelta(
          ex.wallet.type,
          Number(ex.amount),
        );
        await applyWalletAmountDelta(tx, ex.wallet_id, -expenseDelta);
      }
    }

    await tx.expense.deleteMany({
      where: { statement_import_id: importId },
    });

    await tx.creditCardStatementImport.delete({
      where: { id: importId },
    });

    if (
      importRow.provider === StatementImportProvider.DIDI_CARD &&
      importRow.total_due != null &&
      previousImport?.total_due != null
    ) {
      await tx.wallet.update({
        where: { id: creditCardWalletId },
        data: { amount: Number(previousImport.total_due) },
      });
    }

    return { expensesRemoved: expenses.length };
  });
}
