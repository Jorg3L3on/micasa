import { describe, expect, it } from 'vitest';
import {
  PAYROLL_DEDUCTION_COPY,
  isPayrollOnlyLoans,
  payrollCommitmentHint,
} from '@/lib/finance/lender-payroll';

describe('isPayrollOnlyLoans', () => {
  it('ignores paid-off wallet contracts', () => {
    expect(
      isPayrollOnlyLoans([
        { status: 'PAID_OFF', paymentSource: 'WALLET' },
        { status: 'ACTIVE', paymentSource: 'PAYROLL_DEDUCTION' },
      ]),
    ).toBe(true);
  });

  it('is false when an active wallet contract remains', () => {
    expect(
      isPayrollOnlyLoans([
        { status: 'ACTIVE', paymentSource: 'WALLET' },
        { status: 'ACTIVE', paymentSource: 'PAYROLL_DEDUCTION' },
      ]),
    ).toBe(false);
  });
});

describe('payrollCommitmentHint', () => {
  it('keeps the deduction copy with the date', () => {
    expect(payrollCommitmentHint('1 oct 2026')).toBe(
      `${PAYROLL_DEDUCTION_COPY} · 1 oct 2026`,
    );
  });
});
