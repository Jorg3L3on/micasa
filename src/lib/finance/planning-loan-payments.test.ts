import { describe, expect, it } from 'vitest';
import {
  formatLoanPaymentDescription,
  formatLoanPaymentLabel,
  linkedLoanPaymentExpenseIds,
  mapLoanDuePaymentToTransactionRow,
} from '@/lib/finance/planning-loan-payments';
import type { LoanDuePaymentItem } from '@/types/loans';

const basePayment = (
  overrides: Partial<LoanDuePaymentItem> = {},
): LoanDuePaymentItem => ({
  id: 12,
  loanId: 3,
  sequence: 4,
  dueDate: '2026-06-15',
  amount: 1500,
  status: 'SCHEDULED',
  paidAt: null,
  sourceWalletId: 2,
  sourceWalletName: 'Débito BBVA',
  linkedExpenseId: null,
  note: null,
  loanName: 'FONACOT',
  lender: 'FONACOT',
  loanType: 'PAYROLL',
  paymentSource: 'WALLET',
  linkedWalletId: null,
  linkedWalletName: null,
  incomeTemplateName: null,
  ...overrides,
});

describe('formatLoanPaymentDescription', () => {
  it('formats wallet loan payments', () => {
    expect(formatLoanPaymentDescription(basePayment())).toBe(
      'Pago préstamo: FONACOT (FONACOT)',
    );
  });

  it('formats payroll deduction payments', () => {
    expect(
      formatLoanPaymentDescription(
        basePayment({ paymentSource: 'PAYROLL_DEDUCTION' }),
      ),
    ).toBe('Deducción nómina: FONACOT (FONACOT)');
  });
});

describe('formatLoanPaymentLabel', () => {
  it('matches description helper for wallet and payroll', () => {
    expect(
      formatLoanPaymentLabel({
        loanName: 'Auto',
        lender: 'Banco',
        paymentSource: 'WALLET',
      }),
    ).toBe('Pago préstamo: Auto (Banco)');
    expect(
      formatLoanPaymentLabel({
        loanName: 'FONACOT',
        lender: 'FONACOT',
        paymentSource: 'PAYROLL_DEDUCTION',
      }),
    ).toBe('Deducción nómina: FONACOT (FONACOT)');
  });
});

describe('linkedLoanPaymentExpenseIds', () => {
  it('returns only non-null linked expense ids', () => {
    expect(
      linkedLoanPaymentExpenseIds([
        { linkedExpenseId: 10 },
        { linkedExpenseId: null },
        { linkedExpenseId: 22 },
      ]),
    ).toEqual(new Set([10, 22]));
  });
});

describe('mapLoanDuePaymentToTransactionRow', () => {
  it('maps scheduled wallet payments for planning display', () => {
    const row = mapLoanDuePaymentToTransactionRow(basePayment());

    expect(row).toMatchObject({
      id: 12,
      date: '2026-06-15',
      description: 'Pago préstamo: FONACOT (FONACOT)',
      amount: 1500,
      category: 'Pago de préstamos',
      categoryIcon: '🏦',
      paymentMethod: 'Débito BBVA',
      wallet_id: 2,
      planning_row_kind: 'loan_payment',
      loan_payment_source: 'WALLET',
      type: 'expense',
      is_paid: false,
      due_day: 15,
    });
  });

  it('maps payroll deductions with income template label', () => {
    const row = mapLoanDuePaymentToTransactionRow(
      basePayment({
        paymentSource: 'PAYROLL_DEDUCTION',
        sourceWalletId: null,
        sourceWalletName: null,
        incomeTemplateName: 'Nómina Carmen',
      }),
    );

    expect(row).toMatchObject({
      description: 'Deducción nómina: FONACOT (FONACOT)',
      paymentMethod: 'Nómina: Nómina Carmen',
      wallet_id: null,
      planning_row_kind: 'loan_payment',
      loan_payment_source: 'PAYROLL_DEDUCTION',
      is_paid: false,
    });
  });
});
