import { describe, expect, it } from 'vitest';
import {
  buildCardStatementObligation,
  resolveCreditCardStatementWindow,
  toDuePaymentItemFields,
} from '@/lib/finance/card-statement-obligation';
import { buildCardPlannerObligation } from '@/lib/finance/card-planner-obligation';
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
    const statement = buildCardStatementObligation({
      ...baseObligationInput,
      plannedGrossAmount: null,
    });
    const planner = buildCardPlannerObligation({
      fortnightId: 10,
      statement,
      plannedGrossAmount: null,
      paymentsAppliedToFortnight: 0,
      todayYmd: '2026-03-10',
    });

    expect(planner.remainingPlannerAmount).toBe(statement.remainingStatementDue);
    expect(planner.visibleDueDate).toBe('2026-03-17');
    expect(planner.plannerStatus).toBe('por_pagar');
  });

  it('marks pagado when fortnight payments cover custom plan', () => {
    const plannedGross = 694.76;
    const statement = buildCardStatementObligation({
      ...baseObligationInput,
      paymentsAppliedToStatement: 0,
      plannedGrossAmount: plannedGross,
    });
    const planner = buildCardPlannerObligation({
      fortnightId: 10,
      statement,
      plannedGrossAmount: plannedGross,
      paymentsAppliedToFortnight: 694.76,
      todayYmd: '2026-04-10',
    });

    expect(planner.remainingPlannerAmount).toBe(0);
    expect(planner.plannerStatus).toBe('pagado');
    expect(planner.paymentsAppliedToStatement).toBe(0);
    expect(planner.paymentsAppliedToFortnight).toBe(694.76);
  });
});

describe('statement vs planner divergence (documented)', () => {
  it('statement path can show pagado via paymentsAppliedToStatement while planner uses fortnight', () => {
    const plannedGross = 694.76;
    const statementObligation = buildCardStatementObligation({
      ...baseObligationInput,
      paymentsAppliedToStatement: 694.76,
      plannedGrossAmount: plannedGross,
    });
    const fromStatement = toDuePaymentItemFields(statementObligation);

    const fromPlanner = buildCardPlannerObligation({
      fortnightId: 10,
      statement: buildCardStatementObligation({
        ...baseObligationInput,
        paymentsAppliedToStatement: 0,
        plannedGrossAmount: plannedGross,
      }),
      plannedGrossAmount: plannedGross,
      paymentsAppliedToFortnight: 694.76,
      todayYmd: '2026-04-10',
    });

    expect(fromStatement.plannerStatus).toBe('pagado');
    expect(fromPlanner.plannerStatus).toBe('pagado');
    expect(fromStatement.paymentsAppliedToStatement).toBe(694.76);
    expect(fromPlanner.paymentsAppliedToStatement).toBe(0);
  });
});
