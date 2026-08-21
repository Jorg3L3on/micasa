import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseCalendarDate } from '@/lib/calendar-dates';
import { PaymentMethodType } from '@/generated/prisma/client';

const {
  queryRaw,
  findManyWallet,
  findManyExpense,
  findManyFortnight,
  findManyExpenseTemplate,
  findManyIncome,
  findManyIncomeTemplate,
  findManyLoanPayment,
  findManyStatementImport,
  findManyLoan,
} = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  findManyWallet: vi.fn(),
  findManyExpense: vi.fn(),
  findManyFortnight: vi.fn(),
  findManyExpenseTemplate: vi.fn(),
  findManyIncome: vi.fn(),
  findManyIncomeTemplate: vi.fn(),
  findManyLoanPayment: vi.fn(),
  findManyStatementImport: vi.fn(),
  findManyLoan: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    $queryRaw: queryRaw,
    wallet: { findMany: findManyWallet },
    expense: { findMany: findManyExpense },
    fortnight: { findMany: findManyFortnight },
    expenseTemplate: { findMany: findManyExpenseTemplate },
    income: { findMany: findManyIncome },
    incomeTemplate: { findMany: findManyIncomeTemplate },
    loanPayment: { findMany: findManyLoanPayment },
    loan: { findMany: findManyLoan },
    creditCardStatementImport: { findMany: findManyStatementImport },
  },
}));

import { getLiquidityProjection } from '@/lib/finance/liquidity-projection.service';

const userOwner = { user_id: 1, house_id: null } as const;

const fundingRow = {
  id: 10,
  name: 'Efectivo',
  type: PaymentMethodType.CASH,
  amount: '500',
};

const visaRow = {
  id: 7,
  name: 'Visa',
  type: PaymentMethodType.CREDIT_CARD,
  cutoff_day: 15,
  due_day: 20,
};

const setupWalletMock = (
  funding: typeof fundingRow[],
  cards: typeof visaRow[],
) => {
  findManyWallet.mockImplementation(
    async (args: { where: { type?: { in: string[] } } }) => {
      const types = args.where?.type?.in ?? [];
      if (
        types.includes(PaymentMethodType.CREDIT_CARD) ||
        types.includes(PaymentMethodType.DEPARTMENT_STORE_CARD)
      ) {
        return cards;
      }
      return funding;
    },
  );
};

describe('getLiquidityProjection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 2, 10, 12, 0, 0)));
    queryRaw.mockReset();
    findManyWallet.mockReset();
    findManyExpense.mockReset();
    findManyExpense.mockResolvedValue([]);
    findManyFortnight.mockReset();
    findManyExpenseTemplate.mockReset();
    findManyIncome.mockReset();
    findManyIncomeTemplate.mockReset();
    findManyLoanPayment.mockReset();
    findManyStatementImport.mockReset();
    findManyLoan.mockReset();
    findManyStatementImport.mockResolvedValue([]);
    findManyFortnight.mockResolvedValue([]);
    findManyIncome.mockResolvedValue([]);
    findManyIncomeTemplate.mockResolvedValue([]);
    findManyLoanPayment.mockResolvedValue([]);
    findManyLoan.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('throws INVALID_HORIZON when until is before asOf', async () => {
    setupWalletMock([fundingRow], []);
    await expect(
      getLiquidityProjection({
        ownerFilter: userOwner,
        asOf: new Date(Date.UTC(2026, 5, 1)),
        until: new Date(Date.UTC(2026, 2, 1)),
      }),
    ).rejects.toMatchObject({ code: 'INVALID_HORIZON' });
  });

  it('returns empty milestones when there are no credit cards', async () => {
    setupWalletMock([fundingRow], []);
    findManyExpense.mockResolvedValue([]);
    const until = new Date(Date.UTC(2026, 8, 1));
    const result = await getLiquidityProjection({
      ownerFilter: userOwner,
      until,
      includeUnpaidExpenses: false,
    });
    expect(result.milestones).toEqual([]);
    expect(result.summary.total_obligations_due_on_or_before_until).toBe(0);
    expect(result.summary.funding_total).toBe(500);
    expect(queryRaw).not.toHaveBeenCalled();
    expect(findManyStatementImport).not.toHaveBeenCalled();
  });

  it('excludes funding wallets that are not include_in_liquidity', async () => {
    setupWalletMock(
      [
        fundingRow,
        {
          id: 11,
          name: 'Ahorro',
          type: PaymentMethodType.CASH,
          amount: '1000',
        },
      ],
      [],
    );
    // Simulate Prisma filter: only wallets with include_in_liquidity true are returned.
    findManyWallet.mockImplementation(
      async (args: {
        where: {
          type?: { in: string[] };
          include_in_liquidity?: boolean;
        };
      }) => {
        const types = args.where?.type?.in ?? [];
        if (
          types.includes(PaymentMethodType.CREDIT_CARD) ||
          types.includes(PaymentMethodType.DEPARTMENT_STORE_CARD)
        ) {
          return [];
        }
        expect(args.where.include_in_liquidity).toBe(true);
        return [fundingRow];
      },
    );
    findManyExpense.mockResolvedValue([]);
    const until = new Date(Date.UTC(2026, 8, 1));
    const result = await getLiquidityProjection({
      ownerFilter: userOwner,
      until,
      includeUnpaidExpenses: false,
    });
    expect(result.summary.funding_total).toBe(500);
    expect(result.funding_wallets).toEqual([
      {
        id: 10,
        name: 'Efectivo',
        type: PaymentMethodType.CASH,
        balance: 500,
      },
    ]);
  });

  it('loads ledger once and builds CC milestone from purchases in closed statement', async () => {
    setupWalletMock([fundingRow], [visaRow]);
    queryRaw
      .mockResolvedValueOnce([
        {
          wallet_id: 7,
          amount: '300',
          eff: new Date(Date.UTC(2026, 1, 5)),
        },
      ])
      .mockResolvedValueOnce([]);
    findManyExpense.mockResolvedValue([]);
    const until = new Date(Date.UTC(2026, 8, 1));
    const result = await getLiquidityProjection({
      ownerFilter: userOwner,
      until,
      includeUnpaidExpenses: false,
    });
    expect(queryRaw).toHaveBeenCalledTimes(2);
    expect(result.milestones.length).toBeGreaterThanOrEqual(1);
    const first = result.milestones[0]!;
    expect(first.obligations.some((o) => o.source === 'credit_card_statement')).toBe(
      true,
    );
    const cc = first.obligations.find((o) => o.wallet_id === 7)!;
    expect(cc.next_due_payment).toBe(300);
    expect(cc.last_statement_balance).toBe(300);
    expect(result.summary.total_obligations_due_on_or_before_until).toBeGreaterThanOrEqual(
      300,
    );
  });

  it('merges unpaid funding expenses into milestones', async () => {
    setupWalletMock([fundingRow], [visaRow]);
    queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    findManyExpense.mockResolvedValueOnce([
      {
        id: 99,
        description: 'Luz',
        amount: '80',
        payment_date: null,
        wallet_id: 10,
        fortnight: {
          id: 1,
          end_date: new Date(Date.UTC(2026, 2, 15, 23, 59, 59)),
        },
        wallet: {
          id: 10,
          name: 'Efectivo',
          type: PaymentMethodType.CASH,
        },
      },
    ]);
    const until = new Date(Date.UTC(2026, 8, 1));
    const result = await getLiquidityProjection({
      ownerFilter: userOwner,
      until,
      includeUnpaidExpenses: true,
    });
    const unpaid = result.milestones.flatMap((m) => m.obligations).find(
      (o) => o.source === 'unpaid_expense',
    );
    expect(unpaid).toMatchObject({
      expense_id: 99,
      next_due_payment: 80,
      wallet_id: 10,
    });
  });

  it('skips unpaid query when includeUnpaidExpenses is false', async () => {
    setupWalletMock([fundingRow], []);
    const until = new Date(Date.UTC(2026, 8, 1));
    await getLiquidityProjection({
      ownerFilter: userOwner,
      until,
      includeUnpaidExpenses: false,
    });
    expect(findManyExpense).not.toHaveBeenCalled();
  });

  it('applies stress percent to cycle spend when closed statement is zero', async () => {
    setupWalletMock([fundingRow], [visaRow]);
    queryRaw
      .mockResolvedValueOnce([
        {
          wallet_id: 7,
          amount: '200',
          eff: new Date(Date.UTC(2026, 2, 5)),
        },
      ])
      .mockResolvedValueOnce([]);
    findManyExpense.mockResolvedValue([]);
    const until = new Date(Date.UTC(2026, 8, 1));
    const result = await getLiquidityProjection({
      ownerFilter: userOwner,
      until,
      includeUnpaidExpenses: false,
      stressCyclePercent: 50,
    });
    const cc = result.milestones
      .flatMap((m) => m.obligations)
      .find((o) => o.source === 'credit_card_statement' && o.stress_adjustment);
    expect(cc).toBeDefined();
    expect(cc!.stress_adjustment).toBe(100);
    expect(cc!.next_due_payment).toBe(100);
  });

  it('adds template estimate when fortnight exists and no expense from template', async () => {
    setupWalletMock([fundingRow], []);
    findManyFortnight.mockResolvedValue([
      {
        id: 50,
        period: 'FIRST',
        end_date: new Date(Date.UTC(2026, 3, 15, 12, 0, 0)),
        start_date: new Date(Date.UTC(2026, 3, 1, 12, 0, 0)),
      },
    ]);
    findManyExpense.mockResolvedValue([]);
    findManyExpenseTemplate.mockResolvedValue([
      {
        id: 1,
        name: 'Netflix',
        suggested_amount: '199',
        wallet_id: 10,
      },
    ]);
    const until = new Date(Date.UTC(2026, 8, 1));
    const result = await getLiquidityProjection({
      ownerFilter: userOwner,
      until,
      includeUnpaidExpenses: false,
      includeExpenseTemplates: true,
    });
    const tpl = result.milestones
      .flatMap((m) => m.obligations)
      .find((o) => o.source === 'expense_template');
    expect(tpl).toMatchObject({
      template_name: 'Netflix',
      next_due_payment: 199,
      is_estimate: true,
      expense_template_id: 1,
    });
    const april = result.monthly_series.find((month) => month.month_key === '2026-04');
    expect(april?.expense_template_total).toBe(199);
    expect(april?.total_payments_due).toBeGreaterThanOrEqual(199);
    expect(april?.remaining_payments_from_month).toBe(0);
  });

  it('adds scheduled wallet loan payments to obligations', async () => {
    setupWalletMock([fundingRow], []);
    findManyExpense.mockResolvedValue([]);
    findManyLoanPayment
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 22,
          amount: '150',
          due_date: new Date(Date.UTC(2026, 3, 10, 12, 0, 0)),
          source_wallet: {
            id: 10,
            name: 'Efectivo',
            type: PaymentMethodType.CASH,
          },
          loan: {
            id: 5,
            name: 'Prestamo DiDi',
            lender: 'DiDi',
            payment_source: 'WALLET',
          },
        },
      ]);

    const result = await getLiquidityProjection({
      ownerFilter: userOwner,
      until: new Date(Date.UTC(2026, 8, 1)),
      includeUnpaidExpenses: false,
    });

    const loan = result.milestones
      .flatMap((m) => m.obligations)
      .find((o) => o.source === 'loan_payment');

    expect(loan).toMatchObject({
      loan_payment_id: 22,
      loan_name: 'Prestamo DiDi',
      next_due_payment: 150,
      wallet_id: 10,
    });
    expect(result.summary.total_obligations_due_on_or_before_until).toBe(150);
    expect(result.monthly_series.find((m) => m.month_key === '2026-04')).toMatchObject({
      loan_payment_total: 150,
    });
  });

  it('excludes paid/skipped/cancelled payments and inactive loans by query filters', async () => {
    setupWalletMock([fundingRow], []);
    findManyLoanPayment.mockResolvedValue([]);

    await getLiquidityProjection({
      ownerFilter: userOwner,
      until: parseCalendarDate('2026-04-30'),
      includeUnpaidExpenses: false,
    });

    expect(findManyLoanPayment).toHaveBeenCalledTimes(2);
    expect(findManyLoanPayment).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'SCHEDULED',
          loan: expect.objectContaining({
            ...userOwner,
            status: 'ACTIVE',
            payment_source: 'PAYROLL_DEDUCTION',
          }),
        }),
      }),
    );
    expect(findManyLoanPayment).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'SCHEDULED',
          loan: expect.objectContaining({
            ...userOwner,
            status: 'ACTIVE',
            payment_source: 'WALLET',
          }),
        }),
      }),
    );
  });

  it('subtracts scheduled payroll loan deductions from expected income', async () => {
    setupWalletMock([], []);
    findManyFortnight.mockResolvedValue([]);
    findManyIncome.mockResolvedValue([]);
    findManyLoanPayment
      .mockResolvedValueOnce([
        {
          amount: '250',
          due_date: parseCalendarDate('2026-04-15'),
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await getLiquidityProjection({
      ownerFilter: userOwner,
      until: parseCalendarDate('2026-04-30'),
      includeUnpaidExpenses: false,
    });

    expect(result.summary.expected_income_total_on_or_before_until).toBe(-250);
    expect(result.monthly_series.find((m) => m.month_key === '2026-04')).toMatchObject({
      expected_income_total: -250,
    });
  });

  it('echoes options in result', async () => {
    setupWalletMock([], []);
    findManyExpense.mockResolvedValue([]);
    const until = new Date(Date.UTC(2026, 8, 1));
    const result = await getLiquidityProjection({
      ownerFilter: userOwner,
      until,
      includeUnpaidExpenses: false,
      includeExpenseTemplates: true,
      stressCyclePercent: 12.7,
    });
    expect(result.options).toEqual({
      stress_cycle_percent: 13,
      include_unpaid_expenses: false,
      include_expense_templates: true,
    });
  });

  it('keeps summary algebra consistent with monthly series and milestones', async () => {
    setupWalletMock(
      [
        { ...fundingRow, amount: '1000' },
        {
          id: 11,
          name: 'Debito',
          type: PaymentMethodType.DEBIT_CARD,
          amount: '500',
        },
      ],
      [],
    );
    findManyFortnight.mockResolvedValue([
      {
        id: 70,
        period: 'FIRST',
        end_date: parseCalendarDate('2026-03-15'),
        start_date: parseCalendarDate('2026-03-01'),
      },
      {
        id: 71,
        period: 'SECOND',
        end_date: parseCalendarDate('2026-04-30'),
        start_date: parseCalendarDate('2026-04-16'),
      },
    ]);
    findManyIncome.mockResolvedValue([
      { amount: '2000', received_at: parseCalendarDate('2026-03-10') },
      { amount: '800', received_at: parseCalendarDate('2026-04-20') },
    ]);
    findManyIncomeTemplate.mockResolvedValue([]);
    findManyExpense.mockResolvedValue([
      {
        id: 901,
        description: 'Renta',
        amount: '900',
        payment_date: parseCalendarDate('2026-03-15'),
        wallet_id: 10,
        fortnight: { id: 70, end_date: parseCalendarDate('2026-03-15') },
        wallet: { id: 10, name: 'Efectivo', type: PaymentMethodType.CASH },
      },
      {
        id: 902,
        description: 'Internet',
        amount: '300',
        payment_date: parseCalendarDate('2026-04-05'),
        wallet_id: 11,
        fortnight: { id: 71, end_date: parseCalendarDate('2026-04-30') },
        wallet: { id: 11, name: 'Debito', type: PaymentMethodType.DEBIT_CARD },
      },
    ]);
    findManyExpenseTemplate.mockResolvedValue([
      {
        id: 30,
        name: 'Gas',
        suggested_amount: '250',
        wallet_id: 10,
      },
    ]);
    findManyLoanPayment
      .mockResolvedValueOnce([
        {
          amount: '120',
          due_date: parseCalendarDate('2026-03-31'),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 777,
          amount: '400',
          due_date: parseCalendarDate('2026-04-10'),
          source_wallet: {
            id: 10,
            name: 'Efectivo',
            type: PaymentMethodType.CASH,
          },
          loan: {
            id: 4,
            name: 'Prestamo auto',
            lender: 'Banco',
            payment_source: 'WALLET',
          },
        },
      ]);

    const result = await getLiquidityProjection({
      ownerFilter: userOwner,
      until: parseCalendarDate('2026-04-30'),
      includeUnpaidExpenses: true,
      includeExpenseTemplates: true,
    });

    const totalMonthlyIncome = result.monthly_series.reduce(
      (sum, month) => sum + month.expected_income_total,
      0,
    );
    const totalMonthlyDebt = result.monthly_series.reduce(
      (sum, month) => sum + month.total_payments_due,
      0,
    );
    const totalMilestoneDebt = result.milestones.reduce(
      (sum, milestone) => sum + milestone.total_due,
      0,
    );

    expect(result.summary.expected_income_total_on_or_before_until).toBe(
      totalMonthlyIncome,
    );
    expect(result.summary.total_obligations_due_on_or_before_until).toBe(
      totalMonthlyDebt,
    );
    expect(result.summary.total_obligations_due_on_or_before_until).toBe(
      totalMilestoneDebt,
    );
    expect(result.summary.net_liquidity_versus_obligations).toBe(
      result.summary.funding_total -
        result.summary.total_obligations_due_on_or_before_until,
    );
    expect(
      result.summary.net_liquidity_versus_obligations_including_income,
    ).toBe(
      result.summary.funding_total +
        result.summary.expected_income_total_on_or_before_until -
        result.summary.total_obligations_due_on_or_before_until,
    );
    for (const month of result.monthly_series) {
      expect(month.monthly_remaining).toBe(
        month.expected_income_total - month.total_payments_due,
      );
      expect(month.total_payments_due).toBe(
        month.msi_debt_total +
          month.installment_payment_total +
          month.loan_payment_total +
          month.expense_template_total +
          month.other_debt_components_total,
      );
    }
    expect(Array.isArray(result.projection_events)).toBe(true);
    expect(Array.isArray(result.projection_tracks)).toBe(true);
  });

  it('does not double count payroll deductions as wallet loan obligations', async () => {
    setupWalletMock([fundingRow], []);
    findManyFortnight.mockResolvedValue([]);
    findManyIncome.mockResolvedValue([]);
    findManyIncomeTemplate.mockResolvedValue([]);
    findManyExpense.mockResolvedValue([]);
    findManyLoanPayment
      .mockResolvedValueOnce([
        {
          amount: '300',
          due_date: parseCalendarDate('2026-04-15'),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 2001,
          amount: '500',
          due_date: parseCalendarDate('2026-04-22'),
          source_wallet: {
            id: 10,
            name: 'Efectivo',
            type: PaymentMethodType.CASH,
          },
          loan: {
            id: 12,
            name: 'Prestamo personal',
            lender: 'Banco',
            payment_source: 'WALLET',
          },
        },
      ]);

    const result = await getLiquidityProjection({
      ownerFilter: userOwner,
      until: parseCalendarDate('2026-04-30'),
      includeUnpaidExpenses: false,
    });

    const april = result.monthly_series.find((month) => month.month_key === '2026-04');
    expect(april).toBeDefined();
    expect(april?.expected_income_total).toBe(-300);
    expect(april?.loan_payment_total).toBe(500);
    expect(april?.other_debt_components_total).toBe(0);
    expect(result.summary.expected_income_total_on_or_before_until).toBe(-300);
    expect(result.summary.total_obligations_due_on_or_before_until).toBe(500);
  });

  it('puts a payoff marker on payroll loans like Fonacot when the last cuota is in view', async () => {
    setupWalletMock([fundingRow], []);
    findManyLoan.mockResolvedValue([
      {
        id: 31,
        name: 'Fonacot Carmen',
        lender: 'FONACOT',
        payment_amount: 1243.68,
        payment_source: 'PAYROLL_DEDUCTION',
        payments: [
          { due_date: parseCalendarDate('2026-04-16'), amount: '1243.68' },
          { due_date: parseCalendarDate('2026-10-16'), amount: '1243.68' },
        ],
      },
    ]);
    findManyLoanPayment
      .mockResolvedValueOnce([
        { amount: '1243.68', due_date: parseCalendarDate('2026-04-16') },
        { amount: '1243.68', due_date: parseCalendarDate('2026-10-16') },
      ])
      .mockResolvedValueOnce([]);

    const result = await getLiquidityProjection({
      ownerFilter: userOwner,
      until: parseCalendarDate('2026-10-31'),
      includeUnpaidExpenses: false,
    });

    expect(result.projection_events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event_type: 'loan_payoff',
          month_key: '2026-10',
          title: 'Terminas de pagar Fonacot Carmen',
          loan_id: 31,
        }),
      ]),
    );

    const april = result.monthly_series.find((month) => month.month_key === '2026-04');
    const september = result.monthly_series.find((month) => month.month_key === '2026-09');
    const october = result.monthly_series.find((month) => month.month_key === '2026-10');
    const afterPayoff = result.monthly_series.find((month) => month.month_key === '2026-11');

    expect(april?.loan_payment_total).toBe(0);
    expect(april?.debt_items).toEqual([
      expect.objectContaining({
        kind: 'loan',
        title: 'Fonacot Carmen',
        amount: 1243.68,
      }),
    ]);
    expect(april?.remaining_payments_from_month).toBeCloseTo(2487.36);
    expect(september?.remaining_payments_from_month).toBeCloseTo(1243.68);
    expect(october?.remaining_payments_from_month).toBeCloseTo(1243.68);
    expect(afterPayoff).toBeUndefined();
  });
});
