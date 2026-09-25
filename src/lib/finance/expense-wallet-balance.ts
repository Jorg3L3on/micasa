const BALANCE_EPS = 1e-9;

/** Efectivo, débito y metas: el pago pagado descuenta saldo. */
export const isSpendableExpenseWalletType = (
  type: string | null | undefined,
): boolean => type === 'CASH' || type === 'DEBIT_CARD' || type === 'GOAL';

export const paidExpenseExceedsWalletBalance = ({
  walletType,
  balance,
  amount,
  isPaid,
}: {
  walletType: string | null | undefined;
  balance: number | null | undefined;
  amount: number;
  isPaid: boolean;
}): boolean => {
  if (!isPaid) return false;
  if (!isSpendableExpenseWalletType(walletType)) return false;
  const safeBalance = Number(balance ?? 0);
  const safeAmount = Number(amount || 0);
  if (!Number.isFinite(safeBalance) || !Number.isFinite(safeAmount)) return false;
  return safeAmount > safeBalance + BALANCE_EPS;
};
