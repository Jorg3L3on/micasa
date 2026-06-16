import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  findManyExpense,
  findManyFortnight,
  findManyIncome,
  listLoanPaymentsForPlannerMonth,
} = vi.hoisted(() => ({
  findManyExpense: vi.fn(),
  findManyFortnight: vi.fn(),
  findManyIncome: vi.fn(),
  listLoanPaymentsForPlannerMonth: vi.fn(),
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
    listLoanPaymentsForPlannerMonth.mockResolvedValue({
      first: [
        {
          id: 22,
          loanId: 4,
          sequence: 1,
          dueDate: '2026-07-15',
          amount: 2792.73,
          status: 'SCHEDULED',
          paidAt: null,
          sourceWalletId: null,
          sourceWalletName: null,
          linkedExpenseId: null,
          note: null,
          loanName: 'FONACOT Jorge',
          lender: 'Banco',
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

  it('keeps planner loan payments out of the gastos transaction list', async () => {
    const rows = await listPlanningTransactions({
      ownerFilter,
      year: '2026',
      month: '07',
      period: 'FIRST',
      type: 'expense',
      excludeCreditInstallment: true,
      resolvedFortnightIds: [1],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      description: 'Super',
      planning_row_kind: 'expense',
    });
    expect(
      rows.some((row) => row.planning_row_kind === 'loan_payment'),
    ).toBe(false);
    expect(findManyExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              user_id: 1,
              house_id: null,
              fortnight_id: { in: [1] },
              loan_payment_id: null,
            }),
          ]),
        }),
      }),
    );
  });
});
