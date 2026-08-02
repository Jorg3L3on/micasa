import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OwnerFilter } from '@/lib/server/get-owner-context';

const mockQueries = vi.hoisted(() => ({
  fetchFortnightsCurrent: vi.fn(),
  fetchAlertExpenses: vi.fn(),
  fetchIncomeCurrent: vi.fn(),
}));

const mockOrphanPay = vi.hoisted(() => vi.fn());
const mockCardDue = vi.hoisted(() => vi.fn());
const mockLoanAgg = vi.hoisted(() => vi.fn());

vi.mock('./alerts.queries', () => mockQueries);
vi.mock('@/lib/finance/planning-credit-card-payments', () => ({
  aggregateOrphanCreditCardPaymentsForPlanning: mockOrphanPay,
  unionPaidAtRangeFromFortnights: vi.fn(() => ({
    from: new Date('2026-06-01T12:00:00.000Z'),
    to: new Date('2026-06-15T12:00:00.000Z'),
  })),
}));
vi.mock('@/lib/finance/credit-card-statement.service', () => ({
  sumPlannerCardDueForPeriodScope: mockCardDue,
}));
vi.mock('@/lib/finance/loan.service', () => ({
  aggregateLoanPaymentsForFortnights: mockLoanAgg,
}));

import { getAlerts } from './alerts.service';

const ownerFilter: OwnerFilter = { user_id: 1, house_id: null };

const fortnightCurrent = {
  id: 10,
  start_date: new Date('2026-06-01T12:00:00.000Z'),
  end_date: new Date('2026-06-15T12:00:00.000Z'),
  month: 6,
  year: 2026,
  period: 'FIRST' as const,
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
  mockQueries.fetchAlertExpenses.mockResolvedValue([]);
  mockQueries.fetchIncomeCurrent.mockResolvedValue([]);
  mockOrphanPay.mockResolvedValue({ total: 0, count: 0 });
  mockCardDue.mockResolvedValue({ total: 0, cardCount: 0 });
  mockLoanAgg.mockResolvedValue(emptyLoanAggregate);
};

beforeEach(() => {
  vi.clearAllMocks();
  setupEmptyPeriod();
});

describe('getAlerts', () => {
  it('returns empty alerts when no fortnights exist', async () => {
    const data = await getAlerts({ ownerFilter, view: 'biweekly' });
    expect(data.alerts).toEqual([]);
    expect(data.period).toMatchObject({
      year: expect.any(Number),
      month: expect.any(Number),
      period: expect.stringMatching(/^(FIRST|SECOND)$/),
    });
  });

  it('emits missing income alert when fortnights exist but income is zero', async () => {
    mockQueries.fetchFortnightsCurrent.mockResolvedValue([fortnightCurrent]);

    const data = await getAlerts({
      ownerFilter,
      view: 'biweekly',
      month: '6',
      year: '2026',
      period: 'FIRST',
    });

    expect(data.alerts.some((a) => a.type === 'missing_income')).toBe(true);
    expect(data.period).toEqual({ year: 2026, month: 6, period: 'FIRST' });
  });

  it('emits high commitment alert when expenses reach 80% of income', async () => {
    mockQueries.fetchFortnightsCurrent.mockResolvedValue([fortnightCurrent]);
    mockQueries.fetchAlertExpenses.mockResolvedValue([
      {
        amount: 800,
        is_paid: false,
        due_day: null,
        fortnight: { month: 6, year: 2026 },
      },
    ]);
    mockQueries.fetchIncomeCurrent.mockResolvedValue([
      { amount: 1000, source: 'job' },
    ]);

    const data = await getAlerts({
      ownerFilter,
      view: 'biweekly',
      month: '6',
      year: '2026',
      period: 'FIRST',
    });

    expect(data.alerts.some((a) => a.type === 'high_commitment')).toBe(true);
  });

  it('overdue alert describes wallet and payroll loan obligations separately', async () => {
    mockQueries.fetchFortnightsCurrent.mockResolvedValue([fortnightCurrent]);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-20T12:00:00.000Z'));
    mockQueries.fetchAlertExpenses.mockResolvedValue([]);
    mockQueries.fetchIncomeCurrent.mockResolvedValue([
      { amount: 5000, source: 'job' },
    ]);
    mockLoanAgg.mockResolvedValue({
      ...emptyLoanAggregate,
      upcoming: [
        {
          id: 1,
          loanId: 10,
          loanName: 'DiDi',
          lender: 'DiDi',
          amount: 200,
          dueDate: '2026-06-10',
          paymentSource: 'WALLET',
          sourceWalletId: 3,
          sourceWalletName: 'BBVA',
        },
        {
          id: 2,
          loanId: 11,
          loanName: 'FONACOT',
          lender: 'Banco',
          amount: 500,
          dueDate: '2026-06-12',
          paymentSource: 'PAYROLL_DEDUCTION',
          sourceWalletId: null,
          sourceWalletName: null,
        },
      ],
    });

    const data = await getAlerts({
      ownerFilter,
      view: 'biweekly',
      month: '6',
      year: '2026',
      period: 'FIRST',
    });

    const overdue = data.alerts.find((a) => a.type === 'overdue');
    expect(overdue?.description).toContain('pago préstamo billetera');
    expect(overdue?.description).toContain('deducción nómina');
    expect(overdue?.target.path).toBe('/monthly/2026/06');
    vi.useRealTimers();
  });
});
