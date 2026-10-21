import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashSync } from 'bcryptjs';
import type { McpServer } from '@modelcontextprotocol/server';
import { registerHouseTools } from '@/lib/mcp/tools/houses';
import { registerCategoryTools } from '@/lib/mcp/tools/categories';
import { registerBudgetTools } from '@/lib/mcp/tools/budgets';
import { registerReportTools } from '@/lib/mcp/tools/reports';
import { registerCreditCardTools } from '@/lib/mcp/tools/credit-cards';
import { registerDeleteTools } from '@/lib/mcp/tools/delete';
import type { McpToolContext } from '@/lib/mcp/tool-helpers';

const {
  findUniqueApiKey,
  updateApiKey,
  findFirstMembership,
  findManyAllowedContexts,
  findManyHouseMembers,
  categoryFindMany,
  categoryCreate,
  categoryFindFirst,
  categoryUpdate,
  categoryDelete,
  categoryCount,
  budgetFindFirst,
  updateBudgetAllocations,
  updateBudgetTemplate,
  createBudget,
  createUserToHouseTransfer,
  findFortnightByCalendarPeriod,
  getReportSummary,
  getAlerts,
  getCreditCardReconciliationReport,
  getCreditCardStatementByOwner,
  resolveCategoryRef,
  resolveWalletRef,
  userFindUnique,
  houseFindUnique,
  fortnightFindUnique,
  walletFindUnique,
  getCreditCardByOwner,
} = vi.hoisted(() => ({
  findUniqueApiKey: vi.fn(),
  updateApiKey: vi.fn(),
  findFirstMembership: vi.fn(),
  findManyAllowedContexts: vi.fn(),
  findManyHouseMembers: vi.fn(),
  categoryFindMany: vi.fn(),
  categoryCreate: vi.fn(),
  categoryFindFirst: vi.fn(),
  categoryUpdate: vi.fn(),
  categoryDelete: vi.fn(),
  categoryCount: vi.fn(),
  budgetFindFirst: vi.fn(),
  updateBudgetAllocations: vi.fn(),
  updateBudgetTemplate: vi.fn(),
  createBudget: vi.fn(),
  createUserToHouseTransfer: vi.fn(),
  findFortnightByCalendarPeriod: vi.fn(),
  getReportSummary: vi.fn(),
  getAlerts: vi.fn(),
  getCreditCardReconciliationReport: vi.fn(),
  getCreditCardStatementByOwner: vi.fn(),
  resolveCategoryRef: vi.fn(),
  resolveWalletRef: vi.fn(),
  userFindUnique: vi.fn(),
  houseFindUnique: vi.fn(),
  fortnightFindUnique: vi.fn(),
  walletFindUnique: vi.fn(),
  getCreditCardByOwner: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    apiKey: { findUnique: findUniqueApiKey, update: updateApiKey },
    houseMember: {
      findFirst: findFirstMembership,
      findMany: findManyHouseMembers,
    },
    agentConnectionAllowedContext: { findMany: findManyAllowedContexts },
    category: {
      findMany: categoryFindMany,
      create: categoryCreate,
      findFirst: categoryFindFirst,
      update: categoryUpdate,
      delete: categoryDelete,
      count: categoryCount,
    },
    budget: { findFirst: budgetFindFirst },
    user: { findUnique: userFindUnique },
    house: { findUnique: houseFindUnique },
    fortnight: { findUnique: fortnightFindUnique },
    wallet: { findUnique: walletFindUnique },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({})),
  },
}));

vi.mock('@/lib/finance/budget.service', () => ({
  createBudget,
  deleteBudget: vi.fn(),
  updateBudgetTemplate,
  updateBudgetAllocations,
}));

vi.mock('@/lib/finance/transfer.service', () => ({
  createUserToHouseTransfer,
}));

vi.mock('@/lib/finance/report-summary.service', () => ({
  getReportSummary,
}));

vi.mock('@/features/alerts/server/alerts.service', () => ({
  getAlerts,
}));

vi.mock('@/lib/finance/credit-card-reconciliation.service', () => ({
  getCreditCardReconciliationReport,
}));

vi.mock('@/lib/finance/credit-card-statement.service', () => ({
  getCreditCardStatementByOwner,
}));

vi.mock('@/lib/finance/credit-card.service', () => ({
  createCreditCardForOwner: vi.fn(),
  createCreditCardPayment: vi.fn(),
  createCreditCardPurchase: vi.fn(),
  getCreditCardByOwner,
  listCreditCardsByOwner: vi.fn(),
  updateCreditCardForOwner: vi.fn(),
}));

vi.mock('@/lib/finance/credit-card-scheduled-payment.service', () => ({
  createScheduledPayment: vi.fn(),
  deleteScheduledPayment: vi.fn(),
  listScheduledPaymentsForCard: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/finance/credit-card-payment-plan.service', () => ({
  upsertCreditCardPaymentPlan: vi.fn(),
}));

vi.mock('@/lib/finance/credit-card-installment-plan.service', () => ({
  createInstallmentPlan: vi.fn(),
  listInstallmentPlansForCard: vi.fn().mockResolvedValue([]),
  updateInstallmentPlan: vi.fn(),
}));

vi.mock('@/lib/finance/category-seed.service', () => ({
  seedDefaultExpenseCategoriesForOwner: vi.fn(),
  seedDefaultIncomeCategoriesForOwner: vi.fn(),
}));

vi.mock('@/lib/finance/category.service', () => ({
  assertValidParentForCreate: vi.fn(),
  findDuplicateCategoryName: vi.fn(),
  assertCategoryDeletable: vi.fn(),
  deactivateCategoryTree: vi.fn(),
  activateCategory: vi.fn(),
  categoryOwnerWhere: vi.fn(() => ({})),
  CategoryServiceError: class CategoryServiceError extends Error {
    status = 409;
  },
}));

vi.mock('@/features/monthly/server/monthly.queries', () => ({
  findFortnightByCalendarPeriod,
}));

vi.mock('@/lib/mcp/resolvers', () => ({
  resolveCategoryRef,
  resolveWalletRef,
  resolveDateRange: vi.fn(),
  resolveFortnightIdForDate: vi.fn(),
  calendarRangeBounds: vi.fn(),
}));

vi.mock('@/lib/server/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({
    limited: false,
    retryAfterSeconds: 0,
    remaining: 120,
  }),
}));

type ToolHandler = (
  args: Record<string, unknown>,
  ctx: McpToolContext,
) => Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }>;

const registeredTools = new Map<string, ToolHandler>();

const testServer = {
  registerTool: (name: string, _config: unknown, handler: ToolHandler) => {
    registeredTools.set(name, handler);
  },
} as unknown as McpServer;

const VALID_TOKEN = 'micasa_secreto-de-prueba-suficientemente-largo';
const VALID_HASH = hashSync(VALID_TOKEN, 4);

const writeApiKey = {
  id: 10,
  key_hash: VALID_HASH,
  revoked_at: null,
  scopes: ['read', 'write'],
  user: { id: 2, active: true },
};

const houseArgs = { owner_type: 'house' as const, owner_id: 42 };
const userArgs = { owner_type: 'user' as const, owner_id: 2 };

const ctxWithToken = (token?: string) => ({
  http: {
    req: new Request('http://localhost/api/mcp', {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }),
  },
});

const invokeTool = async (name: string, args: Record<string, unknown>) => {
  const handler = registeredTools.get(name);
  if (!handler) {
    throw new Error(`Tool not registered: ${name}`);
  }
  return handler(args, ctxWithToken(VALID_TOKEN));
};

const parseResult = (result: Awaited<ReturnType<typeof invokeTool>>) =>
  JSON.parse(result.content[0].text);

beforeEach(() => {
  vi.clearAllMocks();
  registeredTools.clear();
  registerHouseTools(testServer);
  registerCategoryTools(testServer);
  registerBudgetTools(testServer);
  registerReportTools(testServer);
  registerCreditCardTools(testServer);
  registerDeleteTools(testServer);

  updateApiKey.mockResolvedValue({});
  findUniqueApiKey.mockResolvedValue(writeApiKey);
  findFirstMembership.mockResolvedValue({ role: 'OWNER' });
  findManyAllowedContexts.mockResolvedValue([
    { owner_type: 'USER', owner_id: 2 },
    { owner_type: 'HOUSE', owner_id: 42 },
  ]);
  resolveCategoryRef.mockResolvedValue(10);
  resolveWalletRef.mockResolvedValue({ id: 4, name: 'Efectivo', type: 'CASH' });
  userFindUnique.mockResolvedValue({ id: 2, active: true });
  houseFindUnique.mockResolvedValue({ id: 42 });
  fortnightFindUnique.mockImplementation(({ where }: { where: { id: number } }) => {
    if (where.id === 10) {
      return Promise.resolve({ id: 10, user_id: 2, house_id: null });
    }
    if (where.id === 20) {
      return Promise.resolve({ id: 20, user_id: null, house_id: 42 });
    }
    return Promise.resolve(null);
  });
});

describe('registered MCP P2 tools auth fail-closed', () => {
  it('get_alerts rejects empty allow-list', async () => {
    findManyAllowedContexts.mockResolvedValue([]);

    const result = await invokeTool('get_alerts', houseArgs);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('contextos autorizados');
    expect(getAlerts).not.toHaveBeenCalled();
  });

  it('list_houses with an empty allow-list lists no house and no members', async () => {
    findManyAllowedContexts.mockResolvedValue([]);
    findManyHouseMembers.mockResolvedValue([
      { house_id: 42, role: 'OWNER', house: { id: 42, name: 'Casa' } },
    ]);

    const result = await invokeTool('list_houses', { include_members: true });

    expect(result.isError).toBeFalsy();
    expect(parseResult(result)).toMatchObject({ personalContext: null, houses: [] });
  });

  it('create_category requires write scope', async () => {
    findUniqueApiKey.mockResolvedValue({ ...writeApiKey, scopes: ['read'] });

    const result = await invokeTool('create_category', {
      ...houseArgs,
      name: 'Nueva',
      kind: 'EXPENSE',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('scope \\"write\\"');
    expect(categoryCreate).not.toHaveBeenCalled();
  });

  it('transfer_to_house requires write scope', async () => {
    findUniqueApiKey.mockResolvedValue({ ...writeApiKey, scopes: ['read'] });

    const result = await invokeTool('transfer_to_house', {
      ...userArgs,
      house_id: 42,
      amount: 100,
      user_fortnight_id: 1,
      house_fortnight_id: 2,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('scope \\"write\\"');
    expect(createUserToHouseTransfer).not.toHaveBeenCalled();
  });
});

describe('registered list_houses with include_members', () => {
  it('returns members only for allowed houses', async () => {
    findManyHouseMembers.mockImplementation(({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve(
        'user_id' in where
          ? [
              { house_id: 42, role: 'OWNER', house: { id: 42, name: 'Casa' } },
              { house_id: 77, role: 'MEMBER', house: { id: 77, name: 'Otra' } },
            ]
          : [
              { house_id: 42, user: { id: 2, name: 'Usuario A' } },
              { house_id: 42, user: { id: 5, name: 'Usuario B' } },
            ],
      ),
    );

    const result = await invokeTool('list_houses', { include_members: true });

    expect(result.isError).toBeFalsy();
    expect(findManyHouseMembers).toHaveBeenCalledWith({
      where: { house_id: { in: [42] } },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { user: { name: 'asc' } },
    });
    const { houses } = parseResult(result);
    expect(houses).toHaveLength(1);
    expect(houses[0]).toMatchObject({ ownerId: 42 });
    expect(houses[0].members).toEqual([
      { user_id: 2, name: 'Usuario A' },
      { user_id: 5, name: 'Usuario B' },
    ]);
  });

  it('skips the members query by default', async () => {
    findManyHouseMembers.mockResolvedValue([
      { house_id: 42, role: 'OWNER', house: { id: 42, name: 'Casa' } },
    ]);

    const result = await invokeTool('list_houses', {});

    expect(result.isError).toBeFalsy();
    expect(findManyHouseMembers).toHaveBeenCalledTimes(1);
    expect(parseResult(result).houses[0].members).toBeUndefined();
  });
});

describe('registered category tools', () => {
  it('create_category persists category', async () => {
    categoryCount.mockResolvedValue(0);
    categoryCreate.mockResolvedValue({
      id: 11,
      name: 'Ocio',
      description: null,
      icon: null,
      active: true,
      sort_order: 0,
      parent_id: null,
      kind: 'EXPENSE',
    });

    const result = await invokeTool('create_category', {
      ...houseArgs,
      name: 'Ocio',
      kind: 'EXPENSE',
    });

    expect(result.isError).toBeFalsy();
    expect(categoryCreate).toHaveBeenCalled();
    expect(parseResult(result)).toMatchObject({ id: 11, name: 'Ocio', kind: 'EXPENSE' });
  });

  it('delete (category) requires owned category before delete', async () => {
    categoryFindFirst.mockResolvedValue({
      id: 11,
      name: 'Ocio',
      kind: 'EXPENSE',
    });
    const { assertCategoryDeletable } = await import('@/lib/finance/category.service');
    vi.mocked(assertCategoryDeletable).mockResolvedValue(undefined);

    const result = await invokeTool('delete', {
      ...houseArgs,
      kind: 'category',
      id: 11,
      confirm: true,
    });

    expect(result.isError).toBeFalsy();
    expect(categoryFindFirst).toHaveBeenCalled();
    expect(categoryDelete).toHaveBeenCalledWith({ where: { id: 11 } });
  });

  it('delete (category) rejects missing owner-scoped category', async () => {
    categoryFindFirst.mockResolvedValue(null);

    const result = await invokeTool('delete', {
      ...houseArgs,
      kind: 'category',
      id: 11,
      confirm: true,
    });

    expect(result.isError).toBe(true);
    expect(parseResult(result)).toMatchObject({ code: 'NOT_FOUND' });
    expect(categoryDelete).not.toHaveBeenCalled();
  });
});

describe('registered budget allocation tools', () => {
  it('upsert_budget with budget_id + allocations replaces rows and keeps name/amount', async () => {
    budgetFindFirst.mockResolvedValue({
      id: 7,
      name: 'Despensa',
      total_amount: '300',
      frequency: 'BIWEEKLY',
      recurrent: true,
      start_date: null,
      end_date: null,
    });
    updateBudgetAllocations.mockResolvedValue({ id: 7 });
    resolveCategoryRef
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(11);

    const result = await invokeTool('upsert_budget', {
      ...houseArgs,
      budget_id: 7,
      allocations: [
        { wallet_id: 4, category_id: 10, amount: 200 },
        { wallet_id: 4, category_id: 11, amount: 100 },
      ],
    });

    expect(result.isError).toBeFalsy();
    expect(updateBudgetAllocations).toHaveBeenCalledWith(7, expect.any(Object), [
      { wallet_id: 4, category_id: 10, amount: 200 },
      { wallet_id: 4, category_id: 11, amount: 100 },
    ]);
    expect(updateBudgetTemplate).toHaveBeenCalledWith(
      7,
      expect.any(Object),
      expect.objectContaining({ name: 'Despensa', allocated_amount: 300 }),
    );
    expect(parseResult(result)).toMatchObject({ budget_id: 7, updated: true });
  });

  it('upsert_budget rejects allocations that do not add up to the budget total', async () => {
    budgetFindFirst.mockResolvedValue({ id: 7, name: 'Despensa', total_amount: '300' });

    const result = await invokeTool('upsert_budget', {
      ...houseArgs,
      budget_id: 7,
      allocations: [{ category_id: 10, amount: 200 }],
    });

    expect(result.isError).toBe(true);
    expect(parseResult(result)).toMatchObject({ code: 'VALIDATION' });
    expect(updateBudgetAllocations).not.toHaveBeenCalled();
  });

  it('upsert_budget without budget_id needs name and amount', async () => {
    const result = await invokeTool('upsert_budget', { ...houseArgs, category_id: 10 });

    expect(result.isError).toBe(true);
    expect(createBudget).not.toHaveBeenCalled();
  });

  it('upsert_budget omits the wallet for Cualquier cartera', async () => {
    budgetFindFirst.mockResolvedValue(null);
    createBudget.mockResolvedValue({ id: 15 });

    const result = await invokeTool('upsert_budget', {
      ...houseArgs,
      name: 'Despensa',
      amount: 300,
      category_id: 10,
    });

    expect(result.isError).toBeFalsy();
    expect(resolveWalletRef).not.toHaveBeenCalled();
    expect(createBudget).toHaveBeenCalledWith(
      'house',
      42,
      expect.objectContaining({
        allocations: [{ wallet_id: null, category_id: 10, amount: 300 }],
      }),
    );
  });
});

describe('registered report tools', () => {
  it('get_period_summary delegates to report service', async () => {
    getReportSummary.mockResolvedValue({ totalIncome: 1000, totalExpense: 500 });

    const result = await invokeTool('get_period_summary', {
      ...houseArgs,
      year: 2026,
      month: 8,
      period: 'FIRST',
    });

    expect(result.isError).toBeFalsy();
    expect(getReportSummary).toHaveBeenCalled();
    expect(parseResult(result)).toMatchObject({ totalIncome: 1000 });
  });

  it('get_alerts delegates to alerts service', async () => {
    getAlerts.mockResolvedValue({ period: { year: 2026, month: 8, period: 'FIRST' }, alerts: [] });

    const result = await invokeTool('get_alerts', houseArgs);

    expect(result.isError).toBeFalsy();
    expect(getAlerts).toHaveBeenCalled();
  });
});

describe('registered transfer_to_house', () => {
  it('creates USER_TO_HOUSE transfer from personal context', async () => {
    createUserToHouseTransfer.mockResolvedValue({
      id: 99,
      amount: '150',
      user_id: 2,
      house_id: 42,
      user_expense_id: 501,
      house_income_id: 601,
      created_at: new Date('2026-08-01T12:00:00.000Z'),
    });

    const result = await invokeTool('transfer_to_house', {
      ...userArgs,
      house_id: 42,
      amount: 150,
      user_fortnight_id: 10,
      house_fortnight_id: 20,
    });

    expect(result.isError).toBeFalsy();
    expect(createUserToHouseTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 2,
        houseId: 42,
        amount: 150,
        userFortnightId: 10,
        houseFortnightId: 20,
      }),
    );
    expect(parseResult(result)).toMatchObject({ transfer_id: 99, amount: 150 });
  });

  it('rejects house context when personal account is not on allow-list', async () => {
    findManyAllowedContexts.mockResolvedValue([{ owner_type: 'HOUSE', owner_id: 42 }]);

    const result = await invokeTool('transfer_to_house', {
      ...houseArgs,
      house_id: 42,
      amount: 150,
      user_fortnight_id: 10,
      house_fortnight_id: 20,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('cuenta personal');
    expect(createUserToHouseTransfer).not.toHaveBeenCalled();
  });

  it('rejects invalid personal fortnight ids', async () => {
    fortnightFindUnique.mockImplementation(({ where }: { where: { id: number } }) => {
      if (where.id === 10) {
        return Promise.resolve({ id: 10, user_id: 99, house_id: null });
      }
      if (where.id === 20) {
        return Promise.resolve({ id: 20, user_id: null, house_id: 42 });
      }
      return Promise.resolve(null);
    });

    const result = await invokeTool('transfer_to_house', {
      ...userArgs,
      house_id: 42,
      amount: 150,
      user_fortnight_id: 10,
      house_fortnight_id: 20,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Quincena personal inválida');
    expect(createUserToHouseTransfer).not.toHaveBeenCalled();
  });
});

describe('registered card reconciliation tools', () => {
  it('get_card include reconciliation returns the card report', async () => {
    getCreditCardByOwner.mockResolvedValue({ id: 8, name: 'Tarjeta prueba', amount: 900 });
    getCreditCardReconciliationReport.mockResolvedValue({
      issues: [],
      summary: { total: 0, repairable: 0, byKind: {} },
    });

    const result = await invokeTool('get_card', {
      ...houseArgs,
      card_id: 8,
      include: ['reconciliation'],
    });

    expect(result.isError).toBeFalsy();
    expect(getCreditCardReconciliationReport).toHaveBeenCalledWith(
      { user_id: null, house_id: 42 },
      8,
    );
    expect(getCreditCardStatementByOwner).not.toHaveBeenCalled();
    expect(parseResult(result)).toMatchObject({
      card: { id: 8, debt: 900 },
      reconciliation: { summary: { total: 0 } },
    });
  });

  it('get_card include installments builds MSI exposure', async () => {
    getCreditCardByOwner.mockResolvedValue({ id: 8, name: 'Tarjeta prueba', amount: 900 });
    getCreditCardStatementByOwner.mockResolvedValue({
      name: 'Tarjeta prueba',
      installment_active_purchases: [
        {
          id: 1,
          description: 'Compra MSI',
          amount: 500,
          payment_date: '2026-08-01',
          credit_installment_current: 2,
          credit_installment_total: 6,
        },
      ],
    });

    const result = await invokeTool('get_card', {
      ...houseArgs,
      card_id: 8,
      include: ['installments'],
    });

    expect(result.isError).toBeFalsy();
    expect(parseResult(result)).toMatchObject({
      installment_plans: [],
      scheduled_payments: [],
      installment_portfolio: { item_count: 1, total_exposure: 2000 },
    });
    expect(parseResult(result).statement).toBeUndefined();
  });
});
