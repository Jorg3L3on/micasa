import { describe, expect, it } from 'vitest';
import {
  buildCardPlannerObligation,
  derivePlannerStatus,
  isPlannerPlanStale,
} from '@/lib/finance/card-planner-obligation';
import {
  buildCardStatementObligation,
  resolveCreditCardStatementWindow,
} from '@/lib/finance/card-statement-obligation';
import { parseCalendarDate } from '@/lib/calendar-dates';

const buildStatement = (input: {
  asOf: string;
  cutoff: number;
  due: number;
  walletDebt: number;
  importDue: number | null;
  statementPayments: number;
  ledgerBalance?: number;
}) => {
  const window = resolveCreditCardStatementWindow(
    parseCalendarDate(input.asOf),
    input.cutoff,
    input.due,
  );
  return buildCardStatementObligation({
    walletId: 1,
    walletName: 'Test',
    walletType: 'DEPARTMENT_STORE_CARD',
    cutoffDay: input.cutoff,
    dueDay: input.due,
    window,
    lastStatementBalance: input.ledgerBalance ?? 0,
    paymentsAppliedToStatement: input.statementPayments,
    importedTotalDue: input.importDue,
    outstandingBalance: input.walletDebt,
    asOfYmd: input.asOf,
    todayYmd: '2026-07-07',
  });
};

describe('derivePlannerStatus', () => {
  it('returns pagado when fortnight target is fully covered', () => {
    expect(
      derivePlannerStatus({
        remainingPlannerAmount: 0,
        paymentsAppliedToFortnight: 694.76,
        outstandingBalance: 3190,
        visibleDueDate: '2026-07-05',
        todayYmd: '2026-07-07',
      }),
    ).toBe('pagado');
  });

  it('returns vencido when remaining and past due', () => {
    expect(
      derivePlannerStatus({
        remainingPlannerAmount: 500,
        paymentsAppliedToFortnight: 0,
        outstandingBalance: 500,
        visibleDueDate: '2026-07-05',
        todayYmd: '2026-07-07',
      }),
    ).toBe('vencido');
  });

  it('returns por_pagar when remaining and not yet due', () => {
    expect(
      derivePlannerStatus({
        remainingPlannerAmount: 1217.01,
        paymentsAppliedToFortnight: 0,
        outstandingBalance: 7554,
        visibleDueDate: '2026-07-13',
        todayYmd: '2026-07-07',
      }),
    ).toBe('por_pagar');
  });

  it('returns sin_cargo when nothing due and no debt', () => {
    expect(
      derivePlannerStatus({
        remainingPlannerAmount: 0,
        paymentsAppliedToFortnight: 0,
        targetAmount: 0,
        outstandingBalance: 0,
        visibleDueDate: '2026-07-18',
        todayYmd: '2026-07-24',
      }),
    ).toBe('sin_cargo');
  });

  it('does not mark pagado for $0 target while wallet still has debt', () => {
    // Screenshot fixture: DIDI / MP style false Pagado $0
    expect(
      derivePlannerStatus({
        remainingPlannerAmount: 0,
        paymentsAppliedToFortnight: 0,
        paymentsAppliedToStatement: 0,
        targetAmount: 0,
        outstandingBalance: 2913.07,
        visibleDueDate: '2026-07-18',
        todayYmd: '2026-07-24',
      }),
    ).toBe('vencido');
  });

  it('returns pagado when statement payments covered a zero remaining target', () => {
    expect(
      derivePlannerStatus({
        remainingPlannerAmount: 0,
        paymentsAppliedToFortnight: 0,
        paymentsAppliedToStatement: 2519.99,
        targetAmount: 0,
        outstandingBalance: 0,
        visibleDueDate: '2026-06-18',
        todayYmd: '2026-06-20',
      }),
    ).toBe('pagado');
  });
});

describe('Liverpool fixtures (planner vs statement)', () => {
  it('Carmen: plan $694.76 paid in fortnight → pagado despite zero statement credit', () => {
    const statement = buildStatement({
      asOf: '2026-07-05',
      cutoff: 6,
      due: 5,
      walletDebt: 3190.02,
      importDue: null,
      statementPayments: 0,
    });
    expect(statement.paymentsAppliedToStatement).toBe(0);
    expect(statement.remainingStatementDue).toBeGreaterThan(0);

    const planner = buildCardPlannerObligation({
      fortnightId: 37,
      statement,
      plannedGrossAmount: 694.76,
      paymentsAppliedToFortnight: 694.76,
      todayYmd: '2026-07-07',
    });

    expect(planner.plannerStatus).toBe('pagado');
    expect(planner.remainingPlannerAmount).toBe(0);
    expect(planner.paymentsAppliedToStatement).toBe(0);
    expect(planner.paymentsAppliedToFortnight).toBe(694.76);
  });

  it('Jorge: suggested $1217.01 paid in fortnight → pagado despite zero statement credit', () => {
    const statement = buildStatement({
      asOf: '2026-07-13',
      cutoff: 12,
      due: 13,
      walletDebt: 7554.67,
      importDue: 1217.01,
      statementPayments: 0,
    });

    const planner = buildCardPlannerObligation({
      fortnightId: 37,
      statement,
      plannedGrossAmount: null,
      paymentsAppliedToFortnight: 1217.01,
      todayYmd: '2026-07-07',
    });

    expect(planner.plannerStatus).toBe('pagado');
    expect(planner.remainingPlannerAmount).toBe(0);
    expect(planner.targetAmount).toBe(1217.01);
    expect(planner.paymentsAppliedToStatement).toBe(0);
  });

  it('partial plan payment leaves por_pagar or vencido', () => {
    const statement = buildStatement({
      asOf: '2026-07-05',
      cutoff: 6,
      due: 5,
      walletDebt: 3000,
      importDue: null,
      statementPayments: 0,
    });

    const planner = buildCardPlannerObligation({
      fortnightId: 37,
      statement,
      plannedGrossAmount: 500,
      paymentsAppliedToFortnight: 300,
      todayYmd: '2026-07-07',
    });

    expect(planner.remainingPlannerAmount).toBe(200);
    expect(planner.plannerStatus).toBe('vencido');
  });
  it('zero plan with debt does not become pagado (screenshot regression)', () => {
    const statement = buildStatement({
      asOf: '2026-07-18',
      cutoff: 3,
      due: 18,
      walletDebt: 2913.07,
      importDue: null,
      statementPayments: 0,
    });

    const planner = buildCardPlannerObligation({
      fortnightId: 38,
      statement,
      plannedGrossAmount: 0,
      paymentsAppliedToFortnight: 0,
      todayYmd: '2026-07-24',
    });

    // $0 plan is ignored; suggested falls back to wallet debt.
    expect(planner.plannedPayment).toBeNull();
    expect(planner.targetAmount).toBe(2913.07);
    expect(planner.plannerStatus).toBe('vencido');
    expect(planner.outstandingBalance).toBe(2913.07);
  });
});

describe('isPlannerPlanStale', () => {
  it('flags covered plan that should be cleared', () => {
    expect(
      isPlannerPlanStale({
        plannedGrossAmount: 694.76,
        remainingPlannerAmount: 0,
        paymentsAppliedToFortnight: 694.76,
      }),
    ).toBe(true);
  });

  it('ignores when no plan', () => {
    expect(
      isPlannerPlanStale({
        plannedGrossAmount: null,
        remainingPlannerAmount: 0,
        paymentsAppliedToFortnight: 100,
      }),
    ).toBe(false);
  });
});
