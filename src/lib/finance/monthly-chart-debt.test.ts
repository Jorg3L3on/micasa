import { describe, expect, it } from 'vitest';
import { parseCalendarDate } from '@/lib/calendar-dates';
import {
  calendarMonthKeyFromDate,
  pastDebtDateForLoanPayment,
} from '@/lib/finance/monthly-chart-debt';

describe('pastDebtDateForLoanPayment', () => {
  it('uses paid_at for wallet loans that were paid', () => {
    const paidAt = parseCalendarDate('2026-03-12');
    expect(
      pastDebtDateForLoanPayment({
        status: 'PAID',
        paid_at: paidAt,
        due_date: parseCalendarDate('2026-03-01'),
        payment_source: 'WALLET',
      }),
    ).toBe(paidAt);
  });

  it('uses due_date for payroll deductions and skips cancelled rows', () => {
    const due = parseCalendarDate('2026-04-16');
    expect(
      pastDebtDateForLoanPayment({
        status: 'SCHEDULED',
        paid_at: null,
        due_date: due,
        payment_source: 'PAYROLL_DEDUCTION',
      }),
    ).toBe(due);
    expect(
      pastDebtDateForLoanPayment({
        status: 'CANCELLED',
        paid_at: null,
        due_date: due,
        payment_source: 'PAYROLL_DEDUCTION',
      }),
    ).toBeNull();
  });

  it('does not treat unpaid wallet loans as past debt', () => {
    expect(
      pastDebtDateForLoanPayment({
        status: 'SCHEDULED',
        paid_at: null,
        due_date: parseCalendarDate('2026-02-10'),
        payment_source: 'WALLET',
      }),
    ).toBeNull();
  });
});

describe('calendarMonthKeyFromDate', () => {
  it('uses Mexico City civil month', () => {
    expect(calendarMonthKeyFromDate(parseCalendarDate('2026-08-21'))).toBe('2026-08');
  });
});
