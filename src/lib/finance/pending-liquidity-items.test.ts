import { describe, expect, it } from 'vitest';
import { getPendingLiquidityLineItems } from '@/lib/finance/pending-liquidity-items';
import type { DuePaymentItem, TransactionRow } from '@/types/catalog';
import type { LoanDuePaymentItem } from '@/types/loans';

const expense = (
  overrides: Partial<TransactionRow> &
    Pick<TransactionRow, 'id' | 'description' | 'amount'>,
): TransactionRow => ({
  date: '2026-09-25',
  category: 'Transporte',
  paymentMethod: 'Santander',
  type: 'expense',
  is_paid: false,
  due_day: null,
  ...overrides,
});

const card = (
  overrides: Partial<DuePaymentItem> & Pick<DuePaymentItem, 'walletId' | 'walletName'>,
): DuePaymentItem => ({
  walletType: 'CREDIT_CARD',
  dueDay: 16,
  cutoff_day: 10,
  nextDuePayment: 0,
  paymentsAppliedToStatement: 0,
  statementDueDate: '2026-09-16',
  outstandingBalance: 1000,
  remainingPlannerAmount: 0,
  plannerStatus: 'por_pagar',
  statementPayoff: 0,
  ...overrides,
});

const loan = (
  overrides: Partial<LoanDuePaymentItem> &
    Pick<LoanDuePaymentItem, 'id' | 'loanName' | 'amount'>,
): LoanDuePaymentItem => ({
  loanId: 1,
  sequence: 1,
  dueDate: '2026-09-20',
  status: 'SCHEDULED',
  paidAt: null,
  sourceWalletId: 1,
  sourceWalletName: 'Banamex',
  linkedExpenseId: null,
  lenderPaymentId: null,
  note: null,
  lender: 'Banco',
  lenderId: 1,
  loanType: 'PERSONAL',
  paymentSource: 'WALLET',
  linkedWalletId: 1,
  linkedWalletName: 'Banamex',
  incomeTemplateName: null,
  ...overrides,
});

describe('getPendingLiquidityLineItems', () => {
  it('lists unpaid cash gastos and skips paid or card-charge rows', () => {
    expect(
      getPendingLiquidityLineItems({
        transactions: [
          expense({ id: 1, description: 'Transporte Carmen', amount: 400 }),
          expense({
            id: 2,
            description: 'Renta',
            amount: 8950,
            is_paid: true,
          }),
          expense({
            id: 3,
            description: 'TELMEX',
            amount: 658,
            wallet_type: 'CREDIT_CARD',
          }),
        ],
      }),
    ).toEqual([
      { id: 'expense-1', name: 'Transporte Carmen', amount: 400 },
    ]);
  });

  it('adds pending card cortes and wallet loan cuotas by name', () => {
    expect(
      getPendingLiquidityLineItems({
        transactions: [],
        cardDueItems: [
          card({
            walletId: 9,
            walletName: 'DIDI Card',
            remainingPlannerAmount: 104.3,
            statementPayoff: 104.3,
          }),
        ],
        loanDueItems: [
          loan({
            id: 4,
            loanName: 'Auto',
            amount: 1200,
          }),
          loan({
            id: 5,
            loanName: 'Nómina',
            amount: 300,
            paymentSource: 'PAYROLL_DEDUCTION',
          }),
        ],
      }),
    ).toEqual([
      { id: 'card-9', name: 'Pago tarjeta: DIDI Card', amount: 104.3 },
      {
        id: 'loan-4',
        name: 'Pago préstamo: Auto (Banco)',
        amount: 1200,
      },
    ]);
  });
});
