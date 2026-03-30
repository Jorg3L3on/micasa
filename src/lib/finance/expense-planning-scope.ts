/**
 * Planificación por quincena/mes:
 * - Cuotas en meses (installment): fuera de agregados (sigue en estado de cuenta de la TC).
 * - Cargos con tarjeta de crédito o tienda: fuera del total de “salida de efectivo”.
 * - La salida de efectivo por tarjeta viene de: gastos con billetera débito/efectivo
 *   (p. ej. “Pago tarjeta” al registrar en la quincena) y pagos a TC sin gasto vinculado
 *   (`CreditCardPayment` con expense_id null), sumados en API por fecha de pago.
 */

import type { Prisma } from '@/generated/prisma/client';
import { PaymentMethodType } from '@/generated/prisma/client';

export type CreditInstallmentFields = {
  credit_installment_current: number | null;
  credit_installment_total: number | null;
};

export const parseInstallmentFromDescription = (
  description: string,
): { current: number; total: number } | null => {
  const re = /\b(\d{1,3})\s+de\s+(\d{1,3})\b/gi;
  let best: { current: number; total: number } | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(description)) !== null) {
    const current = Number.parseInt(m[1], 10);
    const total = Number.parseInt(m[2], 10);
    if (
      !Number.isFinite(current) ||
      !Number.isFinite(total) ||
      total < 1 ||
      current < 1 ||
      current > total
    ) {
      continue;
    }
    best = { current, total };
  }
  return best;
};

export const isCreditInstallmentExpense = (e: CreditInstallmentFields): boolean => {
  const c = e.credit_installment_current;
  const t = e.credit_installment_total;
  if (c == null || t == null) {
    return false;
  }
  if (!Number.isFinite(c) || !Number.isFinite(t)) {
    return false;
  }
  return t >= 1 && c >= 1 && c <= t;
};

/** Filas con ambas cuotas definidas quedan fuera (solo planificación). */
export const whereExcludeCreditInstallments = (): Prisma.ExpenseWhereInput => ({
  OR: [{ credit_installment_current: null }, { credit_installment_total: null }],
});

/** Gastos ligados a billetera de crédito o tienda departamental. */
export const whereCreditOrStoreCardWalletOnly = (): Prisma.ExpenseWhereInput => ({
  wallet: {
    type: {
      in: [
        PaymentMethodType.CREDIT_CARD,
        PaymentMethodType.DEPARTMENT_STORE_CARD,
      ],
    },
  },
});

/**
 * Solo gastos que implican salida de efectivo / débito en la planificación.
 * Sin wallet se trata como efectivo (histórico).
 */
export const whereExcludeCreditStoreCardWallet = (): Prisma.ExpenseWhereInput => ({
  OR: [
    { wallet_id: null },
    {
      wallet: {
        type: {
          notIn: [
            PaymentMethodType.CREDIT_CARD,
            PaymentMethodType.DEPARTMENT_STORE_CARD,
          ],
        },
      },
    },
  ],
});

/** Agregados de planificación: sin cuotas en TC y sin cargos a tarjeta/tienda. */
export const wherePlanningCashFlowExpenses = (): Prisma.ExpenseWhereInput => ({
  AND: [
    whereExcludeCreditInstallments(),
    whereExcludeCreditStoreCardWallet(),
  ],
});
