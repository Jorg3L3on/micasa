import {
  CardBankChargeReason,
  type Prisma,
} from '@/generated/prisma/client';
import type { OwnerFilter } from '@/lib/server/get-owner-context';

/** System expense category for interest, late fees, and other bank charges. */
export const BANK_CHARGE_CATEGORY_NAME = 'Intereses y comisiones';

export const BANK_CHARGE_REQUIRED = 'BANK_CHARGE_REQUIRED';

export const BANK_CHARGE_REQUIRED_MESSAGE =
  'El pago supera la deuda registrada. Indica el cargo del banco.';

const BANK_CHARGE_DESCRIPTIONS: Record<CardBankChargeReason, string> = {
  [CardBankChargeReason.INTEREST]: 'Intereses',
  [CardBankChargeReason.LATE_FEE]: 'Comisión por pago tardío',
  [CardBankChargeReason.OTHER]: 'Cargo bancario',
};

export const bankChargeExpenseDescription = (
  reason: CardBankChargeReason,
): string => BANK_CHARGE_DESCRIPTIONS[reason];

/**
 * One category per owner. A second payment in the same house or user reuses
 * the row, including a renamed-only-by-case copy.
 */
export const ensureBankChargeCategoryId = async (
  tx: Prisma.TransactionClient,
  ownerFilter: OwnerFilter,
): Promise<number> => {
  const existing = await tx.category.findFirst({
    where: {
      ...ownerFilter,
      kind: 'EXPENSE',
      name: { equals: BANK_CHARGE_CATEGORY_NAME, mode: 'insensitive' },
    },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await tx.category.create({
    data: {
      ...ownerFilter,
      name: BANK_CHARGE_CATEGORY_NAME,
      description: 'Intereses, comisiones y otros cargos del banco',
      icon: 'LANDMARK',
      kind: 'EXPENSE',
    },
    select: { id: true },
  });
  return created.id;
};

/**
 * Duplicate check for a statement charge line.
 * Expenses linked as `CreditCardPayment.bank_charge_expense_id` are the
 * declared excess of a payment, tagged by that relation (`bank_charge`).
 * They are not statement lines and must not suppress the real import.
 */
export const statementChargeDedupeWhere = (input: {
  walletId: number;
  amount: number;
  description: string;
  start: Date;
  end: Date;
  /** Rows of the import being written must not dedupe each other. */
  excludeStatementImportId?: number;
}): Prisma.ExpenseWhereInput => ({
  wallet_id: input.walletId,
  amount: input.amount,
  description: input.description,
  payment_date: { gte: input.start, lte: input.end },
  bank_charge_payment: { is: null },
  ...(input.excludeStatementImportId != null
    ? { NOT: { statement_import_id: input.excludeStatementImportId } }
    : {}),
});
