export type OverdueLoanAlertItem = {
  paymentSource: 'WALLET' | 'PAYROLL_DEDUCTION';
  lender?: string | null;
  lenderId?: number | null;
};

export type OverdueLoanAlertSummary = {
  parts: string[];
  obligationCount: number;
};

const lenderKey = (payment: OverdueLoanAlertItem, name: string): string =>
  payment.lenderId != null
    ? `id:${payment.lenderId}`
    : `name:${name.toLocaleLowerCase('es-MX')}`;

/** Wallet dues collapse to one cash payment per prestamista. Payroll stays per deduction. */
export const summarizeOverdueLoans = (
  payments: readonly OverdueLoanAlertItem[],
): OverdueLoanAlertSummary => {
  const parts: string[] = [];
  const walletNames = new Map<string, string>();
  let payrollCount = 0;

  for (const payment of payments) {
    if (payment.paymentSource === 'PAYROLL_DEDUCTION') {
      payrollCount += 1;
      continue;
    }
    const name = payment.lender?.trim() || 'prestamista';
    const key = lenderKey(payment, name);
    if (!walletNames.has(key)) walletNames.set(key, name);
  }

  for (const name of walletNames.values()) {
    parts.push(`1 pago a ${name}`);
  }
  if (payrollCount > 0) {
    parts.push(
      `${payrollCount} deducción${payrollCount === 1 ? '' : 'es'} nómina`,
    );
  }

  return {
    parts,
    obligationCount: walletNames.size + payrollCount,
  };
};
