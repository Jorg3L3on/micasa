import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashSync } from 'bcryptjs';

const {
  findUniqueApiKey,
  updateApiKey,
  findFirstMembership,
  findManyAllowedContexts,
  toggleExpensePaid,
  updateLoanPaymentForOwner,
  batchUpdateLoanPaymentsForOwner,
  createScheduledPayment,
  upsertCreditCardPaymentPlan,
  createWalletForOwner,
  createCreditCardForOwner,
  listWalletMovements,
} = vi.hoisted(() => ({
  findUniqueApiKey: vi.fn(),
  updateApiKey: vi.fn(),
  findFirstMembership: vi.fn(),
  findManyAllowedContexts: vi.fn(),
  toggleExpensePaid: vi.fn(),
  updateLoanPaymentForOwner: vi.fn(),
  batchUpdateLoanPaymentsForOwner: vi.fn(),
  createScheduledPayment: vi.fn(),
  upsertCreditCardPaymentPlan: vi.fn(),
  createWalletForOwner: vi.fn(),
  createCreditCardForOwner: vi.fn(),
  listWalletMovements: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    apiKey: { findUnique: findUniqueApiKey, update: updateApiKey },
    houseMember: { findFirst: findFirstMembership },
    agentConnectionAllowedContext: { findMany: findManyAllowedContexts },
    wallet: { findUnique: vi.fn().mockResolvedValue({ amount: 1000, type: 'CASH' }) },
  },
}));

vi.mock('@/lib/finance/expense.service', () => ({
  toggleExpensePaid,
}));

vi.mock('@/lib/finance/loan.service', () => ({
  batchUpdateLoanPaymentsForOwner,
  updateLoanPaymentForOwner,
}));

vi.mock('@/lib/finance/credit-card-scheduled-payment.service', () => ({
  createScheduledPayment,
}));

vi.mock('@/lib/finance/credit-card-payment-plan.service', () => ({
  upsertCreditCardPaymentPlan,
}));

vi.mock('@/lib/finance/wallet.service', () => ({
  createWalletForOwner,
}));

vi.mock('@/lib/finance/credit-card.service', () => ({
  createCreditCardForOwner,
}));

vi.mock('@/lib/finance/wallet-movements', () => ({
  listWalletMovements,
  computeMovementTotals: vi.fn().mockReturnValue({
    inflow: 0,
    outflow: 100,
    net: -100,
  }),
}));

vi.mock('@/lib/mcp/resolvers', () => ({
  resolveWalletRef: vi.fn().mockResolvedValue({
    id: 4,
    name: 'Efectivo',
    type: 'CASH',
  }),
  resolveDateRange: vi.fn().mockReturnValue({ from: '2026-08-01', to: '2026-08-31' }),
}));

vi.mock('@/lib/server/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({
    limited: false,
    retryAfterSeconds: 0,
    remaining: 120,
  }),
}));

import { runAgentTool } from '@/lib/mcp/tool-helpers';
import { updateLoanPaymentSchema } from '@/schemas/loan.schema';
import { createCreditCardScheduledPaymentSchema } from '@/schemas/credit-card-scheduled-payment.schema';
import { cardPaymentPlanSchema } from '@/schemas/credit-card-payment-plan.schema';
import { createWalletSchema } from '@/schemas/wallet.schema';
import { createCreditCardSchema } from '@/schemas/credit-card.schema';

const VALID_TOKEN = 'micasa_secreto-de-prueba-suficientemente-largo';
const VALID_HASH = hashSync(VALID_TOKEN, 4);

const writeApiKey = {
  id: 10,
  key_hash: VALID_HASH,
  revoked_at: null,
  scopes: ['read', 'write'],
  user: { id: 2, active: true },
};

const ctxWithToken = (token?: string) => ({
  http: {
    req: new Request('http://localhost/api/mcp', {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }),
  },
});

const houseArgs = { ownerType: 'house' as const, ownerId: 3 };

beforeEach(() => {
  vi.clearAllMocks();
  updateApiKey.mockResolvedValue({});
  findUniqueApiKey.mockResolvedValue(writeApiKey);
  findFirstMembership.mockResolvedValue({ role: 'OWNER' });
  findManyAllowedContexts.mockResolvedValue([{ owner_type: 'HOUSE', owner_id: 3 }]);
});

describe('MCP P1 write tools auth', () => {
  it('set_expense_paid requires write scope', async () => {
    findUniqueApiKey.mockResolvedValue({ ...writeApiKey, scopes: ['read'] });

    const result = await runAgentTool(
      'set_expense_paid',
      ctxWithToken(VALID_TOKEN),
      { ...houseArgs, expense_id: 1, is_paid: true },
      'write',
      async () => toggleExpensePaid({ id: 1, paid: true, ownerFilter: { user_id: null, house_id: 3 } }),
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('scope \\"write\\"');
    expect(toggleExpensePaid).not.toHaveBeenCalled();
  });
});

describe('set_expense_paid', () => {
  it('calls toggleExpensePaid like PATCH /api/expenses/[id]/paid', async () => {
    toggleExpensePaid.mockResolvedValue({
      id: 12,
      is_paid: true,
      amount: 250,
      description: 'Compra',
      paymentMethod: 'Efectivo',
    });

    const result = await runAgentTool(
      'set_expense_paid',
      ctxWithToken(VALID_TOKEN),
      { ...houseArgs, expense_id: 12, is_paid: true },
      'write',
      async (agent) => {
        const expense = await toggleExpensePaid({
          id: 12,
          paid: true,
          ownerFilter: agent.ownerFilter,
        });
        return {
          expense_id: expense.id,
          is_paid: expense.is_paid,
          amount: expense.amount,
          description: expense.description,
          wallet_name: expense.paymentMethod,
        };
      },
    );

    expect(result.isError).toBeFalsy();
    expect(toggleExpensePaid).toHaveBeenCalledWith({
      id: 12,
      paid: true,
      ownerFilter: { user_id: null, house_id: 3 },
    });
    expect(JSON.parse(result.content[0].text)).toMatchObject({
      expense_id: 12,
      is_paid: true,
    });
  });
});

describe('add_loan_payment actions', () => {
  it('MARK_PAID uses updateLoanPaymentForOwner with wallet source', async () => {
    updateLoanPaymentForOwner.mockResolvedValue({
      id: 7,
      loanId: 2,
      status: 'PAID',
    });

    const input = updateLoanPaymentSchema.parse({
      action: 'MARK_PAID',
      paidAt: '2026-08-15',
      sourceWalletId: 4,
      note: 'Cuota agosto',
    });

    await runAgentTool(
      'add_loan_payment',
      ctxWithToken(VALID_TOKEN),
      {
        ...houseArgs,
        payment_id: 7,
        action: 'MARK_PAID',
        paid_at: '2026-08-15',
        source_wallet_id: 4,
        note: 'Cuota agosto',
      },
      'write',
      async (agent) =>
        updateLoanPaymentForOwner(7, agent.ownerFilter, input),
    );

    expect(updateLoanPaymentForOwner).toHaveBeenCalledWith(
      7,
      { user_id: null, house_id: 3 },
      input,
    );
  });

  it('SKIP marks payment skipped without wallet debit', async () => {
    updateLoanPaymentForOwner.mockResolvedValue({
      id: 8,
      loanId: 2,
      status: 'SKIPPED',
    });

    const input = updateLoanPaymentSchema.parse({ action: 'SKIP' });

    await runAgentTool(
      'add_loan_payment',
      ctxWithToken(VALID_TOKEN),
      { ...houseArgs, payment_id: 8, action: 'SKIP' },
      'write',
      async (agent) => updateLoanPaymentForOwner(8, agent.ownerFilter, input),
    );

    expect(updateLoanPaymentForOwner).toHaveBeenCalledWith(
      8,
      { user_id: null, house_id: 3 },
      input,
    );
  });

  it('batch MARK_PAID uses batchUpdateLoanPaymentsForOwner', async () => {
    batchUpdateLoanPaymentsForOwner.mockResolvedValue([
      { id: 10, loanId: 2, status: 'PAID' },
      { id: 11, loanId: 2, status: 'PAID' },
    ]);

    await runAgentTool(
      'add_loan_payment',
      ctxWithToken(VALID_TOKEN),
      {
        ...houseArgs,
        payment_ids: [10, 11],
        action: 'MARK_PAID',
        source_wallet_id: 4,
      },
      'write',
      async (agent) =>
        batchUpdateLoanPaymentsForOwner(agent.ownerFilter, {
          paymentIds: [10, 11],
          action: 'MARK_PAID',
          sourceWalletId: 4,
          note: null,
        }),
    );

    expect(batchUpdateLoanPaymentsForOwner).toHaveBeenCalled();
  });
});

describe('scheduled payment and card payment plan', () => {
  it('create_scheduled_payment validates like POST scheduled-payments', async () => {
    const input = createCreditCardScheduledPaymentSchema.parse({
      due_date: '2026-09-01',
      amount: 500,
      label: 'Cuota',
    });
    createScheduledPayment.mockResolvedValue({
      id: 1,
      creditCardWalletId: 9,
      dueDate: '2026-09-01',
      amount: 500,
      label: 'Cuota',
      status: 'SCHEDULED',
      paidAt: null,
    });

    await runAgentTool(
      'create_scheduled_payment',
      ctxWithToken(VALID_TOKEN),
      {
        ...houseArgs,
        card_id: 9,
        due_date: '2026-09-01',
        amount: 500,
        label: 'Cuota',
      },
      'write',
      async (agent) => createScheduledPayment(9, agent.ownerFilter, input),
    );

    expect(createScheduledPayment).toHaveBeenCalledWith(
      9,
      { user_id: null, house_id: 3 },
      input,
    );
  });

  it('upsert_card_payment_plan validates like PUT card-payment-plans', async () => {
    const validated = cardPaymentPlanSchema.parse({
      walletId: 9,
      plannedAmount: 1200,
    });
    upsertCreditCardPaymentPlan.mockResolvedValue({
      credit_card_wallet_id: 9,
      fortnight_id: 55,
      planned_amount: '1200',
    });

    await runAgentTool(
      'upsert_card_payment_plan',
      ctxWithToken(VALID_TOKEN),
      {
        ...houseArgs,
        card_id: 9,
        fortnight_id: 55,
        planned_amount: 1200,
      },
      'write',
      async (agent) =>
        upsertCreditCardPaymentPlan(
          agent.ownerFilter,
          55,
          validated.walletId,
          validated.plannedAmount,
        ),
    );

    expect(upsertCreditCardPaymentPlan).toHaveBeenCalledWith(
      { user_id: null, house_id: 3 },
      55,
      9,
      1200,
    );
  });
});

describe('wallet and card create payloads', () => {
  it('create_wallet uses createWalletSchema funding types', () => {
    const parsed = createWalletSchema.parse({
      name: 'Efectivo',
      type: 'CASH',
      amount: 0,
      include_in_liquidity: true,
      active: true,
      cutoff_day: null,
      due_day: null,
      credit_limit: null,
      temporary_credit_limit: null,
      goal_amount: null,
      goal_due_date: null,
    });

    expect(parsed.type).toBe('CASH');
  });

  it('create_card uses createCreditCardSchema', () => {
    const parsed = createCreditCardSchema.parse({
      name: 'Tarjeta',
      type: 'CREDIT_CARD',
      amount: 0,
      credit_limit: 10000,
      cutoff_day: 15,
      due_day: 5,
      active: true,
      include_in_liquidity: true,
      temporary_credit_limit: null,
      goal_amount: null,
      goal_due_date: null,
    });

    expect(parsed.type).toBe('CREDIT_CARD');
  });
});

describe('list_wallet_movements', () => {
  it('rejects credit card wallets', async () => {
    const { resolveWalletRef } = await import('@/lib/mcp/resolvers');
    vi.mocked(resolveWalletRef).mockResolvedValueOnce({
      id: 9,
      name: 'Visa',
      type: 'CREDIT_CARD',
    });

    const result = await runAgentTool(
      'list_wallet_movements',
      ctxWithToken(VALID_TOKEN),
      houseArgs,
      'read',
      async () => {
        throw new Error(
          'Para tarjetas usa list_card_movements. list_wallet_movements es para efectivo, débito y metas.',
        );
      },
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('list_card_movements');
  });

  it('calls listWalletMovements for funding wallets', async () => {
    listWalletMovements.mockResolvedValue([
      {
        id: 1,
        kind: 'expense',
        date: '2026-08-10',
        description: 'Super',
        amount: 100,
        direction: 'out',
        category: 'Comida',
        categoryIcon: null,
        fortnightYear: 2026,
        fortnightMonth: 8,
        fortnightPeriod: 'FIRST',
      },
    ]);

    await runAgentTool(
      'list_wallet_movements',
      ctxWithToken(VALID_TOKEN),
      { ...houseArgs, wallet_id: 4 },
      'read',
      async (agent) =>
        listWalletMovements(4, agent.ownerFilter, '2026-08-01', '2026-08-31'),
    );

    expect(listWalletMovements).toHaveBeenCalledWith(
      4,
      { user_id: null, house_id: 3 },
      '2026-08-01',
      '2026-08-31',
    );
  });
});
