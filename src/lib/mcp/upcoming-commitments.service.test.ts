import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getDuePaymentsForPlannerMonth,
  listInstallmentPlanPaymentsForPlannerMonth,
  listLoanPaymentsForPlannerMonth,
  getLiquidityProjection,
} = vi.hoisted(() => ({
  getDuePaymentsForPlannerMonth: vi.fn(),
  listInstallmentPlanPaymentsForPlannerMonth: vi.fn(),
  listLoanPaymentsForPlannerMonth: vi.fn(),
  getLiquidityProjection: vi.fn(),
}));

vi.mock('@/lib/finance/credit-card-statement.service', () => ({
  getDuePaymentsForPlannerMonth,
}));

vi.mock('@/lib/finance/credit-card-installment-plan.service', () => ({
  listInstallmentPlanPaymentsForPlannerMonth,
}));

vi.mock('@/lib/finance/loan.service', () => ({
  listLoanPaymentsForPlannerMonth,
}));

vi.mock('@/lib/finance/liquidity-projection.service', () => ({
  getLiquidityProjection,
  defaultLiquidityUntilFromAsOf: vi.fn(() => new Date('2026-12-31T12:00:00.000Z')),
}));

vi.mock('@/lib/calendar-dates', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/calendar-dates')>();
  return {
    ...actual,
    todayCalendarDate: vi.fn(() => '2026-08-10'),
  };
});

import {
  listUpcomingCommitments,
  listUpcomingCommitmentsForMonth,
} from '@/lib/mcp/upcoming-commitments.service';

const ownerFilter = { user_id: 1, house_id: null };

beforeEach(() => {
  vi.clearAllMocks();
  listLoanPaymentsForPlannerMonth.mockResolvedValue({ first: [], second: [] });
  listInstallmentPlanPaymentsForPlannerMonth.mockResolvedValue([]);
  getLiquidityProjection.mockResolvedValue({ milestones: [] });
});

describe('listUpcomingCommitmentsForMonth', () => {
  it('splits full statement due into MSI cuota + leftover revolving without double-counting', async () => {
    getDuePaymentsForPlannerMonth.mockResolvedValue({
      first: [],
      second: [
        {
          walletId: 10,
          walletName: 'Tarjeta A',
          walletType: 'CREDIT_CARD',
          nextDuePayment: 1500,
          effectiveAmount: 1500,
          remainingPlannerAmount: 1500,
          plannerStatus: 'por_pagar',
          visibleDueDate: '2026-06-20',
          statementDueDate: '2026-06-20',
          obligationAmountSource: 'ledger',
          plannedPayment: null,
          paymentsAppliedToStatement: 0,
        },
      ],
    });
    listInstallmentPlanPaymentsForPlannerMonth.mockResolvedValue([
      {
        id: 501,
        planId: 50,
        planName: 'Electrónicos MSI',
        walletId: 10,
        walletName: 'Tarjeta A',
        dueDate: '2026-06-20',
        amount: 500,
        sequence: 2,
        status: 'SCHEDULED',
      },
    ]);

    const result = await listUpcomingCommitmentsForMonth(ownerFilter, 2026, 6);

    expect(result.items).toHaveLength(2);
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'msi',
          amount: 500,
          date: '2026-06-20',
        }),
        expect.objectContaining({
          type: 'revolving',
          amount: 1000,
          date: '2026-06-20',
        }),
      ]),
    );
    expect(result.period_total).toBe(1500);
  });

  it('includes leftover revolving scheduled payment AND MSI cuota on the same due date', async () => {
    getDuePaymentsForPlannerMonth.mockResolvedValue({
      first: [],
      second: [
        {
          walletId: 20,
          walletName: 'Tarjeta departamental',
          walletType: 'DEPARTMENT_STORE_CARD',
          nextDuePayment: 180,
          effectiveAmount: 180,
          remainingPlannerAmount: 180,
          plannerStatus: 'por_pagar',
          visibleDueDate: '2026-09-05',
          statementDueDate: '2026-09-05',
          obligationAmountSource: 'scheduled_calendar',
          plannedPayment: null,
          paymentsAppliedToStatement: 0,
        },
      ],
    });
    listInstallmentPlanPaymentsForPlannerMonth.mockResolvedValue([
      {
        id: 701,
        planId: 70,
        planName: 'Muebles MSI',
        walletId: 20,
        walletName: 'Tarjeta departamental',
        dueDate: '2026-09-05',
        amount: 650,
        sequence: 4,
        status: 'SCHEDULED',
      },
    ]);

    const result = await listUpcomingCommitmentsForMonth(ownerFilter, 2026, 9);

    expect(result.items).toHaveLength(2);
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'msi',
          amount: 650,
          date: '2026-09-05',
        }),
        expect.objectContaining({
          type: 'revolving',
          amount: 180,
          date: '2026-09-05',
        }),
      ]),
    );
    expect(result.period_total).toBe(830);
  });

  it('includes MSI plan cuota in a future month when card due does not cover that date', async () => {
    getDuePaymentsForPlannerMonth.mockResolvedValue({
      first: [],
      second: [],
    });
    listInstallmentPlanPaymentsForPlannerMonth.mockResolvedValue([
      {
        id: 601,
        planId: 60,
        planName: 'Laptop MSI',
        walletId: 11,
        walletName: 'Tarjeta B',
        dueDate: '2026-10-17',
        amount: 300,
        sequence: 3,
        status: 'SCHEDULED',
      },
    ]);

    const result = await listUpcomingCommitmentsForMonth(ownerFilter, 2026, 10);

    expect(result.items).toEqual([
      expect.objectContaining({
        type: 'msi',
        amount: 300,
        date: '2026-10-17',
        name: 'Laptop MSI',
      }),
    ]);
    expect(result.period_total).toBe(300);
  });

  it('sums loans with card and MSI lines without double-counting', async () => {
    getDuePaymentsForPlannerMonth.mockResolvedValue({
      first: [
        {
          walletId: 12,
          walletName: 'Tarjeta C',
          walletType: 'CREDIT_CARD',
          nextDuePayment: 400,
          effectiveAmount: 400,
          remainingPlannerAmount: 400,
          plannerStatus: 'por_pagar',
          visibleDueDate: '2026-07-05',
          statementDueDate: '2026-07-05',
          obligationAmountSource: 'ledger',
          plannedPayment: null,
          paymentsAppliedToStatement: 0,
        },
      ],
      second: [],
    });
    listLoanPaymentsForPlannerMonth.mockResolvedValue({
      first: [
        {
          id: 900,
          loanName: 'Préstamo auto',
          lender: 'Banco',
          amount: 2500,
          dueDate: '2026-07-10',
          status: 'SCHEDULED',
        },
      ],
      second: [],
    });

    const result = await listUpcomingCommitmentsForMonth(ownerFilter, 2026, 7);

    expect(result.items).toHaveLength(2);
    expect(result.period_total).toBe(2900);
  });
});

describe('listUpcomingCommitments', () => {
  it('filters by period FIRST within a month', async () => {
    getDuePaymentsForPlannerMonth.mockResolvedValue({
      first: [
        {
          walletId: 12,
          walletName: 'Tarjeta C',
          walletType: 'CREDIT_CARD',
          nextDuePayment: 400,
          effectiveAmount: 400,
          remainingPlannerAmount: 400,
          plannerStatus: 'por_pagar',
          visibleDueDate: '2026-07-05',
          statementDueDate: '2026-07-05',
          obligationAmountSource: 'ledger',
          plannedPayment: null,
          paymentsAppliedToStatement: 0,
        },
      ],
      second: [
        {
          walletId: 13,
          walletName: 'Tarjeta D',
          walletType: 'CREDIT_CARD',
          nextDuePayment: 900,
          effectiveAmount: 900,
          remainingPlannerAmount: 900,
          plannerStatus: 'por_pagar',
          visibleDueDate: '2026-07-20',
          statementDueDate: '2026-07-20',
          obligationAmountSource: 'ledger',
          plannedPayment: null,
          paymentsAppliedToStatement: 0,
        },
      ],
    });

    const result = await listUpcomingCommitments({
      ownerFilter,
      year: 2026,
      month: 7,
      period: 'FIRST',
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      type: 'revolving',
      date: '2026-07-05',
      amount: 400,
    });
    expect(result.period).toBe('FIRST');
  });

  it('adds projected revolving from liquidity when planner has no row', async () => {
    getDuePaymentsForPlannerMonth.mockResolvedValue({ first: [], second: [] });
    getLiquidityProjection.mockResolvedValue({
      milestones: [
        {
          due_date: '2026-11-15',
          obligations: [
            {
              source: 'credit_card_statement',
              wallet_id: 30,
              wallet_name: 'Tarjeta E',
              next_due_payment: 1200,
            },
          ],
        },
      ],
    });

    const result = await listUpcomingCommitments({
      ownerFilter,
      from: '2026-11-01',
      to: '2026-11-30',
    });

    expect(getLiquidityProjection).toHaveBeenCalled();
    expect(result.items).toEqual([
      expect.objectContaining({
        type: 'revolving',
        amount: 1200,
        date: '2026-11-15',
        wallet_or_loan: 'Tarjeta E',
      }),
    ]);
  });

  it('does not re-add paid or zero-leftover revolving from projection in the planner window month', async () => {
    getDuePaymentsForPlannerMonth.mockResolvedValue({
      first: [],
      second: [
        {
          walletId: 40,
          walletName: 'Tarjeta F',
          walletType: 'CREDIT_CARD',
          nextDuePayment: 0,
          effectiveAmount: 0,
          remainingPlannerAmount: 0,
          plannerStatus: 'pagado',
          visibleDueDate: '2026-08-20',
          statementDueDate: '2026-08-20',
          obligationAmountSource: 'ledger',
          plannedPayment: null,
          paymentsAppliedToStatement: 0,
        },
      ],
    });
    getLiquidityProjection.mockResolvedValue({
      milestones: [
        {
          due_date: '2026-08-20',
          obligations: [
            {
              source: 'credit_card_statement',
              wallet_id: 40,
              wallet_name: 'Tarjeta F',
              next_due_payment: 950,
            },
          ],
        },
      ],
    });

    const result = await listUpcomingCommitments({
      ownerFilter,
      year: 2026,
      month: 8,
    });

    expect(result.items.filter((item) => item.type === 'revolving')).toEqual([]);
    expect(result.period_total).toBe(0);
  });

  it('does not double-count issued planner revolving when projection returns the same card', async () => {
    getDuePaymentsForPlannerMonth.mockResolvedValue({
      first: [],
      second: [
        {
          walletId: 41,
          walletName: 'Tarjeta G',
          walletType: 'CREDIT_CARD',
          nextDuePayment: 400,
          effectiveAmount: 400,
          remainingPlannerAmount: 400,
          plannerStatus: 'por_pagar',
          visibleDueDate: '2026-08-18',
          statementDueDate: '2026-08-18',
          obligationAmountSource: 'ledger',
          plannedPayment: null,
          paymentsAppliedToStatement: 0,
        },
      ],
    });
    getLiquidityProjection.mockResolvedValue({
      milestones: [
        {
          due_date: '2026-08-18',
          obligations: [
            {
              source: 'credit_card_statement',
              wallet_id: 41,
              wallet_name: 'Tarjeta G',
              next_due_payment: 1200,
            },
          ],
        },
      ],
    });

    const result = await listUpcomingCommitments({
      ownerFilter,
      year: 2026,
      month: 8,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      type: 'revolving',
      amount: 400,
      date: '2026-08-18',
    });
    expect(result.period_total).toBe(400);
  });
});
