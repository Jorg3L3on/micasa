import { describe, expect, it } from 'vitest';
import { buildCardPlannerObligation } from '@/lib/finance/card-planner-obligation';
import {
  buildCardStatementObligation,
  resolveCreditCardStatementWindow,
} from '@/lib/finance/card-statement-obligation';
import { parseCalendarDate } from '@/lib/calendar-dates';
import {
  dueItemToPeriodObligation,
  exposedAnnualRate,
  exposedMinimumDue,
  lastPlannedOverrideWrite,
  minimumPaymentForPeriod,
  periodObligationPrefillAmount,
  resolveCardPeriodObligation,
} from '@/lib/finance/card-period-obligation';

const debtWithDue = {
  outstandingBalance: 4_200,
  dueInPeriod: true,
} as const;

describe('periodObligationPrefillAmount', () => {
  it('prefills a known obligation amount, including explicit zero', () => {
    expect(
      periodObligationPrefillAmount({
        amount: 800,
        confidence: 'exact',
      }),
    ).toBe(800);
    expect(
      periodObligationPrefillAmount({
        amount: 0,
        confidence: 'exact',
      }),
    ).toBe(0);
  });

  it('leaves the pay field empty when the corte is missing', () => {
    expect(
      periodObligationPrefillAmount({
        amount: null,
        confidence: 'missing',
      }),
    ).toBeNull();
    expect(periodObligationPrefillAmount(null)).toBeNull();
    expect(periodObligationPrefillAmount(undefined)).toBeNull();
  });
});

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

  it('bills only the MSI installment, not the remaining plan balance', () => {
    expect(
      resolveCardPeriodObligation({
        outstandingBalance: 12_000,
        dueInPeriod: true,
        msiInstallmentDue: 1_000,
      }),
    ).toEqual({
      amount: 1_000,
      basis: 'msi_installments',
      confidence: 'estimated',
      gaps: [],
    });
  });

  it('does not add MSI again when the statement already includes it', () => {
    expect(
      resolveCardPeriodObligation({
        outstandingBalance: 12_000,
        dueInPeriod: true,
        statementPayoff: 2_500,
        msiInstallmentDue: 1_000,
      }),
    ).toEqual({
      amount: 2_500,
      basis: 'statement_no_interest',
      confidence: 'exact',
      gaps: [],
    });
  });

  it('does not bill a calendar or MSI row when total debt is 0', () => {
    expect(
      resolveCardPeriodObligation({
        outstandingBalance: 0,
        dueInPeriod: true,
        scheduledAmount: 850,
        msiInstallmentDue: 400,
      }),
    ).toEqual({
      amount: 0,
      basis: 'none_declared',
      confidence: 'exact',
      gaps: [],
    });
  });

  it('feeds a persisted minimum only when the cycle has no statement', () => {
    expect(
      minimumPaymentForPeriod({
        statementPayoff: 2000,
        statementMinimum: null,
        persistedMinimum: 400,
      }),
    ).toBeNull();
    expect(
      minimumPaymentForPeriod({
        statementPayoff: null,
        persistedMinimum: 400,
      }),
    ).toBe(400);
    expect(
      resolveCardPeriodObligation({
        outstandingBalance: 8000,
        dueInPeriod: true,
        statementPayoff: 2000,
        minimumPayment: minimumPaymentForPeriod({
          statementPayoff: 2000,
          statementMinimum: null,
          persistedMinimum: 400,
        }),
      }),
    ).toMatchObject({
      amount: 2000,
      basis: 'statement_no_interest',
      confidence: 'exact',
    });
    expect(exposedAnnualRate(null)).toBeNull();
    expect(exposedAnnualRate(0.42)).toBe(0.42);
    expect(exposedAnnualRate(null)).not.toBe(0.36);
    expect(
      exposedMinimumDue({ statementMinimum: 250, persistedMinimum: 400 }),
    ).toBe(250);
    expect(
      exposedMinimumDue({ statementMinimum: null, persistedMinimum: 400 }),
    ).toBe(400);
    expect(exposedMinimumDue({ statementMinimum: null, persistedMinimum: null })).toBeNull();
  });

  it('does not let a captured minimum replace a statement payoff', () => {
    expect(
      resolveCardPeriodObligation({
        outstandingBalance: 5_000,
        dueInPeriod: true,
        statementPayoff: 2_000,
        minimumPayment: 400,
      }),
    ).toMatchObject({
      amount: 2_000,
      basis: 'statement_no_interest',
    });
    expect(
      resolveCardPeriodObligation({
        outstandingBalance: 5_000,
        dueInPeriod: true,
        statementPayoff: null,
        minimumPayment: 400,
      }),
    ).toEqual({
      amount: 400,
      basis: 'minimum',
      confidence: 'exact',
      gaps: [],
    });
  });

  it('treats a declared cycle of $0 as explicit zero, not a gap', () => {
    expect(
      resolveCardPeriodObligation({
        ...debtWithDue,
        explicitZero: true,
      }),
    ).toEqual({
      amount: 0,
      basis: 'none_declared',
      confidence: 'exact',
      gaps: [],
    });
  });

  it('treats an explicit statement zero as paid nothing, not a gap', () => {
    expect(
      resolveCardPeriodObligation({
        outstandingBalance: 900,
        dueInPeriod: true,
        statementPayoff: 0,
      }),
    ).toEqual({
      amount: 0,
      basis: 'none_declared',
      confidence: 'exact',
      gaps: [],
    });
  });

  it('subtracts fortnight payments that are not already in the statement figure', () => {
    expect(
      resolveCardPeriodObligation({
        outstandingBalance: 800,
        dueInPeriod: true,
        statementPayoff: 800,
        paymentsNotInPayoff: 200,
        paymentsApplied: 200,
      }).amount,
    ).toBe(600);
  });

  it('reads a calendar row and a captured minimum from the same due item', () => {
    expect(
      dueItemToPeriodObligation({
        outstandingBalance: 0,
        nextDuePayment: 850,
        obligationAmountSource: 'scheduled_calendar',
        statementPayoff: null,
        minimumPayment: 400,
      }),
    ).toMatchObject({
      amount: 0,
      basis: 'none_declared',
      confidence: 'exact',
    });
    expect(
      dueItemToPeriodObligation({
        outstandingBalance: 5_000,
        nextDuePayment: 0,
        obligationAmountSource: 'none',
        statementPayoff: null,
        minimumPayment: 400,
      }),
    ).toMatchObject({
      amount: 400,
      basis: 'minimum',
      confidence: 'exact',
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
