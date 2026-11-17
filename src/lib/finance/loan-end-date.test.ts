import { describe, expect, it } from 'vitest';
import {
  formatDateYmd,
  formatInstallmentLabel,
  generateLoanPaymentSchedule,
  getLoanEndDate,
  parseYmdAsUtcDate,
} from '@/lib/finance/loan-schedule';
import type { LoanPaymentFrequencyValue } from '@/types/loans';

const endYmd = (
  start: string,
  count: number,
  frequency: LoanPaymentFrequencyValue,
) => {
  const end = getLoanEndDate(parseYmdAsUtcDate(start), count, frequency);
  return end ? formatDateYmd(end) : null;
};

describe('getLoanEndDate', () => {
  it('weekly: last installment is (n-1) weeks after the start', () => {
    expect(endYmd('2026-05-18', 3, 'WEEKLY')).toBe('2026-06-01');
  });

  it('fortnightly: follows the 1st / 16th anchors', () => {
    expect(endYmd('2026-06-01', 3, 'FORTNIGHTLY')).toBe('2026-07-01');
    expect(endYmd('2026-06-10', 2, 'FORTNIGHTLY')).toBe('2026-07-01');
  });

  it('monthly: clamps to the last day of shorter months', () => {
    expect(endYmd('2026-01-31', 2, 'MONTHLY')).toBe('2026-02-28');
    expect(endYmd('2026-11-01', 24, 'MONTHLY')).toBe('2028-10-01');
  });

  it('crosses December into January for every frequency', () => {
    expect(endYmd('2026-12-28', 2, 'WEEKLY')).toBe('2027-01-04');
    expect(endYmd('2026-12-16', 2, 'FORTNIGHTLY')).toBe('2027-01-01');
    expect(endYmd('2026-11-15', 3, 'MONTHLY')).toBe('2027-01-15');
  });

  it('matches the last row of the generated schedule', () => {
    for (const frequency of ['WEEKLY', 'FORTNIGHTLY', 'MONTHLY'] as const) {
      const schedule = generateLoanPaymentSchedule({
        startDate: parseYmdAsUtcDate('2026-12-20'),
        paymentAmount: 100,
        paymentCount: 7,
        frequency,
      });
      expect(endYmd('2026-12-20', 7, frequency)).toBe(
        formatDateYmd(schedule.at(-1)!.dueDate),
      );
    }
  });

  it('returns null without installments', () => {
    expect(endYmd('2026-05-18', 0, 'MONTHLY')).toBeNull();
  });
});

describe('formatInstallmentLabel', () => {
  it('reads "Cuota x de n"', () => {
    expect(formatInstallmentLabel(19, 24)).toBe('Cuota 19 de 24');
    expect(formatInstallmentLabel(1, 6, { lowercase: true })).toBe('cuota 1 de 6');
  });
});
