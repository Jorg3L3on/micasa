import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoanListItem } from '@/types/loans';

const {
  findFirstLender,
  findManyLender,
  findFirstWallet,
  findManyLenderPayment,
  findFirstLenderPayment,
  transaction,
  txCreateLenderPayment,
  txUpdateLenderPayment,
  txUpdateManyLoanPayment,
  txUpdateLoanPayment,
  txCreateLoanPayment,
  txAggregateLoanPayment,
  txFindManyLoanPayment,
  txUpdateLoan,
  txDeleteExpense,
  txDeleteLenderPayment,
  txCategoryFindFirst,
  listLoansByOwner,
  createExpenseInTransaction,
  resolveOrCreateFortnight,
} = vi.hoisted(() => ({
  findFirstLender: vi.fn(),
  findManyLender: vi.fn(),
  findFirstWallet: vi.fn(),
  findManyLenderPayment: vi.fn(),
  findFirstLenderPayment: vi.fn(),
  transaction: vi.fn(),
  txCreateLenderPayment: vi.fn(),
  txUpdateLenderPayment: vi.fn(),
  txUpdateManyLoanPayment: vi.fn(),
  txUpdateLoanPayment: vi.fn(),
  txCreateLoanPayment: vi.fn(),
  txAggregateLoanPayment: vi.fn(),
  txFindManyLoanPayment: vi.fn(),
  txUpdateLoan: vi.fn(),
  txDeleteExpense: vi.fn(),
  txDeleteLenderPayment: vi.fn(),
  txCategoryFindFirst: vi.fn(),
  listLoansByOwner: vi.fn(),
  createExpenseInTransaction: vi.fn(),
  resolveOrCreateFortnight: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    lender: {
      findFirst: findFirstLender,
      findMany: findManyLender,
    },
    wallet: {
      findFirst: findFirstWallet,
    },
    lenderPayment: {
      findMany: findManyLenderPayment,
      findFirst: findFirstLenderPayment,
    },
    $transaction: transaction,
  },
}));

vi.mock('@/lib/finance/loan.service', () => ({
  listLoansByOwner,
}));

vi.mock('@/lib/finance/expense.service', () => ({
  createExpenseInTransaction,
}));

vi.mock('@/lib/fortnights', () => ({
  resolveOrCreateFortnight,
}));

vi.mock('@/lib/calendar-dates', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/calendar-dates')>();
  return {
    ...actual,
    todayCalendarDate: vi.fn(() => '2026-09-10'),
  };
});

import {
  payLenderForOwner,
  undoLenderPaymentForOwner,
} from '@/lib/finance/lender.service';

const ownerFilter = { user_id: 1, house_id: null } as const;

const scheduledPayment = (
  overrides: Partial<NonNullable<LoanListItem['payments']>[number]> &
    Pick<NonNullable<LoanListItem['payments']>[number], 'id' | 'loanId' | 'dueDate' | 'amount'>,
): NonNullable<LoanListItem['payments']>[number] => ({
  sequence: 1,
  status: 'SCHEDULED',
  paidAt: null,
  sourceWalletId: 10,
  sourceWalletName: 'BBVA',
  linkedExpenseId: null,
  lenderPaymentId: null,
  note: null,
  ...overrides,
});

const walletLoan = (
  id: number,
  name: string,
  payments: NonNullable<LoanListItem['payments']>,
): LoanListItem => ({
  id,
  name,
  lender: 'Mercado Libre',
  lenderId: 7,
  type: 'PERSONAL',
  status: 'ACTIVE',
  principalAmount: 3000,
  totalPayable: 3000,
  paymentAmount: payments[0]?.amount ?? 0,
  paymentCount: 6,
  frequency: 'MONTHLY',
  startDate: '2026-04-05',
  paymentSource: 'WALLET',
  sourceWalletId: 10,
  sourceWalletName: 'BBVA',
  linkedWalletId: null,
  linkedWalletName: null,
  incomeTemplateId: null,
  incomeTemplateName: null,
  notes: null,
  paidAmount: 0,
  remainingAmount: 3000,
  paidPayments: 0,
  remainingPayments: 6,
  overduePayment: null,
  nextPayment: payments[0] ?? null,
  payments,
});

const tx = {
  lenderPayment: {
    create: txCreateLenderPayment,
    update: txUpdateLenderPayment,
    delete: txDeleteLenderPayment,
  },
  loanPayment: {
    updateMany: txUpdateManyLoanPayment,
    update: txUpdateLoanPayment,
    create: txCreateLoanPayment,
    aggregate: txAggregateLoanPayment,
    findMany: txFindManyLoanPayment,
  },
  loan: {
    update: txUpdateLoan,
  },
  expense: {
    delete: txDeleteExpense,
  },
  wallet: {
    update: vi.fn(),
  },
  category: {
    findFirst: txCategoryFindFirst,
    create: vi.fn(),
  },
};

describe('payLenderForOwner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transaction.mockImplementation((fn: (client: typeof tx) => unknown) => fn(tx));
    findFirstLender.mockResolvedValue({
      id: 7,
      name: 'Mercado Libre',
      provider_icon_key: null,
      notes: null,
      active: true,
    });
    findManyLenderPayment.mockResolvedValue([]);
    txCreateLenderPayment.mockResolvedValue({ id: 50 });
    txCategoryFindFirst.mockResolvedValue({ id: 9 });
    resolveOrCreateFortnight.mockResolvedValue({ id: 90 });
    createExpenseInTransaction.mockResolvedValue({ id: 321 });
    txFindManyLoanPayment.mockResolvedValue([{ status: 'PAID' }, { status: 'SCHEDULED' }]);
  });

  it('debits the source wallet once and marks every installment in the window', async () => {
    listLoansByOwner.mockResolvedValue([
      walletLoan(1, 'MSI celular', [
        scheduledPayment({ id: 11, loanId: 1, dueDate: '2026-09-05', amount: 100 }),
      ]),
      walletLoan(2, 'MSI laptop', [
        scheduledPayment({ id: 21, loanId: 2, dueDate: '2026-09-18', amount: 80 }),
      ]),
    ]);
    findFirstWallet.mockResolvedValue({
      id: 10,
      type: 'DEBIT_CARD',
      amount: '500',
    });
    findManyLenderPayment
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 50,
          lender_id: 7,
          amount: '180',
          paid_at: new Date('2026-09-10T12:00:00.000Z'),
          mode: 'WALLET',
          source_wallet_id: 10,
          source_wallet: { name: 'BBVA' },
          expense_id: 321,
          note: null,
          loan_payments: [{ id: 11 }, { id: 21 }],
        },
      ]);

    const result = await payLenderForOwner(7, ownerFilter, {
      mode: 'WALLET',
      paidAt: '2026-09-10',
      sourceWalletId: 10,
    });

    expect(createExpenseInTransaction).toHaveBeenCalledTimes(1);
    expect(createExpenseInTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        description: 'Pago a Mercado Libre',
        amount: 180,
        walletId: 10,
        isPaid: true,
      }),
    );
    expect(txUpdateManyLoanPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [11, 21] }, loan: ownerFilter },
        data: expect.objectContaining({
          status: 'PAID',
          lender_payment_id: 50,
        }),
      }),
    );
    expect(result.payment.amount).toBe(180);
    expect(result.payment.installmentCount).toBe(2);
  });

  it('omits opted-out wallet installments from the cash payment', async () => {
    listLoansByOwner.mockResolvedValue([
      walletLoan(1, 'MSI celular', [
        scheduledPayment({ id: 11, loanId: 1, dueDate: '2026-09-05', amount: 100 }),
      ]),
      walletLoan(2, 'MSI laptop', [
        scheduledPayment({ id: 21, loanId: 2, dueDate: '2026-09-18', amount: 80 }),
      ]),
    ]);
    findFirstWallet.mockResolvedValue({
      id: 10,
      type: 'DEBIT_CARD',
      amount: '500',
    });
    findManyLenderPayment
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 50,
          lender_id: 7,
          amount: '100',
          paid_at: new Date('2026-09-10T12:00:00.000Z'),
          mode: 'WALLET',
          source_wallet_id: 10,
          source_wallet: { name: 'BBVA' },
          expense_id: 321,
          note: null,
          loan_payments: [{ id: 11 }],
        },
      ]);

    await payLenderForOwner(7, ownerFilter, {
      mode: 'WALLET',
      paidAt: '2026-09-10',
      sourceWalletId: 10,
      excludePaymentIds: [21],
    });

    expect(createExpenseInTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ amount: 100 }),
    );
    expect(txUpdateManyLoanPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [11] }, loan: ownerFilter },
      }),
    );
  });

  it('rejects payroll-only lenders with no wallet window', async () => {
    listLoansByOwner.mockResolvedValue([
      {
        ...walletLoan(3, 'FONACOT', [
          scheduledPayment({
            id: 31,
            loanId: 3,
            dueDate: '2026-09-15',
            amount: 500,
            sourceWalletId: null,
            sourceWalletName: null,
          }),
        ]),
        paymentSource: 'PAYROLL_DEDUCTION',
        type: 'PAYROLL',
      },
    ]);

    await expect(
      payLenderForOwner(7, ownerFilter, {
        mode: 'WALLET',
        paidAt: '2026-09-10',
        sourceWalletId: 10,
      }),
    ).rejects.toThrow('No hay cuotas de billetera');
    expect(createExpenseInTransaction).not.toHaveBeenCalled();
  });
});

describe('undoLenderPaymentForOwner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transaction.mockImplementation((fn: (client: typeof tx) => unknown) => fn(tx));
    findFirstLender.mockResolvedValue({
      id: 7,
      name: 'Mercado Libre',
      provider_icon_key: null,
      notes: null,
      active: true,
    });
    listLoansByOwner.mockResolvedValue([]);
    findManyLenderPayment.mockResolvedValue([]);
  });

  it('restores scheduled installments and deletes the lote expense', async () => {
    findFirstLenderPayment.mockResolvedValue({
      id: 50,
      lender_id: 7,
      expense: {
        id: 321,
        wallet_id: 10,
        amount: '180',
        is_paid: true,
        wallet: { type: 'DEBIT_CARD' },
      },
      loan_payments: [
        { id: 11, loan_id: 1 },
        { id: 21, loan_id: 2 },
      ],
    });
    txFindManyLoanPayment.mockResolvedValue([{ status: 'SCHEDULED' }]);

    await undoLenderPaymentForOwner(7, 50, ownerFilter);

    expect(txDeleteExpense).toHaveBeenCalledWith({ where: { id: 321 } });
    expect(txUpdateManyLoanPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { lender_payment_id: 50 },
        data: expect.objectContaining({
          status: 'SCHEDULED',
          lender_payment_id: null,
        }),
      }),
    );
    expect(txDeleteLenderPayment).toHaveBeenCalledWith({ where: { id: 50 } });
  });
});
