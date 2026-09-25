import { describe, expect, it } from 'vitest';
import { createCreditCardInstallmentPlanSchema } from '@/schemas/credit-card-installment-plan.schema';
import {
  allocateUnpaidInstallmentAmounts,
  issuerRemainingFitsSchedule,
  resolveCardPeriodDue,
  resolvePlanRemainingBalance,
  splitAggregatedDueAndInstallment,
} from '@/lib/finance/credit-card-msi-period-due';

const msi = (installmentAmount: number, remainingBalance: number) => ({
  installmentAmount,
  remainingBalance,
});

describe('resolveCardPeriodDue', () => {
  it('keeps total debt distinct from the statement payoff', () => {
    const result = resolveCardPeriodDue({
      totalDebt: 8000,
      statementPayoff: 1500,
      regularCharges: 1000,
      msi: [msi(500, 6000)],
    });

    expect(result.totalDebt).toBe(8000);
    expect(result.periodDue).toBe(1500);
    expect(result.planRemainingBalance).toBe(6000);
    expect(result.source).toBe('statement');
    expect(result.periodDue).not.toBe(result.totalDebt);
    expect(result.periodDue).not.toBe(result.planRemainingBalance);
  });

  it('bills only the MSI installment plus regular charges when there is no statement', () => {
    const result = resolveCardPeriodDue({
      totalDebt: 9000,
      statementPayoff: null,
      regularCharges: 200,
      msi: [msi(350, 1400)],
    });

    expect(result.periodDue).toBe(550);
    expect(result.installmentDue).toBe(350);
    expect(result.planRemainingBalance).toBe(1400);
    expect(result.source).toBe('components');
    expect(result.periodDue).not.toBe(1400);
    expect(result.periodDue).not.toBe(9000);
  });

  it('does not bill remaining plan balance or total debt when the due is outside the period', () => {
    const result = resolveCardPeriodDue({
      totalDebt: 4200.55,
      statementPayoff: null,
      regularCharges: 0,
      msi: [msi(0, 4200.55)],
      dueInPeriod: false,
    });

    expect(result.periodDue).toBe(0);
    expect(result.planRemainingBalance).toBe(4200.55);
    expect(result.source).toBe('none');
  });

  it('reports missing instead of $0 when debt is due and there is no corte figure', () => {
    const result = resolveCardPeriodDue({
      totalDebt: 4200,
      statementPayoff: null,
      msi: [msi(0, 4200)],
      dueInPeriod: true,
    });

    expect(result.periodDue).toBeNull();
    expect(result.source).toBe('missing');
    expect(result.periodDue).not.toBe(result.totalDebt);
  });

  it('names planned, minimum and scheduled sources when the period has a charge', () => {
    expect(
      resolveCardPeriodDue({
        totalDebt: 4000,
        statementPayoff: 2000,
        plannedOverride: 600,
      }).source,
    ).toBe('planned_override');

    expect(
      resolveCardPeriodDue({
        totalDebt: 4000,
        statementPayoff: null,
        minimumPayment: 350,
      }),
    ).toMatchObject({ periodDue: 350, source: 'minimum' });

    expect(
      resolveCardPeriodDue({
        totalDebt: 400,
        statementPayoff: null,
        regularCharges: 180,
      }),
    ).toMatchObject({ periodDue: 180, source: 'scheduled' });

    expect(
      resolveCardPeriodDue({
        totalDebt: 0,
        statementPayoff: null,
        regularCharges: 180,
        msi: [msi(400, 1200)],
      }),
    ).toMatchObject({ periodDue: 0, source: 'none' });
  });

  it('does not add the installment again when the statement payoff already includes it', () => {
    const period = resolveCardPeriodDue({
      totalDebt: 6400,
      statementPayoff: 1500,
      msi: [msi(500, 4500)],
    });
    const split = splitAggregatedDueAndInstallment({
      aggregatedDue: period.periodDue,
      installmentDue: period.installmentDue,
    });

    expect(period.periodDue).toBe(1500);
    expect(split.periodDue).toBe(1500);
    expect(split.revolvingLeftover).toBe(1000);
    expect(split.installmentDue).toBe(500);
    expect(split.periodDue).not.toBe(1500 + 500);
    expect(split.periodDue).not.toBe(period.planRemainingBalance);
  });

  it('keeps a scheduled calendar row beside the installment without dropping either', () => {
    const split = splitAggregatedDueAndInstallment({
      aggregatedDue: 180,
      installmentDue: 650,
      aggregatedExcludesInstallment: true,
    });

    expect(split.periodDue).toBe(830);
    expect(split.revolvingLeftover).toBe(180);
  });
});

describe('exact issuer cents', () => {
  it('sums issuer-stated cuotas instead of mensualidad times remaining months', () => {
    const exact = resolvePlanRemainingBalance({
      scheduledAmounts: [333.34, 333.33, 333.33],
      monthlyAmount: 333.33,
      remainingCount: 3,
    });
    const naive = resolvePlanRemainingBalance({
      monthlyAmount: 333.33,
      remainingCount: 3,
    });

    expect(exact).toBe(1000);
    expect(naive).toBe(999.99);
    expect(exact).not.toBe(naive);
  });

  it('puts the cent adjustment on the last unpaid cuota', () => {
    const amounts = allocateUnpaidInstallmentAmounts({
      installmentAmount: 333.33,
      unpaidCount: 3,
      issuerRemainingBalance: 1000,
    });

    expect(amounts).toEqual([333.33, 333.33, 333.34]);
    expect(issuerRemainingFitsSchedule({
      installmentAmount: 333.33,
      unpaidCount: 3,
      issuerRemainingBalance: 1000,
    })).toBe(true);
  });

  it('rejects a remaining balance that would make the last cuota zero or negative', () => {
    expect(
      issuerRemainingFitsSchedule({
        installmentAmount: 100,
        unpaidCount: 3,
        issuerRemainingBalance: 150,
      }),
    ).toBe(false);

    const parsed = createCreditCardInstallmentPlanSchema.safeParse({
      name: 'Example plan',
      installment_amount: 100,
      total_installments: 3,
      paid_installments: 0,
      issuer_remaining_balance: 150,
    });
    expect(parsed.success).toBe(false);

    const exact = createCreditCardInstallmentPlanSchema.safeParse({
      name: 'Example plan',
      installment_amount: 333.33,
      total_installments: 3,
      paid_installments: 0,
      issuer_remaining_balance: 1000,
    });
    expect(exact.success).toBe(true);
  });
});
