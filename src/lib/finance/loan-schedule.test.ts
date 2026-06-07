import { describe, expect, it } from 'vitest';
import {
  calculateLoanProgress,
  deriveLoanStatusFromPayments,
  dueDateForFortnightlyPayment,
  formatDateYmd,
  generateLoanPaymentSchedule,
  getFortnightlyFirstAnchor,
  getFortnightlySecondAnchor,
  parseYmdAsUtcDate,
} from '@/lib/finance/loan-schedule';

describe('loan schedule', () => {
  it('generates weekly payments', () => {
    const schedule = generateLoanPaymentSchedule({
      startDate: parseYmdAsUtcDate('2026-05-18'),
      paymentAmount: 250,
      paymentCount: 3,
      frequency: 'WEEKLY',
    });

    expect(schedule.map((p) => formatDateYmd(p.dueDate))).toEqual([
      '2026-05-18',
      '2026-05-25',
      '2026-06-01',
    ]);
  });

  it('generates fortnightly payments aligned to calendar quincenas from day 1', () => {
    const schedule = generateLoanPaymentSchedule({
      startDate: parseYmdAsUtcDate('2026-06-01'),
      paymentAmount: 500,
      paymentCount: 6,
      frequency: 'FORTNIGHTLY',
    });

    expect(schedule.map((p) => formatDateYmd(p.dueDate))).toEqual([
      '2026-06-01',
      '2026-06-16',
      '2026-07-01',
      '2026-07-16',
      '2026-08-01',
      '2026-08-16',
    ]);
  });

  it('generates fortnightly payments with 15th and month-end anchors', () => {
    const schedule = generateLoanPaymentSchedule({
      startDate: parseYmdAsUtcDate('2026-06-15'),
      paymentAmount: 500,
      paymentCount: 4,
      frequency: 'FORTNIGHTLY',
    });

    expect(schedule.map((p) => formatDateYmd(p.dueDate))).toEqual([
      '2026-06-15',
      '2026-06-30',
      '2026-07-15',
      '2026-07-31',
    ]);
  });

  it('generates fortnightly payments when the start date is in the second quincena', () => {
    const schedule = generateLoanPaymentSchedule({
      startDate: parseYmdAsUtcDate('2026-06-16'),
      paymentAmount: 500,
      paymentCount: 4,
      frequency: 'FORTNIGHTLY',
    });

    expect(schedule.map((p) => formatDateYmd(p.dueDate))).toEqual([
      '2026-06-16',
      '2026-07-01',
      '2026-07-16',
      '2026-08-01',
    ]);
  });

  it('keeps legacy start-date offset for non-round fortnightly anchors', () => {
    const schedule = generateLoanPaymentSchedule({
      startDate: parseYmdAsUtcDate('2026-05-18'),
      paymentAmount: 500,
      paymentCount: 3,
      frequency: 'FORTNIGHTLY',
    });

    expect(schedule.map((p) => formatDateYmd(p.dueDate))).toEqual([
      '2026-05-18',
      '2026-06-03',
      '2026-06-18',
    ]);
  });

  it('places at most one payment per calendar quincena for a day-1 start', () => {
    const schedule = generateLoanPaymentSchedule({
      startDate: parseYmdAsUtcDate('2026-06-01'),
      paymentAmount: 500,
      paymentCount: 2,
      frequency: 'FORTNIGHTLY',
    });

    const firstFortnight = schedule.filter(
      (payment) => Number(formatDateYmd(payment.dueDate).slice(8, 10)) <= 15,
    );
    const secondFortnight = schedule.filter(
      (payment) => Number(formatDateYmd(payment.dueDate).slice(8, 10)) >= 16,
    );

    expect(firstFortnight).toHaveLength(1);
    expect(secondFortnight).toHaveLength(1);
  });

  it('clamps monthly payments to the last day of shorter months', () => {
    const schedule = generateLoanPaymentSchedule({
      startDate: parseYmdAsUtcDate('2026-01-31'),
      paymentAmount: 1000,
      paymentCount: 3,
      frequency: 'MONTHLY',
    });

    expect(schedule.map((p) => formatDateYmd(p.dueDate))).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ]);
  });

  it('calculates payoff progress from paid payments', () => {
    const progress = calculateLoanProgress({
      principalAmount: 2000,
      payments: [
        { amount: 500, status: 'PAID' },
        { amount: 500, status: 'SCHEDULED' },
        { amount: 500, status: 'PAID' },
      ],
    });

    expect(progress).toEqual({
      totalPayable: 1500,
      paidAmount: 1000,
      remainingAmount: 500,
      paidPayments: 2,
      remainingPayments: 1,
    });
  });

  it('uses scheduled payable amount instead of principal for interest-bearing loans', () => {
    const progress = calculateLoanProgress({
      principalAmount: 2000,
      payments: [
        { amount: 700, status: 'PAID' },
        { amount: 700, status: 'PAID' },
        { amount: 700, status: 'SCHEDULED' },
      ],
    });

    expect(progress.totalPayable).toBe(2100);
    expect(progress.remainingAmount).toBe(700);
  });

  it('keeps skipped payments as unresolved debt and excludes cancelled payments from payable debt', () => {
    const progress = calculateLoanProgress({
      principalAmount: 3000,
      payments: [
        { amount: 500, status: 'PAID' },
        { amount: 500, status: 'SKIPPED' },
        { amount: 500, status: 'CANCELLED' },
      ],
    });

    expect(progress).toEqual({
      totalPayable: 1000,
      paidAmount: 500,
      remainingAmount: 500,
      paidPayments: 1,
      remainingPayments: 1,
    });
  });

  it('derives active status while scheduled or skipped debt remains', () => {
    expect(
      deriveLoanStatusFromPayments([
        { status: 'PAID' },
        { status: 'SKIPPED' },
        { status: 'CANCELLED' },
      ]),
    ).toBe('ACTIVE');

    expect(
      deriveLoanStatusFromPayments([
        { status: 'PAID' },
        { status: 'CANCELLED' },
      ]),
    ).toBe('PAID_OFF');
  });
});

describe('fortnightly anchors', () => {
  it('derives first-anchor day from start date', () => {
    expect(getFortnightlyFirstAnchor(parseYmdAsUtcDate('2026-06-01'))).toBe(1);
    expect(getFortnightlyFirstAnchor(parseYmdAsUtcDate('2026-06-16'))).toBe(1);
  });

  it('uses month end for the second anchor when the first anchor is the 15th', () => {
    expect(
      getFortnightlySecondAnchor(15, 2026, 6),
    ).toBe(30);
    expect(
      getFortnightlySecondAnchor(15, 2026, 7),
    ).toBe(31);
  });

  it('maps August second-quincena payment to the 16th for a June 1 start', () => {
    expect(
      formatDateYmd(dueDateForFortnightlyPayment(parseYmdAsUtcDate('2026-06-01'), 5)),
    ).toBe('2026-08-16');
  });
});
