import { describe, expect, it } from 'vitest';
import {
  buildCardStatementObligation,
  reconcileDuePaymentItemCanonicalFields,
  resolveCreditCardStatementWindow,
  toDuePaymentItemFields,
} from '@/lib/finance/card-statement-obligation';
import { parseCalendarDate } from '@/lib/calendar-dates';

const window = resolveCreditCardStatementWindow(
  parseCalendarDate('2026-04-10'),
  15,
  17,
);

const baseObligationInput = {
  walletId: 1,
  walletName: 'Test Card',
  walletType: 'CREDIT_CARD',
  cutoffDay: 15,
  dueDay: 17,
  window,
  lastStatementBalance: 3884.78,
  paymentsAppliedToStatement: 0,
  importedTotalDue: null as number | null,
  outstandingBalance: 5000,
  currentCyclePurchasesTotal: 200,
  currentCyclePaymentsTotal: 0,
  asOfYmd: '2026-04-10',
};

describe('credit card payment plan view parity with planner due items', () => {
  it('matches planner fields when no custom plan', () => {
    const obligation = buildCardStatementObligation({
      ...baseObligationInput,
      plannedGrossAmount: null,
    });
    const fromObligation = toDuePaymentItemFields(obligation);

    const fromReconcile = reconcileDuePaymentItemCanonicalFields(
      {
        nextDuePayment: fromObligation.nextDuePayment,
        paymentsAppliedToStatement: fromObligation.paymentsAppliedToStatement,
        statementDueDate: fromObligation.statementDueDate,
        plannedPayment: null,
        obligationAmountSource: fromObligation.obligationAmountSource,
        isEstimate: fromObligation.isEstimate,
      },
      '2026-04-10',
    );

    expect(fromReconcile.effectiveAmount).toBe(fromObligation.effectiveAmount);
    expect(fromReconcile.plannerStatus).toBe(fromObligation.plannerStatus);
    expect(fromReconcile.obligationAmountSource).toBe(
      fromObligation.obligationAmountSource,
    );
  });

  it('matches planner fields with custom plan and payments applied', () => {
    const plannedGross = 694.76;
    const obligation = buildCardStatementObligation({
      ...baseObligationInput,
      paymentsAppliedToStatement: 694.76,
      plannedGrossAmount: plannedGross,
    });
    const fromObligation = toDuePaymentItemFields(obligation);

    const fromReconcile = reconcileDuePaymentItemCanonicalFields(
      {
        nextDuePayment: fromObligation.nextDuePayment,
        paymentsAppliedToStatement: 694.76,
        statementDueDate: fromObligation.statementDueDate,
        plannedPayment: plannedGross,
        obligationAmountSource: fromObligation.obligationAmountSource,
        isEstimate: fromObligation.isEstimate,
      },
      '2026-04-10',
    );

    expect(fromObligation.effectiveAmount).toBe(0);
    expect(fromObligation.plannerStatus).toBe('pagado');
    expect(fromReconcile.effectiveAmount).toBe(fromObligation.effectiveAmount);
    expect(fromReconcile.plannerStatus).toBe('pagado');
  });
});
