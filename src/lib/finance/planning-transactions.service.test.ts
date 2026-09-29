import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  findManyExpense,
  findManyFortnight,
  findManyIncome,
  listLoanPaymentsForPlannerMonth,
  getDuePaymentsForPlannerMonth,
} = vi.hoisted(() => ({
  findManyExpense: vi.fn(),
  findManyFortnight: vi.fn(),
  findManyIncome: vi.fn(),
  listLoanPaymentsForPlannerMonth: vi.fn(),
  getDuePaymentsForPlannerMonth: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    expense: { findMany: findManyExpense },
    fortnight: { findMany: findManyFortnight },
    income: { findMany: findManyIncome },
  },
}));

vi.mock('@/lib/finance/planning-credit-card-payments', () => ({
  buildFortnightWhereForReport: () => null,
  linkedCardPaymentExpenseIds: () => new Set<number>(),
  listCreditCardPaymentsForPlanning: vi.fn(),
  mapCreditCardPaymentToTransactionRow: vi.fn(),
  unionPaidAtRangeFromFortnights: vi.fn(),
}));

vi.mock('@/lib/finance/loan.service', () => ({
  listLoanPaymentsForPlannerMonth,
}));

vi.mock('@/lib/finance/credit-card-statement.service', () => ({
  getDuePaymentsForPlannerMonth,
}));

import { listPlanningTransactions } from '@/lib/finance/planning-transactions.service';

const ownerFilter = { user_id: 1, house_id: null } as const;

describe('listPlanningTransactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findManyFortnight.mockResolvedValue([]);
    findManyIncome.mockResolvedValue([]);
    findManyExpense.mockResolvedValue([
      {
        id: 10,
        description: 'Super',
        amount: 500,
        is_paid: false,
        payment_date: new Date('2026-07-05T12:00:00.000Z'),
        created_at: new Date('2026-07-01T12:00:00.000Z'),
        category: { name: 'Food', icon: 'UTENSILS' },
        wallet: { name: 'Santander', type: 'DEBIT_CARD' },
        wallet_id: 2,
        due_day: null,
      },
    ]);
    getDuePaymentsForPlannerMonth.mockResolvedValue({ first: [], second: [] });
    listLoanPaymentsForPlannerMonth.mockResolvedValue({
      first: [
        {
          id: 22,
          loanId: 4,
          sequence: 1,
          dueDate: '2026-07-15',
          amount: 2800,
          status: 'SCHEDULED',
          paidAt: null,
          sourceWalletId: null,
          sourceWalletName: null,
          linkedExpenseId: null,
          lenderPaymentId: null,
          note: null,
          loanName: 'Préstamo nómina B',
          lender: 'Banco',
          lenderId: 9,
          loanType: 'PAYROLL',
          paymentSource: 'PAYROLL_DEDUCTION',
          linkedWalletId: null,
          linkedWalletName: null,
          incomeTemplateName: 'Banamex',
        },
      ],
      second: [],
    });
  });

  it('lists scheduled loan payments with the fortnight expenses', async () => {
    const rows = await listPlanningTransactions({
      ownerFilter,
      year: '2026',
      month: '07',
      period: 'FIRST',
      type: 'expense',
      excludeCreditInstallment: true,
      resolvedFortnightIds: [1],
    });

    expect(rows.some((row) => row.description === 'Super')).toBe(true);
    expect(
      rows.some((row) => row.planning_row_kind === 'loan_payment'),
    ).toBe(true);
    expect(findManyExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              user_id: 1,
              house_id: null,
              fortnight_id: { in: [1] },
            }),
          ]),
        }),
      }),
    );
    const expenseWhere = findManyExpense.mock.calls[0]?.[0]?.where;
    expect(JSON.stringify(expenseWhere)).not.toContain('loan_payment_id');
  });

  it('queries FIRST when the period query is 1', async () => {
    await listPlanningTransactions({
      ownerFilter,
      year: '2026',
      month: '6',
      period: '1',
      excludeCreditInstallment: false,
    });

    expect(findManyFortnight).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          period: 'FIRST',
          month: 6,
          year: 2026,
        }),
      }),
    );
  });

  it('queries SECOND when the period query is 2', async () => {
    await listPlanningTransactions({
      ownerFilter,
      year: '2026',
      month: '6',
      period: '2',
      excludeCreditInstallment: false,
    });

    expect(findManyFortnight).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ period: 'SECOND' }),
      }),
    );
  });

  it('sends the paid calendar day only when the expense is paid', async () => {
    findManyExpense.mockResolvedValue([
      {
        id: 11,
        description: 'Sky',
        amount: 269,
        is_paid: true,
        payment_date: new Date('2026-09-04T12:00:00.000Z'),
        created_at: new Date('2026-09-04T19:36:13.876Z'),
        category: { name: 'Hogar', icon: null },
        wallet: { name: 'Santander', type: 'DEBIT_CARD' },
        wallet_id: 3,
        due_day: 30,
      },
    ]);

    const rows = await listPlanningTransactions({
      ownerFilter,
      year: '2026',
      month: '11',
      period: 'FIRST',
      type: 'expense',
      excludeCreditInstallment: true,
      resolvedFortnightIds: [46],
    });

    expect(rows[0]).toMatchObject({
      description: 'Sky',
      is_paid: true,
      paid_at: '2026-09-04',
      due_day: 30,
      loan_payment_id: null,
      lender_payment_id: null,
    });
  });

  it('keeps a settled loan expense in the feed and marks its loan link', async () => {
    findManyExpense.mockResolvedValue([
      {
        id: 31,
        description: 'Pago préstamo: Auto (Banco)',
        amount: 1500,
        is_paid: true,
        payment_date: new Date('2026-09-16T12:00:00.000Z'),
        created_at: new Date('2026-09-16T12:00:00.000Z'),
        loan_payment_id: 22,
        category: { name: 'Préstamos', icon: 'LANDMARK' },
        wallet: { name: 'Débito', type: 'DEBIT_CARD' },
        wallet_id: 4,
        due_day: null,
        lender_payment: null,
      },
      {
        id: 32,
        description: 'Pago a Banco',
        amount: 800,
        is_paid: true,
        payment_date: new Date('2026-10-01T12:00:00.000Z'),
        created_at: new Date('2026-10-01T12:00:00.000Z'),
        loan_payment_id: null,
        category: { name: 'Préstamos', icon: 'LANDMARK' },
        wallet: { name: 'Débito', type: 'DEBIT_CARD' },
        wallet_id: 4,
        due_day: null,
        lender_payment: { id: 70 },
      },
    ]);

    const rows = await listPlanningTransactions({
      ownerFilter,
      year: '2026',
      month: '09',
      period: 'SECOND',
      type: 'expense',
      excludeCreditInstallment: true,
      resolvedFortnightIds: [1],
    });

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 31,
          planning_row_kind: 'expense',
          loan_payment_id: 22,
          lender_payment_id: null,
        }),
        expect.objectContaining({
          id: 32,
          planning_row_kind: 'expense',
          loan_payment_id: null,
          lender_payment_id: 70,
        }),
      ]),
    );
  });

  it('lists a planned card payment and leaves gaps out of the expense rows', async () => {
    getDuePaymentsForPlannerMonth.mockResolvedValue({
      first: [],
      second: [
        {
          walletId: 8,
          walletName: 'Tarjeta del hogar',
          walletType: 'CREDIT_CARD',
          dueDay: 29,
          cutoff_day: 14,
          nextDuePayment: 2100,
          paymentsAppliedToStatement: 0,
          statementDueDate: '2026-09-29',
          outstandingBalance: 4800,
          remainingPlannerAmount: 2100,
          plannerStatus: 'por_pagar',
          statementPayoff: 2100,
        },
        {
          walletId: 3,
          walletName: 'Tarjeta digital',
          walletType: 'CREDIT_CARD',
          dueDay: 26,
          cutoff_day: 11,
          nextDuePayment: 0,
          paymentsAppliedToStatement: 0,
          statementDueDate: '2026-09-26',
          outstandingBalance: 600,
          remainingPlannerAmount: 0,
          plannerStatus: 'falta_dato',
          statementPayoff: null,
        },
      ],
    });

    const rows = await listPlanningTransactions({
      ownerFilter,
      year: '2026',
      month: '09',
      period: 'SECOND',
      type: 'expense',
      excludeCreditInstallment: true,
      resolvedFortnightIds: [1],
    });

    const cardRows = rows.filter((row) => row.planning_row_kind === 'card_payment');
    expect(cardRows).toEqual([
      expect.objectContaining({
        id: -8,
        description: 'Pago tarjeta: Tarjeta del hogar',
        amount: 2100,
        is_paid: false,
      }),
    ]);
  });
});
