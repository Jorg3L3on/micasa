import { describe, expect, it } from 'vitest';
import { buildCardPlannerObligation } from '@/lib/finance/card-planner-obligation';
import {
  buildCardStatementObligation,
  resolveCreditCardStatementWindow,
} from '@/lib/finance/card-statement-obligation';
import { parseCalendarDate } from '@/lib/calendar-dates';
import {
  lastPlannedOverrideWrite,
  resolveCardPeriodObligation,
} from '@/lib/finance/card-period-obligation';

const debtWithDue = {
  outstandingBalance: 4_200,
  dueInPeriod: true,
} as const;

describe('resolveCardPeriodObligation', () => {
  it('does not show $0 when debt is due and the statement payment is unknown', () => {
    expect(resolveCardPeriodObligation(debtWithDue)).toEqual({
      amount: null,
      basis: 'none_declared',
      confidence: 'missing',
      gaps: ['missing_statement_payoff'],
    });
  });

  it('uses a planned override on every surface that reads the obligation', () => {
    expect(
      resolveCardPeriodObligation({
        ...debtWithDue,
        plannedOverride: 900,
      }),
    ).toEqual({
      amount: 900,
      basis: 'planned_override',
      confidence: 'exact',
      gaps: [],
    });
  });

  it('marks an external payment as paid zero, not a missing gap', () => {
    expect(
      resolveCardPeriodObligation({
        ...debtWithDue,
        paymentsApplied: 1_500,
      }),
    ).toEqual({
      amount: 0,
      basis: 'none_declared',
      confidence: 'exact',
      gaps: [],
    });
  });

  it('keeps the last planned write and does not zero another period', () => {
    const lastWrite = lastPlannedOverrideWrite([400, 900, 1_200]);
    expect(lastWrite).toBe(1_200);
    expect(
      resolveCardPeriodObligation({
        ...debtWithDue,
        plannedOverride: lastWrite,
      }).amount,
    ).toBe(1_200);
    expect(resolveCardPeriodObligation(debtWithDue)).toMatchObject({
      amount: null,
      confidence: 'missing',
    });
  });

  it('does not copy total debt when the wallet has no balance', () => {
    expect(
      resolveCardPeriodObligation({
        outstandingBalance: 0,
        dueInPeriod: true,
      }),
    ).toEqual({
      amount: 0,
      basis: 'none_declared',
      confidence: 'exact',
      gaps: [],
    });
  });
});

describe('planner last write', () => {
  it('keeps the latest positive plan when the statement figure is missing', () => {
    const asOf = parseCalendarDate('2026-07-18');
    const statement = buildCardStatementObligation({
      walletId: 1,
      walletName: 'Visa',
      walletType: 'CREDIT_CARD',
      cutoffDay: 3,
      dueDay: 18,
      window: resolveCreditCardStatementWindow(asOf, 3, 18),
      lastStatementBalance: 0,
      paymentsAppliedToStatement: 0,
      importedTotalDue: null,
      outstandingBalance: 4_200,
      asOfYmd: '2026-07-18',
      todayYmd: '2026-07-18',
    });

    const first = buildCardPlannerObligation({
      fortnightId: 10,
      statement,
      plannedGrossAmount: 400,
      paymentsAppliedToFortnight: 0,
      todayYmd: '2026-07-18',
    });
    const last = buildCardPlannerObligation({
      fortnightId: 10,
      statement,
      plannedGrossAmount: lastPlannedOverrideWrite([400, 900, 1_200]),
      paymentsAppliedToFortnight: 0,
      todayYmd: '2026-07-18',
    });
    const otherPeriod = buildCardPlannerObligation({
      fortnightId: 11,
      statement,
      plannedGrossAmount: null,
      paymentsAppliedToFortnight: 0,
      todayYmd: '2026-07-18',
    });

    expect(first.remainingPlannerAmount).toBe(400);
    expect(last.remainingPlannerAmount).toBe(1_200);
    expect(last.plannerStatus).toBe('por_pagar');
    expect(otherPeriod.plannerStatus).toBe('falta_dato');
    expect(otherPeriod.remainingPlannerAmount).toBe(0);
  });
});
