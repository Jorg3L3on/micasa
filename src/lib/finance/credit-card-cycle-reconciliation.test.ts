import { describe, expect, it } from 'vitest';
import { computeCreditCardCycleReconciliation } from '@/lib/finance/credit-card-cycle-reconciliation';

describe('computeCreditCardCycleReconciliation', () => {
  it('returns matched when registered equals expected ledger balance', () => {
    const result = computeCreditCardCycleReconciliation({
      lastStatementBalance: 1000,
      paymentsAppliedToStatement: 400,
      currentCyclePurchases: 200,
      currentCyclePayments: 100,
      outstandingBalance: 700,
      importedStatementTotal: null,
      importedMinimumPayment: null,
    });

    expect(result.expectedBalance).toBe(700);
    expect(result.registeredBalance).toBe(700);
    expect(result.delta).toBe(0);
    expect(result.status).toBe('matched');
  });

  it('uses imported total when present', () => {
    const result = computeCreditCardCycleReconciliation({
      lastStatementBalance: 1000,
      paymentsAppliedToStatement: 0,
      currentCyclePurchases: 0,
      currentCyclePayments: 0,
      outstandingBalance: 3100,
      importedStatementTotal: 3000,
      importedMinimumPayment: 300,
    });

    expect(result.expectedBalance).toBe(3000);
    expect(result.delta).toBe(100);
    expect(result.status).toBe('needs_review');
    expect(result.importedMinimumPayment).toBe(300);
  });

  it('classifies minor differences', () => {
    const result = computeCreditCardCycleReconciliation({
      lastStatementBalance: 500,
      paymentsAppliedToStatement: 0,
      currentCyclePurchases: 0,
      currentCyclePayments: 0,
      outstandingBalance: 520,
      importedStatementTotal: null,
      importedMinimumPayment: null,
    });

    expect(result.status).toBe('minor_diff');
  });
});
