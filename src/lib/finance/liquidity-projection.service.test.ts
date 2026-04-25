import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentMethodType } from '@/generated/prisma/client';

const {
  queryRaw,
  findManyWallet,
  findManyExpense,
  findManyFortnight,
  findManyExpenseTemplate,
  findManyIncome,
  findManyIncomeTemplate,
} = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  findManyWallet: vi.fn(),
  findManyExpense: vi.fn(),
  findManyFortnight: vi.fn(),
  findManyExpenseTemplate: vi.fn(),
  findManyIncome: vi.fn(),
  findManyIncomeTemplate: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    $queryRaw: queryRaw,
    wallet: { findMany: findManyWallet },
    expense: { findMany: findManyExpense },
    fortnight: { findMany: findManyFortnight },
    expenseTemplate: { findMany: findManyExpenseTemplate },
    income: { findMany: findManyIncome },
    incomeTemplate: { findMany: findManyIncomeTemplate },
  },
}));

import { getLiquidityProjection } from '@/lib/finance/liquidity-projection.service';

const userOwner = { user_id: 1, house_id: null } as const;

const fundingRow = {
  id: 10,
  name: 'Efectivo',
  type: PaymentMethodType.CASH,
  amount: '500',
};

const visaRow = {
  id: 7,
  name: 'Visa',
  type: PaymentMethodType.CREDIT_CARD,
  cutoff_day: 15,
  due_day: 20,
};

const setupWalletMock = (
  funding: typeof fundingRow[],
  cards: typeof visaRow[],
) => {
  findManyWallet.mockImplementation(
    async (args: { where: { type?: { in: string[] } } }) => {
      const types = args.where?.type?.in ?? [];
      if (
        types.includes(PaymentMethodType.CREDIT_CARD) ||
        types.includes(PaymentMethodType.DEPARTMENT_STORE_CARD)
      ) {
        return cards;
      }
      return funding;
    },
  );
};

describe('getLiquidityProjection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 2, 10, 12, 0, 0)));
    queryRaw.mockReset();
    findManyWallet.mockReset();
    findManyExpense.mockReset();
    findManyFortnight.mockReset();
    findManyExpenseTemplate.mockReset();
    findManyIncome.mockReset();
    findManyIncomeTemplate.mockReset();
    findManyFortnight.mockResolvedValue([]);
    findManyIncome.mockResolvedValue([]);
    findManyIncomeTemplate.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('throws INVALID_HORIZON when until is before asOf', async () => {
    setupWalletMock([fundingRow], []);
    await expect(
      getLiquidityProjection({
        ownerFilter: userOwner,
        asOf: new Date(Date.UTC(2026, 5, 1)),
        until: new Date(Date.UTC(2026, 2, 1)),
      }),
    ).rejects.toMatchObject({ code: 'INVALID_HORIZON' });
  });

  it('returns empty milestones when there are no credit cards', async () => {
    setupWalletMock([fundingRow], []);
    findManyExpense.mockResolvedValue([]);
    const until = new Date(Date.UTC(2026, 8, 1));
    const result = await getLiquidityProjection({
      ownerFilter: userOwner,
      until,
      includeUnpaidExpenses: false,
    });
    expect(result.milestones).toEqual([]);
    expect(result.summary.total_obligations_due_on_or_before_until).toBe(0);
    expect(result.summary.funding_total).toBe(500);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('loads ledger once and builds CC milestone from purchases in closed statement', async () => {
    setupWalletMock([fundingRow], [visaRow]);
    queryRaw
      .mockResolvedValueOnce([
        {
          wallet_id: 7,
          amount: '300',
          eff: new Date(Date.UTC(2026, 1, 5)),
        },
      ])
      .mockResolvedValueOnce([]);
    findManyExpense.mockResolvedValue([]);
    const until = new Date(Date.UTC(2026, 8, 1));
    const result = await getLiquidityProjection({
      ownerFilter: userOwner,
      until,
      includeUnpaidExpenses: false,
    });
    expect(queryRaw).toHaveBeenCalledTimes(2);
    expect(result.milestones.length).toBeGreaterThanOrEqual(1);
    const first = result.milestones[0]!;
    expect(first.obligations.some((o) => o.source === 'credit_card_statement')).toBe(
      true,
    );
    const cc = first.obligations.find((o) => o.wallet_id === 7)!;
    expect(cc.next_due_payment).toBe(300);
    expect(cc.last_statement_balance).toBe(300);
    expect(result.summary.total_obligations_due_on_or_before_until).toBeGreaterThanOrEqual(
      300,
    );
  });

  it('merges unpaid funding expenses into milestones', async () => {
    setupWalletMock([fundingRow], [visaRow]);
    queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    findManyExpense.mockResolvedValueOnce([
      {
        id: 99,
        description: 'Luz',
        amount: '80',
        payment_date: null,
        wallet_id: 10,
        fortnight: {
          id: 1,
          end_date: new Date(Date.UTC(2026, 2, 15, 23, 59, 59)),
        },
        wallet: {
          id: 10,
          name: 'Efectivo',
          type: PaymentMethodType.CASH,
        },
      },
    ]);
    const until = new Date(Date.UTC(2026, 8, 1));
    const result = await getLiquidityProjection({
      ownerFilter: userOwner,
      until,
      includeUnpaidExpenses: true,
    });
    const unpaid = result.milestones.flatMap((m) => m.obligations).find(
      (o) => o.source === 'unpaid_expense',
    );
    expect(unpaid).toMatchObject({
      expense_id: 99,
      next_due_payment: 80,
      wallet_id: 10,
    });
  });

  it('skips unpaid query when includeUnpaidExpenses is false', async () => {
    setupWalletMock([fundingRow], []);
    const until = new Date(Date.UTC(2026, 8, 1));
    await getLiquidityProjection({
      ownerFilter: userOwner,
      until,
      includeUnpaidExpenses: false,
    });
    expect(findManyExpense).not.toHaveBeenCalled();
  });

  it('applies stress percent to cycle spend when closed statement is zero', async () => {
    setupWalletMock([fundingRow], [visaRow]);
    queryRaw
      .mockResolvedValueOnce([
        {
          wallet_id: 7,
          amount: '200',
          eff: new Date(Date.UTC(2026, 2, 5)),
        },
      ])
      .mockResolvedValueOnce([]);
    findManyExpense.mockResolvedValue([]);
    const until = new Date(Date.UTC(2026, 8, 1));
    const result = await getLiquidityProjection({
      ownerFilter: userOwner,
      until,
      includeUnpaidExpenses: false,
      stressCyclePercent: 50,
    });
    const cc = result.milestones
      .flatMap((m) => m.obligations)
      .find((o) => o.source === 'credit_card_statement' && o.stress_adjustment);
    expect(cc).toBeDefined();
    expect(cc!.stress_adjustment).toBe(100);
    expect(cc!.next_due_payment).toBe(100);
  });

  it('adds template estimate when fortnight exists and no expense from template', async () => {
    setupWalletMock([fundingRow], []);
    findManyFortnight.mockResolvedValue([
      {
        id: 50,
        period: 'FIRST',
        end_date: new Date(Date.UTC(2026, 3, 15, 12, 0, 0)),
        start_date: new Date(Date.UTC(2026, 3, 1, 12, 0, 0)),
      },
    ]);
    findManyExpense.mockResolvedValue([]);
    findManyExpenseTemplate.mockResolvedValue([
      {
        id: 1,
        name: 'Netflix',
        suggested_amount: '199',
        wallet_id: 10,
      },
    ]);
    const until = new Date(Date.UTC(2026, 8, 1));
    const result = await getLiquidityProjection({
      ownerFilter: userOwner,
      until,
      includeUnpaidExpenses: false,
      includeExpenseTemplates: true,
    });
    const tpl = result.milestones
      .flatMap((m) => m.obligations)
      .find((o) => o.source === 'expense_template');
    expect(tpl).toMatchObject({
      template_name: 'Netflix',
      next_due_payment: 199,
      is_estimate: true,
      expense_template_id: 1,
    });
  });

  it('echoes options in result', async () => {
    setupWalletMock([], []);
    findManyExpense.mockResolvedValue([]);
    const until = new Date(Date.UTC(2026, 8, 1));
    const result = await getLiquidityProjection({
      ownerFilter: userOwner,
      until,
      includeUnpaidExpenses: false,
      includeExpenseTemplates: true,
      stressCyclePercent: 12.7,
    });
    expect(result.options).toEqual({
      stress_cycle_percent: 13,
      include_unpaid_expenses: false,
      include_expense_templates: true,
    });
  });
});
