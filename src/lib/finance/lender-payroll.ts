export const PAYROLL_DEDUCTION_COPY = 'Se descuenta del ingreso';

type PayrollLoan = {
  status: string;
  paymentSource: string;
};

/** Active contracts are all payroll deductions. Paid-off wallet loans do not count. */
export const isPayrollOnlyLoans = (loans: readonly PayrollLoan[]): boolean => {
  const active = loans.filter((loan) => loan.status === 'ACTIVE');
  return (
    active.length > 0 &&
    active.every((loan) => loan.paymentSource === 'PAYROLL_DEDUCTION')
  );
};

export const payrollCommitmentHint = (dateLabel: string | null): string =>
  dateLabel ? `${PAYROLL_DEDUCTION_COPY} · ${dateLabel}` : PAYROLL_DEDUCTION_COPY;
