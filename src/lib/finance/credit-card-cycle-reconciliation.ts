export type ReconciliationStatus = 'matched' | 'minor_diff' | 'needs_review';

export type CreditCardCycleReconciliation = {
  expectedBalance: number;
  registeredBalance: number;
  delta: number;
  status: ReconciliationStatus;
  breakdownLines: string[];
  importedTotal: number | null;
  importedMinimumPayment: number | null;
};

export type ComputeCreditCardCycleReconciliationInput = {
  lastStatementBalance: number;
  paymentsAppliedToStatement: number;
  currentCyclePurchases: number;
  currentCyclePayments: number;
  outstandingBalance: number;
  importedStatementTotal: number | null;
  importedMinimumPayment: number | null;
};

const MINOR_DIFF_THRESHOLD = 50;

const classifyDelta = (delta: number): ReconciliationStatus => {
  const abs = Math.abs(delta);
  if (abs < 1) return 'matched';
  if (abs <= MINOR_DIFF_THRESHOLD) return 'minor_diff';
  return 'needs_review';
};

export const computeCreditCardCycleReconciliation = ({
  lastStatementBalance,
  paymentsAppliedToStatement,
  currentCyclePurchases,
  currentCyclePayments,
  outstandingBalance,
  importedStatementTotal,
  importedMinimumPayment,
}: ComputeCreditCardCycleReconciliationInput): CreditCardCycleReconciliation => {
  const ledgerExpected = Math.max(
    lastStatementBalance -
      paymentsAppliedToStatement +
      currentCyclePurchases -
      currentCyclePayments,
    0,
  );

  const expectedBalance =
    importedStatementTotal != null ? importedStatementTotal : ledgerExpected;

  const registeredBalance = outstandingBalance;
  const delta = registeredBalance - expectedBalance;
  const status = classifyDelta(delta);

  const breakdownLines = [
    `Saldo último corte: ${lastStatementBalance.toFixed(2)}`,
    `Pagos aplicados al corte: −${paymentsAppliedToStatement.toFixed(2)}`,
    `Compras del ciclo: +${currentCyclePurchases.toFixed(2)}`,
    `Pagos del ciclo: −${currentCyclePayments.toFixed(2)}`,
  ];

  if (importedStatementTotal != null) {
    breakdownLines.push(
      `Total importado (PDF): ${importedStatementTotal.toFixed(2)}`,
    );
  }

  return {
    expectedBalance,
    registeredBalance,
    delta,
    status,
    breakdownLines,
    importedTotal: importedStatementTotal,
    importedMinimumPayment,
  };
};
