import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  findFirstWallet,
  findFirstIncomeTemplate,
  createLoan,
} = vi.hoisted(() => ({
  findFirstWallet: vi.fn(),
  findFirstIncomeTemplate: vi.fn(),
  createLoan: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    wallet: {
      findFirst: findFirstWallet,
    },
    incomeTemplate: {
      findFirst: findFirstIncomeTemplate,
    },
    loan: {
      create: createLoan,
    },
  },
}));

import { createLoanForOwner } from '@/lib/finance/loan.service';

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

describe('createLoanForOwner', () => {
  beforeEach(() => {
    findFirstWallet.mockReset();
    findFirstIncomeTemplate.mockReset();
    createLoan.mockReset();
    findFirstIncomeTemplate.mockResolvedValue(null);
  });

  it('rejects credit wallets as loan payment sources', async () => {
    findFirstWallet.mockResolvedValueOnce({
      id: 10,
      type: 'CREDIT_CARD',
    });

    await expect(
      createLoanForOwner('user', 1, ownerFilter, baseInput),
    ).rejects.toThrow('efectivo o debito');
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
