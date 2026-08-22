import { describe, expect, it } from 'vitest';
import {
  buildMonthDebtItems,
  groupDebtItemsByMonth,
  monthDebtItemsTotal,
  monthDebtPaymentsTotal,
  pastLoanDebtSubtitle,
} from '@/lib/finance/liquidity-month-debt-items';

describe('buildMonthDebtItems', () => {
  it('lists remaining balances that decline after each cuota', () => {
    const byMonth = buildMonthDebtItems(
      ['2026-08', '2026-09', '2026-10', '2026-11'],
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
          id: 'loan-5',
          kind: 'loan',
          title: 'Banamex',
          subtitle: 'Banamex · 2 pagos',
          start_month_key: '2026-08',
          end_month_key: '2026-09',
          monthly_amount: 3500,
          schedule: [
            { month_key: '2026-08', amount: 3500 },
            { month_key: '2026-09', amount: 3500 },
          ],
        },
        {
          id: 'msi-9',
          kind: 'msi',
          title: 'Laptop',
          subtitle: 'Mercado Pago · 4 mensualidades',
          start_month_key: '2026-08',
          end_month_key: '2026-11',
          monthly_amount: 2700,
          schedule: [
            { month_key: '2026-08', amount: 2700 },
            { month_key: '2026-09', amount: 2700 },
            { month_key: '2026-10', amount: 2700 },
            { month_key: '2026-11', amount: 2700 },
          ],
          wallet_name: 'Mercado Pago',
        },
        {
          id: 'loan-31',
          kind: 'loan',
          title: 'Fonacot Carmen',
          subtitle: 'FONACOT · 2 pagos',
          start_month_key: '2026-08',
          end_month_key: '2026-10',
          monthly_amount: 1243.68,
          schedule: [
            { month_key: '2026-08', amount: 1243.68 },
            { month_key: '2026-10', amount: 1243.68 },
          ],
        },
      ],
    );

    const august = byMonth.get('2026-08') ?? [];
    expect(august.map((item) => item.title)).toEqual([
      'Laptop',
      'Banamex',
      'Fonacot Carmen',
      'DIDI Card',
    ]);
    expect(august.find((item) => item.title === 'Fonacot Carmen')).toMatchObject({
      amount: 2487.36,
      payment_amount: 1243.68,
    });
    expect(august.find((item) => item.title === 'Banamex')).toMatchObject({
      amount: 7000,
      payment_amount: 3500,
    });
    expect(august.find((item) => item.title === 'Laptop')).toMatchObject({
      amount: 10800,
      payment_amount: 2700,
    });
    expect(monthDebtItemsTotal(august)).toBeCloseTo(10800 + 7000 + 2487.36 + 1179.43);
    expect(monthDebtPaymentsTotal(august)).toBeCloseTo(2700 + 3500 + 1243.68 + 1179.43);
    expect(august.some((item) => item.amount === 8000)).toBe(false);

    const september = byMonth.get('2026-09') ?? [];
    expect(september.find((item) => item.title === 'Laptop')).toMatchObject({
      amount: 8100,
      payment_amount: 2700,
    });
    expect(september.find((item) => item.title === 'Banamex')).toMatchObject({
      amount: 3500,
      payment_amount: 3500,
    });
    expect(september.find((item) => item.title === 'Fonacot Carmen')).toMatchObject({
      amount: 1243.68,
      payment_amount: 0,
    });
  });
});

describe('groupDebtItemsByMonth', () => {
  it('merges same-wallet card payments and keeps loans as named concepts', () => {
    const byMonth = groupDebtItemsByMonth([
      {
        month_key: '2026-03',
        kind: 'card',
        group_id: '12',
        title: 'DIDI Card',
        subtitle: 'Pago de tarjeta',
        amount: 500,
      },
      {
        month_key: '2026-03',
        kind: 'card',
        group_id: '12',
        title: 'DIDI Card',
        subtitle: 'Pago de tarjeta',
        amount: 679.43,
      },
      {
        month_key: '2026-03',
        kind: 'loan',
        group_id: '5',
        title: 'Banamex',
        subtitle: 'Banamex',
        amount: 3500,
      },
      {
        month_key: '2026-03',
        kind: 'loan',
        group_id: '31',
        title: 'Fonacot Carmen',
        subtitle: pastLoanDebtSubtitle('PAYROLL_DEDUCTION', 'FONACOT'),
        amount: 1243.68,
      },
      {
        month_key: '2026-04',
        kind: 'loan',
        group_id: '5',
        title: 'Banamex',
        subtitle: 'Banamex',
        amount: 3500,
      },
    ]);

    const march = byMonth.get('2026-03') ?? [];
    expect(march.map((item) => item.title)).toEqual(['Banamex', 'Fonacot Carmen', 'DIDI Card']);
    expect(march.find((item) => item.title === 'DIDI Card')?.amount).toBeCloseTo(1179.43);
    expect(monthDebtItemsTotal(march)).toBeCloseTo(3500 + 1243.68 + 1179.43);
    expect(byMonth.get('2026-04')).toEqual([
      expect.objectContaining({ title: 'Banamex', amount: 3500, kind: 'loan' }),
    ]);
  });
});

describe('pastLoanDebtSubtitle', () => {
  it('labels payroll deductions vs wallet loans', () => {
    expect(pastLoanDebtSubtitle('PAYROLL_DEDUCTION', 'FONACOT')).toBe('Nómina · FONACOT');
    expect(pastLoanDebtSubtitle('WALLET', 'Banamex')).toBe('Banamex');
  });
});
