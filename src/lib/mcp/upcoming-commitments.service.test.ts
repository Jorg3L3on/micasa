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
