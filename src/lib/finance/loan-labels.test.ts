import { describe, expect, it } from 'vitest';
import {
  formatLoanInstallmentCaption,
  getLoanSourceLabel,
} from '@/lib/finance/loan-labels';

describe('getLoanSourceLabel', () => {
  it('uses the income template for payroll and the wallet otherwise', () => {
    expect(
      getLoanSourceLabel({
        paymentSource: 'PAYROLL_DEDUCTION',
        incomeTemplateName: 'Salario Carmen',
      }),
    ).toBe('Salario Carmen');
    expect(getLoanSourceLabel({ paymentSource: 'PAYROLL_DEDUCTION' })).toBe('Nómina');
    expect(
      getLoanSourceLabel({ paymentSource: 'WALLET', sourceWalletName: 'Efectivo' }),
    ).toBe('Efectivo');
    expect(getLoanSourceLabel({ paymentSource: 'WALLET' })).toBeNull();
  });
});

describe('formatLoanInstallmentCaption', () => {
  it('reads "fuente · cuota x de n · termina mes año"', () => {
    expect(
      formatLoanInstallmentCaption({
        source: 'Salario Carmen',
        sequence: 19,
        paymentCount: 24,
        endDate: '2027-06-16',
      }),
    ).toBe('Salario Carmen · cuota 19 de 24 · termina jun 2027');
  });

  it('drops missing parts', () => {
    expect(
      formatLoanInstallmentCaption({ sequence: 4, paymentCount: 12, endDate: null }),
    ).toBe('cuota 4 de 12');
  });
});
