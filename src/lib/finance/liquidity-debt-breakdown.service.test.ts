import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  findManyWallet,
  findManyExpense,
  findManyCreditCardInstallmentPlan,
  listLoansByOwner,
} = vi.hoisted(() => ({
  findManyWallet: vi.fn(),
  findManyExpense: vi.fn(),
  findManyCreditCardInstallmentPlan: vi.fn(),
  listLoansByOwner: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    wallet: { findMany: findManyWallet },
    expense: { findMany: findManyExpense },
    creditCardInstallmentPlan: { findMany: findManyCreditCardInstallmentPlan },
  },
}));

vi.mock('@/lib/finance/loan.service', () => ({
  listLoansByOwner,
}));

import { getLiquidityDebtBreakdown } from '@/lib/finance/liquidity-debt-breakdown.service';

const ownerFilter = { user_id: 1, house_id: null } as const;
const asOf = new Date('2026-03-16T18:00:00.000Z');

describe('getLiquidityDebtBreakdown', () => {
  beforeEach(() => {
    findManyWallet.mockReset();
    findManyExpense.mockReset();
    findManyCreditCardInstallmentPlan.mockReset();
    listLoansByOwner.mockReset();
  });

  it('groups plazos, resto and loan cuotas from one batched read', async () => {
    findManyWallet.mockResolvedValue([
      {
        id: 7,
        name: 'DIDI Card',
        amount: 5844,
        cutoff_day: 15,
        due_day: 20,
      },
      {
        id: 8,
        name: 'BBVA pagada',
        amount: 0,
        cutoff_day: 15,
        due_day: 20,
      },
    ]);
    findManyExpense.mockResolvedValue([
      {
        id: 11,
        wallet_id: 7,
        description: 'Laptop',
        amount: 200,
        payment_date: new Date('2025-10-01T12:00:00.000Z'),
        created_at: new Date('2025-10-01T12:00:00.000Z'),
        credit_installment_current: 4,
        credit_installment_total: 12,
      },
      {
        id: 21,
        wallet_id: 7,
        description: 'Uber',
        amount: 344,
        payment_date: new Date('2026-03-16T12:00:00.000Z'),
        created_at: new Date('2026-03-16T12:00:00.000Z'),
        credit_installment_current: null,
        credit_installment_total: null,
      },
    ]);
    findManyCreditCardInstallmentPlan.mockResolvedValue([
      {
        id: 3,
        name: 'Pantalla',
        credit_card_wallet_id: 7,
        installment_amount: 200,
        total_installments: 6,
        paid_installments: 1,
        payments: [{ amount: 600 }],
        already_in_card_balance: true,
      },
    ]);
    listLoansByOwner.mockResolvedValue([
      {
        id: 15,
        name: 'Fonacot Jorge',
        status: 'ACTIVE',
        remainingAmount: 50269,
        remainingPayments: 18,
        nextPayment: { dueDate: '2026-04-01', amount: 2793 },
        payments: [
          { id: 1, dueDate: '2026-04-01', amount: 2793, status: 'SCHEDULED' },
        ],
      },
      {
        id: 99,
        name: 'Pagado',
        status: 'PAID_OFF',
        remainingAmount: 0,
        remainingPayments: 0,
        nextPayment: null,
        payments: [],
      },
    ]);

    const breakdown = await getLiquidityDebtBreakdown(ownerFilter, asOf);

    expect(findManyWallet).toHaveBeenCalledTimes(1);
    expect(findManyExpense).toHaveBeenCalledTimes(1);
    expect(listLoansByOwner).toHaveBeenCalledWith(ownerFilter);
    expect(breakdown.loansTotal).toBe(50269);
    expect(breakdown.cardCount).toBe(1);
    expect(breakdown.loanCount).toBe(1);
    expect(breakdown.accounts.map((account) => account.id)).toEqual([
      'wallet-7',
      'wallet-8',
      'loan-15',
    ]);

    const didi = breakdown.accounts.find((account) => account.id === 'wallet-7');
    expect(didi?.plazosTotal).toBe(2200);
    expect(didi?.restoTotal).toBe(3644);
    expect(didi?.plazosTotal + didi!.restoTotal).toBe(didi?.debt);
    expect(didi?.blocks.map((block) => block.key)).toEqual(['plazos', 'resto']);
    expect(didi?.preview).toContain('2 plazos');

    const paid = breakdown.accounts.find((account) => account.id === 'wallet-8');
    expect(paid).toMatchObject({ debt: 0, preview: '', blocks: [] });
  });
});
