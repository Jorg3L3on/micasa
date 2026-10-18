import { describe, expect, it } from 'vitest';
import {
  buildMonthDebtItems,
  contractsForMonth,
  groupDebtItemsByMonth,
  monthDebtItemsTotal,
  monthDebtPaymentsTotal,
  pastLoanDebtSubtitle,
} from '@/lib/finance/liquidity-month-debt-items';

describe('buildMonthDebtItems', () => {
  it('carries the prestamista onto loans and the wallet icon onto cards and MSI', () => {
    const byMonth = buildMonthDebtItems(
      ['2026-10'],
      [
        {
          due_date: '2026-10-20',
          obligations: [
            {
              source: 'credit_card_statement',
              next_due_payment: 2700,
              wallet_id: 7,
              wallet_name: 'Mercado Pago',
            },
          ],
        },
      ],
      [
        {
          id: 'lender-3',
          kind: 'loan',
          title: 'Mercado Libre',
          subtitle: '5 contratos · 31 pagos',
          start_month_key: '2026-10',
          end_month_key: '2026-10',
          monthly_amount: 4800,
          schedule: [{ month_key: '2026-10', amount: 4800 }],
          lender_name: 'Mercado Libre',
          lender_icon_key: 'MERCADO_LIBRE',
        },
        {
          id: 'msi-1',
          kind: 'msi',
          title: 'iPad',
          subtitle: 'Tienda departamental',
          start_month_key: '2026-10',
          end_month_key: '2026-10',
          monthly_amount: 950,
          schedule: [{ month_key: '2026-10', amount: 950 }],
          wallet_id: 9,
          lender_name: 'Tienda departamental',
        },
      ],
      [],
      new Map([
        [7, 'MERCADO_PAGO'],
        [9, 'LIVERPOOL'],
      ]),
    );

    const items = byMonth.get('2026-10')!;
    const loan = items.find((item) => item.kind === 'loan');
    const card = items.find((item) => item.kind === 'card');
    const msi = items.find((item) => item.kind === 'msi');
    expect(loan).toMatchObject({
      lender_name: 'Mercado Libre',
      lender_icon_key: 'MERCADO_LIBRE',
    });
    expect(loan!.wallet_icon_key).toBeUndefined();
    expect(card!.wallet_icon_key).toBe('MERCADO_PAGO');
    expect(msi!.wallet_icon_key).toBe('LIVERPOOL');
    expect(msi!.lender_name).toBeUndefined();
  });

  it('lists remaining balances that decline after each cuota', () => {
    const byMonth = buildMonthDebtItems(
      ['2026-08', '2026-09', '2026-10', '2026-11'],
      [
        {
          due_date: '2026-08-20',
          obligations: [
            {
              source: 'credit_card_statement',
              next_due_payment: 1100,
              wallet_id: 1,
              wallet_name: 'Tarjeta digital',
            },
            {
              source: 'loan_payment',
              next_due_payment: 3500,
              wallet_id: 10,
              wallet_name: 'Débito casa',
              loan_id: 5,
              loan_payment_id: 50,
              loan_name: 'Préstamo personal',
              lender: 'Caja demo',
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
          title: 'Préstamo personal',
          subtitle: 'Caja demo · 2 pagos',
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
          subtitle: 'Tarjeta digital · 4 mensualidades',
          start_month_key: '2026-08',
          end_month_key: '2026-11',
          monthly_amount: 2700,
          schedule: [
            { month_key: '2026-08', amount: 2700 },
            { month_key: '2026-09', amount: 2700 },
            { month_key: '2026-10', amount: 2700 },
            { month_key: '2026-11', amount: 2700 },
          ],
          wallet_name: 'Tarjeta digital',
        },
        {
          id: 'loan-31',
          kind: 'loan',
          title: 'Descuento de nómina',
          subtitle: 'FONACOT · 2 pagos',
          start_month_key: '2026-08',
          end_month_key: '2026-10',
          monthly_amount: 900,
          schedule: [
            { month_key: '2026-08', amount: 900 },
            { month_key: '2026-10', amount: 900 },
          ],
        },
      ],
    );

    const august = byMonth.get('2026-08') ?? [];
    expect(august.map((item) => item.title)).toEqual([
      'Laptop',
      'Préstamo personal',
      'Descuento de nómina',
      'Tarjeta digital',
    ]);
    expect(august.find((item) => item.title === 'Descuento de nómina')).toMatchObject({
      amount: 1800,
      payment_amount: 900,
    });
    expect(august.find((item) => item.title === 'Préstamo personal')).toMatchObject({
      amount: 7000,
      payment_amount: 3500,
    });
    expect(august.find((item) => item.title === 'Laptop')).toMatchObject({
      amount: 10800,
      payment_amount: 2700,
    });
    expect(monthDebtItemsTotal(august)).toBeCloseTo(10800 + 7000 + 1800 + 1100);
    expect(monthDebtPaymentsTotal(august)).toBeCloseTo(2700 + 3500 + 900 + 1100);
    expect(august.some((item) => item.amount === 8000)).toBe(false);

    const september = byMonth.get('2026-09') ?? [];
    expect(september.find((item) => item.title === 'Laptop')).toMatchObject({
      amount: 8100,
      payment_amount: 2700,
    });
    expect(september.find((item) => item.title === 'Préstamo personal')).toMatchObject({
      amount: 3500,
      payment_amount: 3500,
    });
    expect(september.find((item) => item.title === 'Descuento de nómina')).toMatchObject({
      amount: 900,
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
        title: 'Tarjeta digital',
        subtitle: 'Pago de tarjeta',
        amount: 500,
      },
      {
        month_key: '2026-03',
        kind: 'card',
        group_id: '12',
        title: 'Tarjeta digital',
        subtitle: 'Pago de tarjeta',
        amount: 600,
      },
      {
        month_key: '2026-03',
        kind: 'loan',
        group_id: '5',
        title: 'Préstamo personal',
        subtitle: 'Caja demo',
        amount: 3500,
      },
      {
        month_key: '2026-03',
        kind: 'loan',
        group_id: '31',
        title: 'Descuento de nómina',
        subtitle: pastLoanDebtSubtitle('PAYROLL_DEDUCTION', 'FONACOT'),
        amount: 900,
      },
      {
        month_key: '2026-04',
        kind: 'loan',
        group_id: '5',
        title: 'Préstamo personal',
        subtitle: 'Caja demo',
        amount: 3500,
      },
    ]);

    const march = byMonth.get('2026-03') ?? [];
    expect(march.map((item) => item.title)).toEqual(['Préstamo personal', 'Tarjeta digital', 'Descuento de nómina']);
    expect(march.find((item) => item.title === 'Tarjeta digital')?.amount).toBeCloseTo(1100);
    expect(monthDebtItemsTotal(march)).toBeCloseTo(3500 + 900 + 1100);
    expect(byMonth.get('2026-04')).toEqual([
      expect.objectContaining({ title: 'Préstamo personal', amount: 3500, kind: 'loan' }),
    ]);
  });
});

describe('pastLoanDebtSubtitle', () => {
  it('labels payroll deductions vs wallet loans', () => {
    expect(pastLoanDebtSubtitle('PAYROLL_DEDUCTION', 'FONACOT')).toBe('Nómina · FONACOT');
    expect(pastLoanDebtSubtitle('WALLET', 'Caja demo')).toBe('Caja demo');
  });
});

describe('loan contracts', () => {
  const contracts = [
    {
      loan_id: 11,
      name: 'Préstamo auto',
      is_payroll: false,
      schedule: [
        { month_key: '2026-10', amount: 1000, due_date: '2026-10-16' },
        { month_key: '2026-11', amount: 1000, due_date: '2026-11-16' },
        { month_key: '2026-12', amount: 1000, due_date: '2026-12-16' },
      ],
    },
    {
      loan_id: 12,
      name: 'Nómina',
      is_payroll: true,
      schedule: [{ month_key: '2026-10', amount: 500, due_date: '2026-10-30' }],
    },
  ];

  it('computes each contract as of the month and drops paid-off ones', () => {
    expect(contractsForMonth(contracts, '2026-10')).toEqual([
      {
        loan_id: 11,
        name: 'Préstamo auto',
        is_payroll: false,
        remaining: 3000,
        payment_amount: 1000,
        remaining_payments: 3,
        next_due_date: '2026-10-16',
      },
      {
        loan_id: 12,
        name: 'Nómina',
        is_payroll: true,
        remaining: 500,
        payment_amount: 500,
        remaining_payments: 1,
        next_due_date: '2026-10-30',
      },
    ]);

    const november = contractsForMonth(contracts, '2026-11');
    expect(november).toHaveLength(1);
    expect(november[0]).toMatchObject({ loan_id: 11, remaining: 2000, remaining_payments: 2 });
  });

  it('attaches contracts to the lender row for that month', () => {
    const byMonth = buildMonthDebtItems(
      ['2026-10', '2026-11'],
      [],
      [
        {
          id: 'lender-4',
          kind: 'loan',
          title: 'Banco',
          subtitle: '2 contratos · 4 pagos',
          start_month_key: '2026-10',
          end_month_key: '2026-12',
          monthly_amount: 1500,
          schedule: [
            { month_key: '2026-10', amount: 1500 },
            { month_key: '2026-11', amount: 1000 },
            { month_key: '2026-12', amount: 1000 },
          ],
          lender_name: 'Banco',
          contracts,
        },
      ],
    );

    const october = byMonth.get('2026-10')![0]!;
    expect(october.contracts?.map((contract) => contract.loan_id)).toEqual([11, 12]);
    const november = byMonth.get('2026-11')![0]!;
    expect(november.contracts?.map((contract) => contract.loan_id)).toEqual([11]);
  });
});
