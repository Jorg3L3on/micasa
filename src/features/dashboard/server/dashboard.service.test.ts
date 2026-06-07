import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OwnerFilter } from '@/lib/server/get-owner-context';

const mockQueries = vi.hoisted(() => ({
  fetchFortnightsCurrent: vi.fn(),
  fetchFortnightsPrev: vi.fn(),
  fetchExpensesCurrent: vi.fn(),
  fetchIncomeCurrent: vi.fn(),
  fetchExpensesPrev: vi.fn(),
  fetchIncomePrev: vi.fn(),
  fetchUpcomingExpenses: vi.fn(),
  fetchIncomeWithUser: vi.fn(),
  fetchDashboardWalletSnapshot: vi.fn(),
  fetchRecentExpenses: vi.fn(),
  fetchRecentIncomes: vi.fn(),
  fetchRecentLoanPayments: vi.fn(),
}));

const mockOrphanPay = vi.hoisted(() => vi.fn());
const mockCardDue = vi.hoisted(() => vi.fn());
const mockLoanAgg = vi.hoisted(() => vi.fn());
const mockBudgetPanel = vi.hoisted(() => vi.fn());

vi.mock('./dashboard.queries', () => mockQueries);
vi.mock('./dashboard.performance', () => ({
  measure: async (_label: string, fn: () => Promise<unknown>) => fn(),
}));
vi.mock('@/lib/finance/planning-credit-card-payments', () => ({
  aggregateOrphanCreditCardPaymentsForPlanning: mockOrphanPay,
  unionPaidAtRangeFromFortnights: vi.fn(() => ({
    from: new Date('2026-06-01T12:00:00.000Z'),
    to: new Date('2026-06-15T12:00:00.000Z'),
  })),
}));
vi.mock('@/lib/finance/credit-card-statement.service', () => ({
  sumPlannerCardDueForDashboardScope: mockCardDue,
}));
vi.mock('@/lib/finance/loan.service', () => ({
  aggregateLoanPaymentsForFortnights: mockLoanAgg,
}));
vi.mock('@/lib/finance/monthly-budget-panel.service', () => ({
  getMonthlyBudgetPanel: mockBudgetPanel,
}));

import { getDashboardData } from './dashboard.service';

const ownerFilter: OwnerFilter = { user_id: 1, house_id: null };

const fortnightCurrent = {
  id: 10,
  start_date: new Date('2026-06-01T12:00:00.000Z'),
  end_date: new Date('2026-06-15T12:00:00.000Z'),
  month: 6,
  year: 2026,
  period: 'FIRST' as const,
};

const fortnightPrev = {
  id: 9,
  start_date: new Date('2026-05-16T12:00:00.000Z'),
  end_date: new Date('2026-05-31T12:00:00.000Z'),
};

const emptyLoanAggregate = {
  total: 0,
  paidTotal: 0,
  pendingTotal: 0,
  count: 0,
  pendingCount: 0,
  payments: [],
  upcoming: [],
};

const emptyBudgetScope = {
  totalBudget: 0,
  spent: 0,
  available: 0,
  categories: [],
  sources: [],
};

const emptyBudgetPanel = {
  first: emptyBudgetScope,
  second: emptyBudgetScope,
};

const setupEmptyPeriod = () => {
  mockQueries.fetchFortnightsCurrent.mockResolvedValue([]);
  mockQueries.fetchFortnightsPrev.mockResolvedValue([]);
  mockQueries.fetchExpensesCurrent.mockResolvedValue([]);
  mockQueries.fetchIncomeCurrent.mockResolvedValue([]);
  mockQueries.fetchExpensesPrev.mockResolvedValue([]);
  mockQueries.fetchIncomePrev.mockResolvedValue([]);
  mockQueries.fetchUpcomingExpenses.mockResolvedValue([]);
  mockQueries.fetchIncomeWithUser.mockResolvedValue([]);
  mockQueries.fetchDashboardWalletSnapshot.mockResolvedValue([]);
  mockQueries.fetchRecentExpenses.mockResolvedValue([]);
  mockQueries.fetchRecentIncomes.mockResolvedValue([]);
  mockQueries.fetchRecentLoanPayments.mockResolvedValue([]);
  mockOrphanPay.mockResolvedValue({ total: 0, count: 0 });
  mockCardDue.mockResolvedValue({ total: 0, cardCount: 0 });
  mockLoanAgg.mockResolvedValue(emptyLoanAggregate);
  mockBudgetPanel.mockResolvedValue(emptyBudgetPanel);
};

const setupWithCurrentFortnight = () => {
  mockQueries.fetchFortnightsCurrent.mockResolvedValue([fortnightCurrent]);
  mockQueries.fetchFortnightsPrev.mockResolvedValue([fortnightPrev]);
};

beforeEach(() => {
  vi.clearAllMocks();
  setupEmptyPeriod();
});

describe('getDashboardData', () => {
  it('returns zero totals when no fortnights exist', async () => {
    const data = await getDashboardData({ ownerFilter, view: 'biweekly' });

    expect(data.summary).toEqual({
      totalIncome: 0,
      totalExpense: 0,
      balance: 0,
      totalPaid: 0,
      totalUnpaid: 0,
    });
    expect(data.fundingWalletBreakdown).toEqual([]);
    expect(data.incomeBreakdown.byPerson).toEqual([]);
    expect(data.upcomingObligations).toEqual([]);
    expect(data.alerts).toEqual([]);
    expect(data.budgetSummary).toEqual({
      totalBudget: 0,
      spent: 0,
      available: 0,
      usedPercent: 0,
      categories: [],
      sources: [],
    });
  });

  it('returns selected fortnight budget summary for biweekly view', async () => {
    setupWithCurrentFortnight();
    mockBudgetPanel.mockResolvedValue({
      first: {
        totalBudget: 1000,
        spent: 200,
        available: 800,
        categories: [],
        sources: [{ frequency: 'WEEKLY', totalBudget: 1000 }],
      },
      second: {
        totalBudget: 2000,
        spent: 500,
        available: 1500,
        categories: [
          {
            id: 1,
            name: 'Comida',
            icon: null,
            spent: 500,
            percentOfBudget: 25,
          },
        ],
        sources: [{ frequency: 'BIWEEKLY', totalBudget: 2000 }],
      },
    });

    const data = await getDashboardData({
      ownerFilter,
      view: 'biweekly',
      month: '6',
      year: '2026',
      period: 'SECOND',
    });

    expect(data.budgetSummary).toEqual({
      totalBudget: 2000,
      spent: 500,
      available: 1500,
      usedPercent: 25,
      categories: [
        {
          id: 1,
          name: 'Comida',
          icon: null,
          spent: 500,
          percentOfBudget: 25,
        },
      ],
      sources: [{ frequency: 'BIWEEKLY', totalBudget: 2000 }],
    });
  });

  it('combines both budget fortnights for month view', async () => {
    setupWithCurrentFortnight();
    mockBudgetPanel.mockResolvedValue({
      first: {
        totalBudget: 1000,
        spent: 250,
        available: 750,
        categories: [
          {
            id: 1,
            name: 'Comida',
            icon: null,
            spent: 250,
            percentOfBudget: 25,
          },
        ],
        sources: [{ frequency: 'WEEKLY', totalBudget: 1000 }],
      },
      second: {
        totalBudget: 2000,
        spent: 750,
        available: 1250,
        categories: [
          {
            id: 1,
            name: 'Comida',
            icon: null,
            spent: 500,
            percentOfBudget: 25,
          },
          {
            id: 2,
            name: 'Casa',
            icon: 'HOME',
            spent: 250,
            percentOfBudget: 13,
          },
        ],
        sources: [{ frequency: 'WEEKLY', totalBudget: 2000 }],
      },
    });

    const data = await getDashboardData({
      ownerFilter,
      view: 'month',
      month: '6',
      year: '2026',
    });

    expect(data.budgetSummary.totalBudget).toBe(3000);
    expect(data.budgetSummary.spent).toBe(1000);
    expect(data.budgetSummary.available).toBe(2000);
    expect(data.budgetSummary.usedPercent).toBe(33);
    expect(data.budgetSummary.categories).toEqual([
      {
        id: 1,
        name: 'Comida',
        icon: null,
        spent: 750,
        percentOfBudget: 25,
      },
      {
        id: 2,
        name: 'Casa',
        icon: 'HOME',
        spent: 250,
        percentOfBudget: 8,
      },
    ]);
  });

  it('uses income override amount when __OVERRIDE__ row exists', async () => {
    setupWithCurrentFortnight();
    mockQueries.fetchIncomeCurrent.mockResolvedValue([
      { amount: 5000, source: '__OVERRIDE__', user: null },
      { amount: 1000, source: 'job', user: { id: 1, name: 'Ana' } },
    ]);
    mockQueries.fetchIncomeWithUser.mockResolvedValue([
      { amount: 5000, source: '__OVERRIDE__', user: { id: 1, name: 'Ana' } },
      { amount: 1000, source: 'job', user: { id: 1, name: 'Ana' } },
    ]);

    const data = await getDashboardData({
      ownerFilter,
      view: 'biweekly',
      month: '6',
      year: '2026',
      period: 'FIRST',
    });

    expect(data.summary.totalIncome).toBe(5000);
  });

  it('merges orphan card payments into period expense totals', async () => {
    setupWithCurrentFortnight();
    mockQueries.fetchIncomeCurrent.mockResolvedValue([
      { amount: 2000, source: 'job', user: null },
    ]);
    mockOrphanPay.mockResolvedValue({ total: 150, count: 1 });

    const data = await getDashboardData({
      ownerFilter,
      view: 'biweekly',
      month: '6',
      year: '2026',
      period: 'FIRST',
    });

    expect(data.summary.totalExpense).toBe(150);
    expect(data.planningCardPayments).toEqual({ total: 150, count: 1 });
  });

  it('returns efectivo/debit wallet breakdown minus pending expenses', async () => {
    setupWithCurrentFortnight();
    mockQueries.fetchExpensesCurrent.mockResolvedValue([
      {
        amount: 300,
        is_paid: false,
        description: 'Rent',
        category: { name: 'Casa', icon: null },
        expense_template: null,
      },
    ]);
    mockQueries.fetchDashboardWalletSnapshot.mockResolvedValue([
      {
        id: 2,
        name: 'Banamex',
        type: 'DEBIT_CARD',
        amount: 100,
        credit_limit: null,
        temporary_credit_limit: null,
      },
      {
        id: 1,
        name: 'Efectivo',
        type: 'CASH',
        amount: 500,
        credit_limit: null,
        temporary_credit_limit: null,
      },
      {
        id: 3,
        name: 'Tarjeta',
        type: 'CREDIT_CARD',
        amount: 200,
        credit_limit: 1000,
        temporary_credit_limit: null,
      },
    ]);

    const data = await getDashboardData({
      ownerFilter,
      view: 'biweekly',
      month: '6',
      year: '2026',
      period: 'FIRST',
    });

    expect(data.fundingWalletBalanceTotal).toBe(600);
    expect(data.summary.totalUnpaid).toBe(300);
    expect(data.fundingNetVsPendingExpense).toBe(300);
    expect(data.fundingWalletBreakdown).toEqual([
      { id: 1, name: 'Efectivo', type: 'CASH', amount: 500 },
      { id: 2, name: 'Banamex', type: 'DEBIT_CARD', amount: 100 },
    ]);
  });

  it('includes loan payment totals in period expenses and loan summary data', async () => {
    setupWithCurrentFortnight();
    mockQueries.fetchIncomeCurrent.mockResolvedValue([
      { amount: 2000, source: 'job', user: null },
    ]);
    mockLoanAgg
      .mockResolvedValueOnce({
        ...emptyLoanAggregate,
        total: 300,
        paidTotal: 100,
        pendingTotal: 200,
        count: 2,
        pendingCount: 1,
        payments: [
          {
            id: 1,
            loanId: 5,
            loanName: 'Auto',
            lender: 'Banco',
            amount: 100,
            dueDate: '2026-06-05',
            paidAt: '2026-06-05',
            status: 'PAID',
            paymentSource: 'WALLET',
            sourceWalletId: 2,
            sourceWalletName: 'BBVA',
            linkedExpenseId: null,
          },
          {
            id: 2,
            loanId: 5,
            loanName: 'Auto',
            lender: 'Banco',
            amount: 200,
            dueDate: '2026-06-12',
            paidAt: null,
            status: 'SCHEDULED',
            paymentSource: 'WALLET',
            sourceWalletId: 2,
            sourceWalletName: 'BBVA',
            linkedExpenseId: null,
          },
        ],
      })
      .mockResolvedValueOnce(emptyLoanAggregate);

    const data = await getDashboardData({
      ownerFilter,
      view: 'biweekly',
      month: '6',
      year: '2026',
      period: 'FIRST',
    });

    expect(data.summary.totalExpense).toBe(300);
    expect(data.summary.totalPaid).toBe(100);
    expect(data.summary.totalUnpaid).toBe(200);
    expect(data.planningLoanPayments).toEqual({
      total: 300,
      paidTotal: 100,
      pendingTotal: 200,
      count: 2,
      pendingCount: 1,
    });
  });

  it('treats payroll loan installments as income deductions instead of wallet expenses', async () => {
    setupWithCurrentFortnight();
    mockQueries.fetchIncomeCurrent.mockResolvedValue([
      { amount: 5000, source: 'job', user: null },
    ]);
    mockQueries.fetchExpensesCurrent.mockResolvedValue([]);
    mockLoanAgg
      .mockResolvedValueOnce({
        ...emptyLoanAggregate,
        total: 2792.73,
        pendingTotal: 2792.73,
        count: 1,
        pendingCount: 1,
        payments: [
          {
            id: 9,
            loanId: 8,
            loanName: 'FONACOT',
            lender: 'Banco',
            amount: 2792.73,
            dueDate: '2026-06-15',
            paidAt: null,
            status: 'SCHEDULED',
            paymentSource: 'PAYROLL_DEDUCTION',
            sourceWalletId: null,
            sourceWalletName: null,
            linkedExpenseId: null,
          },
        ],
        upcoming: [
          {
            id: 9,
            loanId: 8,
            loanName: 'FONACOT',
            lender: 'Banco',
            amount: 2792.73,
            dueDate: '2026-06-15',
            paidAt: null,
            status: 'SCHEDULED',
            paymentSource: 'PAYROLL_DEDUCTION',
            sourceWalletId: null,
            sourceWalletName: null,
            linkedExpenseId: null,
          },
        ],
      })
      .mockResolvedValueOnce(emptyLoanAggregate);

    const data = await getDashboardData({
      ownerFilter,
      view: 'biweekly',
      month: '6',
      year: '2026',
      period: 'FIRST',
    });

    expect(data.summary.totalExpense).toBe(0);
    expect(data.summary.balance).toBe(2207.27);
    expect(data.planningPayrollLoanDeduction).toEqual({
      total: 2792.73,
      count: 1,
    });
  });

  it('subtracts payroll loan deductions from funding net vs pending', async () => {
    setupWithCurrentFortnight();
    mockQueries.fetchIncomeCurrent.mockResolvedValue([
      { amount: 5000, source: 'job', user: null },
    ]);
    mockQueries.fetchExpensesCurrent.mockResolvedValue([]);
    mockQueries.fetchDashboardWalletSnapshot.mockResolvedValue([
      { id: 1, name: 'BBVA', type: 'DEBIT_CARD', amount: 8000 },
    ]);
    mockLoanAgg
      .mockResolvedValueOnce({
        ...emptyLoanAggregate,
        payments: [
          {
            id: 9,
            loanId: 8,
            loanName: 'FONACOT',
            lender: 'Banco',
            amount: 2792.73,
            dueDate: '2026-06-15',
            paidAt: null,
            status: 'SCHEDULED',
            paymentSource: 'PAYROLL_DEDUCTION',
            sourceWalletId: null,
            sourceWalletName: null,
            linkedExpenseId: null,
          },
        ],
      })
      .mockResolvedValueOnce(emptyLoanAggregate);

    const data = await getDashboardData({
      ownerFilter,
      view: 'biweekly',
      month: '6',
      year: '2026',
      period: 'FIRST',
    });

    expect(data.fundingNetVsPendingExpense).toBe(5207.27);
  });

  it('limits upcoming obligations to five sorted by due date', async () => {
    setupWithCurrentFortnight();
    const makeExpense = (id: number, dueDay: number) => ({
      id,
      description: `Gasto ${id}`,
      amount: 100,
      is_paid: false,
      due_day: dueDay,
      fortnight: { month: 6, year: 2026, start_date: new Date(), end_date: new Date() },
      category: { name: 'Cat', icon: null },
    });
    mockQueries.fetchUpcomingExpenses.mockResolvedValue(
      [1, 2, 3, 4, 5, 6].map((id) => makeExpense(id, id)),
    );
    mockLoanAgg.mockResolvedValue({
      ...emptyLoanAggregate,
      upcoming: [
        {
          id: 99,
          loanName: 'Auto',
          lender: 'Banco',
          amount: 50,
          dueDate: '2026-06-03',
          paymentSource: 'WALLET',
          sourceWalletId: null,
        },
      ],
    });

    const data = await getDashboardData({
      ownerFilter,
      view: 'biweekly',
      month: '6',
      year: '2026',
      period: 'FIRST',
    });

    expect(data.upcomingObligations).toHaveLength(5);
    const dueDates = data.upcomingObligations.map((o) => o.dueDate);
    expect([...dueDates].sort()).toEqual(dueDates);
    expect(data.upcomingObligations.some((o) => o.source === 'loan_payment')).toBe(
      true,
    );
  });

  it('emits high commitment alert when expenses reach 80% of income', async () => {
    setupWithCurrentFortnight();
    mockQueries.fetchExpensesCurrent.mockResolvedValue([
      {
        amount: 800,
        is_paid: false,
        description: 'Rent',
        category: { name: 'Casa', icon: null },
        expense_template: null,
      },
    ]);
    mockQueries.fetchIncomeCurrent.mockResolvedValue([
      { amount: 1000, source: 'job', user: null },
    ]);

    const data = await getDashboardData({
      ownerFilter,
      view: 'biweekly',
      month: '6',
      year: '2026',
      period: 'FIRST',
    });

    expect(data.alerts.some((a) => a.type === 'high_commitment')).toBe(true);
  });

  it('emits missing income alert when fortnights exist but income is zero', async () => {
    setupWithCurrentFortnight();

    const data = await getDashboardData({
      ownerFilter,
      view: 'biweekly',
      month: '6',
      year: '2026',
      period: 'FIRST',
    });

    expect(data.alerts.some((a) => a.type === 'missing_income')).toBe(true);
  });
});
