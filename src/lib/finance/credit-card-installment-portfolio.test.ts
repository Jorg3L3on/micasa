import { describe, expect, it } from 'vitest';
import {
  buildInstallmentPortfolio,
  sumInstallmentExposure,
} from '@/lib/finance/credit-card-installment-portfolio';

describe('buildInstallmentPortfolio', () => {
  it('computes progress and remaining exposure for active MSI', () => {
    const items = buildInstallmentPortfolio([
      {
        id: 1,
        description: 'Laptop',
        amount: 500,
        payment_date: '2026-05-01',
        category: 'Tech',
        categoryIcon: null,
        fortnight_id: 1,
        fortnight_year: 2026,
        fortnight_month: 5,
        fortnight_period: 'FIRST',
        credit_installment_current: 2,
        credit_installment_total: 12,
      },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].remainingInstallments).toBe(10);
    expect(items[0].progressPct).toBe(17);
    expect(items[0].remainingAmount).toBe(5000);
    expect(sumInstallmentExposure(items)).toBe(5000);
  });

  it('excludes completed installment purchases', () => {
    const items = buildInstallmentPortfolio([
      {
        id: 2,
        description: 'Done',
        amount: 100,
        payment_date: '2026-04-01',
        category: 'Other',
        categoryIcon: null,
        fortnight_id: 1,
        fortnight_year: 2026,
        fortnight_month: 4,
        fortnight_period: 'SECOND',
        credit_installment_current: 6,
        credit_installment_total: 6,
      },
    ]);
    expect(items).toHaveLength(0);
  });
});
