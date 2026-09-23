import { describe, expect, it } from 'vitest';
import { summarizeOverdueLoans } from '@/lib/finance/lender-alert-copy';

describe('summarizeOverdueLoans', () => {
  it('groups wallet dues of the same lender into one payment', () => {
    const summary = summarizeOverdueLoans([
      { paymentSource: 'WALLET', lender: 'Mercado Libre', lenderId: 4 },
      { paymentSource: 'WALLET', lender: 'MELI', lenderId: 4 },
      { paymentSource: 'PAYROLL_DEDUCTION', lender: 'FONACOT', lenderId: 8 },
    ]);

    expect(summary.parts).toEqual([
      '1 pago a Mercado Libre',
      '1 deducción nómina',
    ]);
    expect(summary.obligationCount).toBe(2);
  });

  it('pluralizes several payroll deductions', () => {
    const summary = summarizeOverdueLoans([
      { paymentSource: 'PAYROLL_DEDUCTION', lender: 'FONACOT', lenderId: 8 },
      { paymentSource: 'PAYROLL_DEDUCTION', lender: 'FONACOT', lenderId: 8 },
    ]);

    expect(summary.parts).toEqual(['2 deducciones nómina']);
    expect(summary.obligationCount).toBe(2);
  });
});
