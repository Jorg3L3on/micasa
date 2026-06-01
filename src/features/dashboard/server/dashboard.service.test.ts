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
    expect(data.incomeBreakdown.byPerson).toEqual([]);
    expect(data.upcomingObligations).toEqual([]);
    expect(data.alerts).toEqual([]);
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
