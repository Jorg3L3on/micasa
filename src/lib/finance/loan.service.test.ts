import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  findFirstWallet,
  findFirstIncomeTemplate,
  findFirstLoan,
  createLoan,
  updateLoan,
  findManyLoanPayment,
  transaction,
  txFindFirstLoanPayment,
  txUpdateLoanPayment,
  txFindManyLoanPayment,
  txFindFirstWallet,
  txUpdateWallet,
  txUpdateLoan,
  txDeleteExpense,
  resolveOrCreateFortnight,
  createExpenseInTransaction,
} = vi.hoisted(() => ({
  findFirstWallet: vi.fn(),
  findFirstIncomeTemplate: vi.fn(),
  findFirstLoan: vi.fn(),
  createLoan: vi.fn(),
  updateLoan: vi.fn(),
  findManyLoanPayment: vi.fn(),
  transaction: vi.fn(),
  txFindFirstLoanPayment: vi.fn(),
  txUpdateLoanPayment: vi.fn(),
  txFindManyLoanPayment: vi.fn(),
  txFindFirstWallet: vi.fn(),
  txUpdateWallet: vi.fn(),
  txUpdateLoan: vi.fn(),
  txDeleteExpense: vi.fn(),
  resolveOrCreateFortnight: vi.fn(),
  createExpenseInTransaction: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    $transaction: transaction,
    wallet: {
      findFirst: findFirstWallet,
    },
    incomeTemplate: {
      findFirst: findFirstIncomeTemplate,
    },
    loan: {
      create: createLoan,
      findFirst: findFirstLoan,
      update: updateLoan,
    },
    loanPayment: {
      findMany: findManyLoanPayment,
    },
  },
}));

vi.mock('@/lib/fortnights', () => ({
  resolveOrCreateFortnight,
}));

vi.mock('@/lib/finance/expense.service', () => ({
  createExpenseInTransaction,
}));

import {
  aggregateLoanPaymentsForFortnights,
  createLoanForOwner,
  listLoanPaymentsForPlannerMonth,
  updateLoanForOwner,
  updateLoanPaymentForOwner,
} from '@/lib/finance/loan.service';
import { parseCalendarDate } from '@/lib/calendar-dates';

const ownerFilter = { user_id: 1, house_id: null } as const;

const baseInput = {
  name: 'Prestamo DiDi',
  lender: 'DiDi',
  type: 'PERSONAL' as const,
  principalAmount: 3000,
  paymentAmount: 500,
  paymentCount: 6,
  frequency: 'FORTNIGHTLY' as const,
  startDate: '2026-05-18',
  paymentSource: 'WALLET' as const,
  sourceWalletId: 10,
  linkedWalletId: null,
  incomeTemplateId: null,
  notes: null,
};

const baseLoanRecord = {
  id: 5,
  name: 'Préstamo DiDi',
  lender: 'DiDi',
  type: 'PERSONAL',
  status: 'ACTIVE',
  principal_amount: '3000',
  payment_amount: '500',
  payment_count: 6,
  frequency: 'FORTNIGHTLY',
  start_date: parseCalendarDate('2026-05-18'),
  payment_source: 'WALLET',
  source_wallet_id: 10,
  source_wallet: { name: 'BBVA' },
  linked_wallet_id: null,
  linked_wallet: null,
  income_template_id: null,
  income_template: null,
  notes: null,
  payments: [],
};

describe('createLoanForOwner', () => {
  beforeEach(() => {
    findFirstWallet.mockReset();
    findFirstIncomeTemplate.mockReset();
    findFirstLoan.mockReset();
    createLoan.mockReset();
    updateLoan.mockReset();
    findManyLoanPayment.mockReset();
    findFirstIncomeTemplate.mockResolvedValue(null);
  });

  it('rejects credit wallets as loan payment sources', async () => {
    findFirstWallet.mockResolvedValueOnce({
      id: 10,
      type: 'CREDIT_CARD',
    });

    await expect(
      createLoanForOwner('user', 1, ownerFilter, baseInput),
    ).rejects.toThrow('efectivo o débito');
    expect(createLoan).not.toHaveBeenCalled();
  });

  it('creates a payment schedule for wallet-paid loans', async () => {
    findFirstWallet.mockResolvedValueOnce({
      id: 10,
      type: 'DEBIT_CARD',
    });
    createLoan.mockImplementation(async (args) => ({
      id: 1,
      name: args.data.name,
      lender: args.data.lender,
      type: args.data.type,
      status: 'ACTIVE',
      principal_amount: args.data.principal_amount,
      payment_amount: args.data.payment_amount,
      payment_count: args.data.payment_count,
      frequency: args.data.frequency,
      start_date: args.data.start_date,
      payment_source: args.data.payment_source,
      source_wallet_id: args.data.source_wallet_id,
      source_wallet: { name: 'BBVA' },
      linked_wallet_id: null,
      linked_wallet: null,
      income_template_id: null,
      income_template: null,
      notes: null,
      payments: args.data.payments.create.map(
        (payment: {
          sequence: number;
          due_date: Date;
          amount: string;
          source_wallet_id: number;
        }) => ({
          id: payment.sequence,
          loan_id: 1,
          sequence: payment.sequence,
          due_date: payment.due_date,
          amount: payment.amount,
          status: 'SCHEDULED',
          paid_at: null,
          source_wallet_id: payment.source_wallet_id,
          source_wallet: { name: 'BBVA' },
          note: null,
        }),
      ),
    }));

    const loan = await createLoanForOwner('user', 1, ownerFilter, baseInput);

    expect(createLoan).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          user_id: 1,
          house_id: null,
          source_wallet_id: 10,
          payments: {
            create: expect.arrayContaining([
              expect.objectContaining({ sequence: 1 }),
              expect.objectContaining({ sequence: 6 }),
            ]),
          },
        }),
      }),
    );
    expect(loan.payments).toHaveLength(6);
    expect(loan.nextPayment?.dueDate).toBe('2026-05-18');
  });
});

describe('updateLoanForOwner', () => {
  beforeEach(() => {
    findFirstWallet.mockReset();
    findFirstIncomeTemplate.mockReset();
    findFirstLoan.mockReset();
    updateLoan.mockReset();
  });

  it('updates safe metadata and relationships in the owner context', async () => {
    findFirstLoan.mockResolvedValueOnce({
      id: 5,
      status: 'ACTIVE',
      payment_source: 'PAYROLL_DEDUCTION',
    });
    findFirstWallet.mockResolvedValueOnce({ id: 11 });
    findFirstIncomeTemplate.mockResolvedValueOnce({ id: 12 });
    updateLoan.mockResolvedValueOnce({
      ...baseLoanRecord,
      name: 'Crédito nómina',
      lender: 'Empresa',
      type: 'PAYROLL',
      payment_source: 'PAYROLL_DEDUCTION',
      source_wallet_id: null,
      source_wallet: null,
      linked_wallet_id: 11,
      linked_wallet: { name: 'Cuenta nómina' },
      income_template_id: 12,
      income_template: { name: 'Nómina' },
      notes: 'Ajuste administrativo',
    });

    const loan = await updateLoanForOwner(5, ownerFilter, {
      name: 'Crédito nómina',
      lender: 'Empresa',
      linkedWalletId: 11,
      incomeTemplateId: 12,
      notes: 'Ajuste administrativo',
    });

    expect(updateLoan).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 5 },
        data: expect.objectContaining({
          name: 'Crédito nómina',
          lender: 'Empresa',
          linked_wallet_id: 11,
          income_template_id: 12,
          notes: 'Ajuste administrativo',
        }),
      }),
    );
    expect(loan.linkedWalletName).toBe('Cuenta nómina');
    expect(loan.incomeTemplateName).toBe('Nómina');
  });

  it('enforces owner context before updating a loan', async () => {
    findFirstLoan.mockResolvedValueOnce(null);

    await expect(
      updateLoanForOwner(999, ownerFilter, { name: 'Otro préstamo' }),
    ).rejects.toThrow('Préstamo no encontrado');
    expect(updateLoan).not.toHaveBeenCalled();
  });

  it('pauses active loans without changing payment history', async () => {
    findFirstLoan.mockResolvedValueOnce({
      id: 5,
      status: 'ACTIVE',
      payment_source: 'WALLET',
    });
    updateLoan.mockResolvedValueOnce({
      ...baseLoanRecord,
      status: 'PAUSED',
    });

    const loan = await updateLoanForOwner(5, ownerFilter, { status: 'PAUSED' });

    expect(updateLoan).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 5 },
        data: expect.objectContaining({ status: 'PAUSED' }),
      }),
    );
    expect(loan.status).toBe('PAUSED');
  });

  it('prevents cancelled loans from being reactivated', async () => {
    findFirstLoan.mockResolvedValueOnce({
      id: 5,
      status: 'CANCELLED',
      payment_source: 'WALLET',
    });

    await expect(
      updateLoanForOwner(5, ownerFilter, { status: 'ACTIVE' }),
    ).rejects.toThrow('Solo los préstamos pausados se pueden reanudar');
    expect(updateLoan).not.toHaveBeenCalled();
  });
});

describe('listLoanPaymentsForPlannerMonth', () => {
  beforeEach(() => {
    findManyLoanPayment.mockReset();
  });

  it('excludes paused and cancelled loans from planning visibility', async () => {
    findManyLoanPayment.mockResolvedValueOnce([]);

    await listLoanPaymentsForPlannerMonth(ownerFilter, 2026, 6);

    expect(findManyLoanPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          loan: expect.objectContaining({
            status: { in: ['ACTIVE', 'PAID_OFF'] },
          }),
        }),
      }),
    );
  });
});

describe('aggregateLoanPaymentsForFortnights', () => {
  beforeEach(() => {
    findManyLoanPayment.mockReset();
  });

  const currentFortnight = [
    {
      id: 90,
      start_date: parseCalendarDate('2026-06-01'),
      end_date: parseCalendarDate('2026-06-15'),
    },
  ];

  it('surfaces scheduled loan payments as upcoming obligations with loan context', async () => {
    findManyLoanPayment.mockResolvedValueOnce([
      {
        id: 22,
        loan_id: 5,
        sequence: 1,
        due_date: parseCalendarDate('2026-06-10'),
        amount: '150',
        status: 'SCHEDULED',
        paid_at: null,
        source_wallet_id: 10,
        source_wallet: { name: 'BBVA' },
        linked_expense: null,
        note: null,
        loan: {
          id: 5,
          name: 'Préstamo DiDi',
          lender: 'DiDi',
          payment_source: 'WALLET',
        },
      },
    ]);

    const aggregate = await aggregateLoanPaymentsForFortnights(
      ownerFilter,
      currentFortnight,
    );

    expect(aggregate).toMatchObject({
      total: 150,
      paidTotal: 0,
      pendingTotal: 150,
      count: 1,
      pendingCount: 1,
    });
    expect(aggregate.upcoming[0]).toMatchObject({
      id: 22,
      loanId: 5,
      loanName: 'Préstamo DiDi',
      lender: 'DiDi',
      dueDate: '2026-06-10',
      amount: 150,
      sourceWalletId: 10,
      sourceWalletName: 'BBVA',
    });
  });

  it('does not add paid generated-expense loan payments to dashboard totals', async () => {
    findManyLoanPayment.mockResolvedValueOnce([
      {
        id: 22,
        loan_id: 5,
        sequence: 1,
        due_date: parseCalendarDate('2026-06-10'),
        amount: '150',
        status: 'PAID',
        paid_at: parseCalendarDate('2026-06-10'),
        source_wallet_id: 10,
        source_wallet: { name: 'BBVA' },
        linked_expense: { id: 321 },
        note: null,
        loan: {
          id: 5,
          name: 'Préstamo DiDi',
          lender: 'DiDi',
          payment_source: 'WALLET',
        },
      },
    ]);

    const aggregate = await aggregateLoanPaymentsForFortnights(
      ownerFilter,
      currentFortnight,
    );

    expect(aggregate).toMatchObject({
      total: 0,
      paidTotal: 0,
      pendingTotal: 0,
      count: 1,
      pendingCount: 0,
    });
    expect(aggregate.upcoming).toEqual([]);
  });
});

const tx = {
  loanPayment: {
    findFirst: txFindFirstLoanPayment,
    update: txUpdateLoanPayment,
    findMany: txFindManyLoanPayment,
  },
  wallet: {
    findFirst: txFindFirstWallet,
    update: txUpdateWallet,
  },
  loan: {
    update: txUpdateLoan,
  },
  expense: {
    delete: txDeleteExpense,
  },
  category: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
};

const scheduledWalletPayment = {
  id: 22,
  loan_id: 5,
  sequence: 1,
  due_date: parseCalendarDate('2026-06-10'),
  amount: '150',
  status: 'SCHEDULED',
  paid_at: null,
  source_wallet_id: 10,
  note: null,
  linked_expense: null,
  loan: {
    id: 5,
    name: 'Préstamo DiDi',
    lender: 'DiDi',
    payment_source: 'WALLET',
  },
};

describe('updateLoanPaymentForOwner', () => {
  beforeEach(() => {
    findFirstWallet.mockReset();
    transaction.mockReset();
    txFindFirstLoanPayment.mockReset();
    txUpdateLoanPayment.mockReset();
    txFindManyLoanPayment.mockReset();
    txFindFirstWallet.mockReset();
    txUpdateWallet.mockReset();
    txUpdateLoan.mockReset();
    txDeleteExpense.mockReset();
    resolveOrCreateFortnight.mockReset();
    createExpenseInTransaction.mockReset();
    tx.category.findFirst.mockReset();
    tx.category.create.mockReset();

    transaction.mockImplementation((fn) => fn(tx));
  });

  it('marks wallet-paid payments paid with an explicit action and generated expense', async () => {
    findFirstWallet.mockResolvedValueOnce({ id: 10, type: 'DEBIT_CARD' });
    txFindFirstLoanPayment.mockResolvedValueOnce(scheduledWalletPayment);
    txFindFirstWallet.mockResolvedValueOnce({
      id: 10,
      amount: '500',
      type: 'DEBIT_CARD',
    });
    txUpdateLoanPayment.mockResolvedValueOnce({
      ...scheduledWalletPayment,
      status: 'PAID',
      paid_at: parseCalendarDate('2026-06-10'),
      source_wallet: { name: 'BBVA' },
    });
    txFindManyLoanPayment.mockResolvedValueOnce([{ status: 'PAID' }]);
    resolveOrCreateFortnight.mockResolvedValueOnce({ id: 90 });
    tx.category.findFirst.mockResolvedValueOnce({ id: 7 });
    createExpenseInTransaction.mockResolvedValueOnce({ id: 321 });

    const payment = await updateLoanPaymentForOwner(22, ownerFilter, {
      action: 'MARK_PAID',
      paidAt: '2026-06-10',
      sourceWalletId: 10,
    });

    expect(payment).toMatchObject({
      id: 22,
      status: 'PAID',
      paidAt: '2026-06-10',
      sourceWalletId: 10,
      linkedExpenseId: 321,
    });
    expect(createExpenseInTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        paymentDate: '2026-06-10',
        walletId: 10,
        loanPaymentId: 22,
      }),
    );
    expect(txUpdateLoan).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { status: 'PAID_OFF' },
    });
  });

  it('undoes paid wallet payments by deleting the generated expense and reversing wallet balance', async () => {
    txFindFirstLoanPayment.mockResolvedValueOnce({
      ...scheduledWalletPayment,
      status: 'PAID',
      paid_at: parseCalendarDate('2026-06-10'),
      linked_expense: {
        id: 300,
        wallet_id: 10,
        amount: '150',
        is_paid: true,
        wallet: { type: 'DEBIT_CARD' },
      },
    });
    txUpdateLoanPayment.mockResolvedValueOnce({
      ...scheduledWalletPayment,
      status: 'SCHEDULED',
      paid_at: null,
      source_wallet: { name: 'BBVA' },
      linked_expense: null,
    });
    txFindManyLoanPayment.mockResolvedValueOnce([
      { status: 'SCHEDULED' },
      { status: 'SKIPPED' },
    ]);

    const payment = await updateLoanPaymentForOwner(22, ownerFilter, {
      action: 'MARK_SCHEDULED',
    });

    expect(payment.status).toBe('SCHEDULED');
    expect(txUpdateWallet).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { amount: { increment: 150 } },
    });
    expect(txDeleteExpense).toHaveBeenCalledWith({ where: { id: 300 } });
    expect(txUpdateLoan).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { status: 'ACTIVE' },
    });
  });

  it('marks payroll deduction payments paid without creating a funding expense', async () => {
    txFindFirstLoanPayment.mockResolvedValueOnce({
      ...scheduledWalletPayment,
      source_wallet_id: null,
      loan: {
        ...scheduledWalletPayment.loan,
        payment_source: 'PAYROLL_DEDUCTION',
      },
    });
    txUpdateLoanPayment.mockResolvedValueOnce({
      ...scheduledWalletPayment,
      status: 'PAID',
      paid_at: parseCalendarDate('2026-06-15'),
      source_wallet_id: null,
      source_wallet: null,
      linked_expense: null,
    });
    txFindManyLoanPayment.mockResolvedValueOnce([{ status: 'PAID' }]);

    const payment = await updateLoanPaymentForOwner(22, ownerFilter, {
      action: 'MARK_PAID',
      paidAt: '2026-06-15',
    });

    expect(payment).toMatchObject({
      status: 'PAID',
      paidAt: '2026-06-15',
      sourceWalletId: null,
      linkedExpenseId: null,
    });
    expect(txFindFirstWallet).not.toHaveBeenCalled();
    expect(createExpenseInTransaction).not.toHaveBeenCalled();
    expect(txUpdateLoan).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { status: 'PAID_OFF' },
    });
  });

  it('rejects wallet-paid actions when the source wallet lacks funds', async () => {
    findFirstWallet.mockResolvedValueOnce({ id: 10, type: 'DEBIT_CARD' });
    txFindFirstLoanPayment.mockResolvedValueOnce(scheduledWalletPayment);
    txFindFirstWallet.mockResolvedValueOnce({
      id: 10,
      amount: '25',
      type: 'DEBIT_CARD',
    });

    await expect(
      updateLoanPaymentForOwner(22, ownerFilter, {
        action: 'MARK_PAID',
        paidAt: '2026-06-10',
        sourceWalletId: 10,
      }),
    ).rejects.toThrow('Saldo insuficiente');

    expect(txUpdateLoanPayment).not.toHaveBeenCalled();
    expect(createExpenseInTransaction).not.toHaveBeenCalled();
  });
});
