import { describe, expect, it } from 'vitest';
import {
  buildMonthDebtItems,
  monthDebtItemsTotal,
} from '@/lib/finance/liquidity-month-debt-items';

describe('buildMonthDebtItems', () => {
  it('lists card, loan, MSI, and payroll concepts and skips recurring templates', () => {
    const byMonth = buildMonthDebtItems(
      ['2026-08', '2026-09'],
      [
        {
          due_date: '2026-08-20',
          obligations: [
            {
              source: 'credit_card_statement',
              next_due_payment: 1179.43,
              wallet_id: 1,
              wallet_name: 'DIDI Card',
            },
            {
              source: 'loan_payment',
              next_due_payment: 3500,
              wallet_id: 10,
              wallet_name: 'Banamex',
              loan_id: 5,
              loan_payment_id: 50,
              loan_name: 'Banamex',
              lender: 'Banamex',
            },
            {
              source: 'expense_template',
              next_due_payment: 8000,
              wallet_id: 10,
              wallet_name: 'Efectivo',
            },
          ],
        },
      ],
      [
        {
          id: 'msi-9',
          kind: 'msi',
          title: 'Laptop',
          subtitle: 'Mercado Pago · 4 mensualidades',
          start_month_key: '2026-08',
          end_month_key: '2026-11',
          monthly_amount: 2700,
          wallet_name: 'Mercado Pago',
        },
      ],
      [
        {
          month_key: '2026-08',
          loan_id: 31,
          title: 'Fonacot Carmen',
          subtitle: 'Nómina · FONACOT',
          amount: 1243.68,
        },
        {
          month_key: '2026-08',
          loan_id: 31,
          title: 'Fonacot Carmen',
          subtitle: 'Nómina · FONACOT',
          amount: 1243.68,
        },
      ],
    );

    const august = byMonth.get('2026-08') ?? [];
    expect(august.map((item) => item.title)).toEqual([
      'Banamex',
      'Laptop',
      'Fonacot Carmen',
      'DIDI Card',
    ]);
    expect(august.find((item) => item.title === 'Fonacot Carmen')?.amount).toBeCloseTo(2487.36);
    expect(monthDebtItemsTotal(august)).toBeCloseTo(1179.43 + 3500 + 2700 + 2487.36);
    expect(august.some((item) => item.amount === 8000)).toBe(false);

    const september = byMonth.get('2026-09') ?? [];
    expect(september).toEqual([
      expect.objectContaining({ title: 'Laptop', amount: 2700, kind: 'msi' }),
    ]);
  });
});
