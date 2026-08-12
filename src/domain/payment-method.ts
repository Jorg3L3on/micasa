export const PAYMENT_METHODS = [
  'CASH',
  'DEBIT_CARD',
  'CREDIT_CARD',
  'DEPARTMENT_STORE_CARD',
  'GOAL',
] as const

export type PaymentMethodType = typeof PAYMENT_METHODS[number]

/** Sin Prisma: usable en Client Components. */
export const isCreditOrStoreCardWalletType = (
  type: string | null | undefined,
): boolean => type === 'CREDIT_CARD' || type === 'DEPARTMENT_STORE_CARD';

export const isGoalWalletType = (
  type: string | null | undefined,
): boolean => type === 'GOAL';

/** Sin Prisma: CASH / DEBIT / GOAL can use Transferir dinero. */
export const isTransferableWalletType = (
  type: string | null | undefined,
): boolean =>
  type === 'CASH' || type === 'DEBIT_CARD' || type === 'GOAL';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodType, string> = {
  CASH: 'Efectivo',
  DEBIT_CARD: 'Tarjeta de débito',
  CREDIT_CARD: 'Tarjeta de crédito',
  DEPARTMENT_STORE_CARD: 'Tarjeta departamental',
  GOAL: 'Meta',
}

export const PAYMENT_METHOD_OPTIONS = PAYMENT_METHODS.map((value) => ({
  value,
  label: PAYMENT_METHOD_LABELS[value],
}))
