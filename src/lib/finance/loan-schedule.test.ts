import { describe, expect, it } from 'vitest';
import {
  calculateLoanProgress,
  deriveLoanStatusFromPayments,
  formatDateYmd,
  generateLoanPaymentSchedule,
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

  it('generates fortnightly payments', () => {
    const schedule = generateLoanPaymentSchedule({
      startDate: parseYmdAsUtcDate('2026-05-18'),
      paymentAmount: 500,
      paymentCount: 3,
      frequency: 'FORTNIGHTLY',
    });

    expect(schedule.map((p) => formatDateYmd(p.dueDate))).toEqual([
      '2026-05-18',
      '2026-06-01',
      '2026-06-15',
    ]);
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
