import { describe, expect, it } from 'vitest';
import { mapLenderForMcpList } from '@/lib/mcp/tools/loans';
import type { LenderListItem } from '@/types/lenders';
import type { LoanListItem, LoanPaymentListItem } from '@/types/loans';

const payment = (
  id: number,
  dueDate: string,
  amount: number,
): LoanPaymentListItem => ({
  id,
  loanId: 1,
  sequence: id,
  dueDate,
  amount,
  status: 'SCHEDULED',
  paidAt: null,
  sourceWalletId: null,
  sourceWalletName: null,
  linkedExpenseId: null,
  lenderPaymentId: null,
  note: null,
});

const loan = (
  overrides: Partial<LoanListItem> & Pick<LoanListItem, 'id' | 'status'>,
): LoanListItem => ({
  name: 'Prestamo A',
  lender: 'Prestamista A',
  lenderId: 1,
  type: 'PERSONAL',
  principalAmount: 1000,
  totalPayable: 1000,
  paymentAmount: 500,
  paymentCount: 2,
  frequency: 'MONTHLY',
  startDate: '2026-08-01',
  paymentSource: 'WALLET',
  sourceWalletId: null,
  sourceWalletName: null,
  linkedWalletId: null,
  linkedWalletName: null,
  incomeTemplateId: null,
  incomeTemplateName: null,
  notes: null,
  paidAmount: 0,
  remainingAmount: 1000,
  paidPayments: 0,
  remainingPayments: 2,
  overduePayment: null,
  nextPayment: null,
  ...overrides,
});

const lender = (loans: LoanListItem[]): LenderListItem => ({
  id: 1,
  name: 'Prestamista A',
  providerIconKey: null,
  notes: null,
  active: true,
  remainingPrincipal: 1000,
  activeContractCount: loans.filter((row) => row.status === 'ACTIVE').length,
  payrollOnly: false,
  payWindow: {
    amount: 800,
    commitmentDate: '2026-08-01',
    commitmentDateEnd: '2026-08-01',
    isRange: false,
    canPay: true,
    included: [],
  },
  loans,
});

describe('mapLenderForMcpList', () => {
  it('keeps nextPaymentAmount as the pay window and ignores paused loans', () => {
    const row = mapLenderForMcpList(
      lender([
        loan({
          id: 1,
          status: 'ACTIVE',
          overduePayment: payment(1, '2026-07-01', 100),
          nextPayment: payment(2, '2026-10-01', 500),
        }),
        loan({
          id: 2,
          status: 'PAUSED',
          overduePayment: payment(3, '2026-06-01', 900),
          nextPayment: payment(4, '2026-09-01', 700),
        }),
      ]),
    );

    expect(row.nextPaymentAmount).toBe(800);
    expect(row.nextPaymentDate).toBe('2026-08-01');
    expect(row.nextPaymentDateEnd).toBe('2026-08-01');
    expect(row.canPayAmount).toBe(800);
    expect(row.overduePaymentAmount).toBe(100);
    expect(row.overduePaymentDate).toBe('2026-07-01');
    expect(row.upcomingPaymentAmount).toBe(500);
    expect(row.upcomingPaymentDate).toBe('2026-10-01');
  });
});
