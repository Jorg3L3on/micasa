import { describe, expect, it } from 'vitest';
import { getDashboardLoanStatDisplay } from './dashboard-loan-stat-display';

describe('getDashboardLoanStatDisplay', () => {
  it('shows payroll total when only nómina loans are due', () => {
    const result = getDashboardLoanStatDisplay({
      planningWalletLoanDue: null,
      planningPayrollLoanDeduction: { total: 2792.73, count: 1 },
    });

    expect(result.amount).toBe(2792.73);
    expect(result.subtitle).toBe('1 deducción nómina');
  });

  it('shows wallet-only subtitle when no payroll deductions', () => {
    const result = getDashboardLoanStatDisplay({
      planningWalletLoanDue: { total: 200, count: 1 },
      planningPayrollLoanDeduction: null,
    });

    expect(result.amount).toBe(200);
    expect(result.subtitle).toBe('1 pendiente billetera');
  });

  it('combines totals and splits subtitle when both sources are due', () => {
    const result = getDashboardLoanStatDisplay({
      planningWalletLoanDue: { total: 200, count: 1 },
      planningPayrollLoanDeduction: { total: 2792.73, count: 1 },
    });

    expect(result.amount).toBe(2992.73);
    expect(result.subtitle).toContain('billetera');
    expect(result.subtitle).toContain('nómina');
  });
});
