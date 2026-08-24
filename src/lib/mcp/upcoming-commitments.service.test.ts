import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getDuePaymentsForPlannerMonth,
  listInstallmentPlanPaymentsForPlannerMonth,
  listLoanPaymentsForPlannerMonth,
} = vi.hoisted(() => ({
  getDuePaymentsForPlannerMonth: vi.fn(),
  listInstallmentPlanPaymentsForPlannerMonth: vi.fn(),
  listLoanPaymentsForPlannerMonth: vi.fn(),
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

import { listUpcomingCommitmentsForMonth } from '@/lib/mcp/upcoming-commitments.service';

const ownerFilter = { user_id: 1, house_id: null };

beforeEach(() => {
  vi.clearAllMocks();
  listLoanPaymentsForPlannerMonth.mockResolvedValue({ first: [], second: [] });
  listInstallmentPlanPaymentsForPlannerMonth.mockResolvedValue([]);
});

describe('listUpcomingCommitmentsForMonth', () => {
  it('dedupes revolving statement due — one card line, not statement + MSI stacked', async () => {
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

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      type: 'revolving',
      amount: 1500,
      date: '2026-06-20',
      wallet_or_loan: 'Tarjeta A',
    });
    expect(result.period_total).toBe(1500);
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
        dueDate: '2026-08-17',
        amount: 300,
        sequence: 3,
        status: 'SCHEDULED',
      },
    ]);

    const result = await listUpcomingCommitmentsForMonth(ownerFilter, 2026, 8);

    expect(result.items).toEqual([
      expect.objectContaining({
        type: 'msi',
        amount: 300,
        date: '2026-08-17',
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
