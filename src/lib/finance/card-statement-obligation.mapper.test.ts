import { describe, expect, it } from 'vitest';
import {
  reconcileDuePaymentItemCanonicalFields,
  toPlannerCardPaymentStatusUi,
} from '@/lib/finance/card-statement-obligation';

describe('reconcileDuePaymentItemCanonicalFields', () => {
  it('subtracts payments from planned gross for effective amount', () => {
    const result = reconcileDuePaymentItemCanonicalFields(
      {
        nextDuePayment: 3884.78,
        paymentsAppliedToStatement: 694.76,
        statementDueDate: '2026-04-17',
        plannedPayment: 694.76,
        obligationAmountSource: 'import',
      },
      '2026-04-10',
    );

    expect(result.effectiveAmount).toBe(0);
    expect(result.remainingPlannedAmount).toBe(0);
    expect(result.plannerStatus).toBe('pagado');
  });

  it('derives vencido when overdue with remaining balance', () => {
    const result = reconcileDuePaymentItemCanonicalFields(
      {
        nextDuePayment: 500,
        paymentsAppliedToStatement: 0,
        statementDueDate: '2026-03-01',
        plannedPayment: null,
      },
      '2026-03-25',
    );

    expect(result.plannerStatus).toBe('vencido');
    expect(result.effectiveAmount).toBe(500);
  });
});

describe('toPlannerCardPaymentStatusUi', () => {
  it('maps paid obligation to pagado', () => {
    expect(
      toPlannerCardPaymentStatusUi({
        status: 'paid',
        remainingStatementDue: 0,
        remainingPlannedAmount: null,
      }),
    ).toBe('pagado');
  });
});
