import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashSync } from 'bcryptjs';
import type { McpServer } from '@modelcontextprotocol/server';
import { registerHouseTools } from '@/lib/mcp/tools/houses';
import { registerCategoryTools } from '@/lib/mcp/tools/categories';
import { registerBudgetTools } from '@/lib/mcp/tools/budgets';
import { registerReportTools } from '@/lib/mcp/tools/reports';
import { registerCreditCardTools } from '@/lib/mcp/tools/credit-cards';
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
  getCreditCardByOwner: vi.fn(),
  listCreditCardsByOwner: vi.fn(),
  updateCreditCardForOwner: vi.fn(),
}));

vi.mock('@/lib/finance/credit-card-scheduled-payment.service', () => ({
  createScheduledPayment: vi.fn(),
  deleteScheduledPayment: vi.fn(),
  listScheduledPaymentsForCard: vi.fn(),
}));

vi.mock('@/lib/finance/credit-card-payment-plan.service', () => ({
  upsertCreditCardPaymentPlan: vi.fn(),
}));

vi.mock('@/lib/finance/credit-card-installment-plan.service', () => ({
  createInstallmentPlan: vi.fn(),
  listInstallmentPlansForCard: vi.fn(),
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

const houseArgs = { ownerType: 'house' as const, ownerId: 3 };
const userArgs = { ownerType: 'user' as const, ownerId: 2 };

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

  updateApiKey.mockResolvedValue({});
  findUniqueApiKey.mockResolvedValue(writeApiKey);
  findFirstMembership.mockResolvedValue({ role: 'OWNER' });
  findManyAllowedContexts.mockResolvedValue([
    { owner_type: 'USER', owner_id: 2 },
    { owner_type: 'HOUSE', owner_id: 3 },
  ]);
  resolveCategoryRef.mockResolvedValue(10);
  resolveWalletRef.mockResolvedValue({ id: 4, name: 'Efectivo', type: 'CASH' });
  userFindUnique.mockResolvedValue({ id: 2, active: true });
  houseFindUnique.mockResolvedValue({ id: 3 });
  fortnightFindUnique.mockImplementation(({ where }: { where: { id: number } }) => {
    if (where.id === 10) {
      return Promise.resolve({ id: 10, user_id: 2, house_id: null });
    }
    if (where.id === 20) {
      return Promise.resolve({ id: 20, user_id: null, house_id: 3 });
    }
    return Promise.resolve(null);
  });
});

describe('registered MCP P2 tools auth fail-closed', () => {
  it('list_house_members rejects empty allow-list', async () => {
    findManyAllowedContexts.mockResolvedValue([]);

    const result = await invokeTool('list_house_members', houseArgs);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('contextos autorizados');
    expect(findManyHouseMembers).not.toHaveBeenCalled();
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
      house_id: 3,
      amount: 100,
      user_fortnight_id: 1,
      house_fortnight_id: 2,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('scope \\"write\\"');
    expect(createUserToHouseTransfer).not.toHaveBeenCalled();
  });
});

describe('registered list_house_members', () => {
  it('returns members only for allowed house context', async () => {
    findManyHouseMembers.mockResolvedValue([
      { user: { id: 2, name: 'Usuario A' } },
      { user: { id: 5, name: 'Usuario B' } },
    ]);

    const result = await invokeTool('list_house_members', houseArgs);

    expect(result.isError).toBeFalsy();
    expect(findManyHouseMembers).toHaveBeenCalledWith({
      where: { house_id: 3 },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { user: { name: 'asc' } },
    });
    expect(parseResult(result).members).toHaveLength(2);
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

  it('delete_category requires owned category before delete', async () => {
    categoryFindFirst.mockResolvedValue({
      id: 11,
      name: 'Ocio',
      kind: 'EXPENSE',
    });
    const { assertCategoryDeletable } = await import('@/lib/finance/category.service');
    vi.mocked(assertCategoryDeletable).mockResolvedValue(undefined);

    const result = await invokeTool('delete_category', {
      ...houseArgs,
      category_id: 11,
      confirm: true,
    });

    expect(result.isError).toBeFalsy();
    expect(categoryFindFirst).toHaveBeenCalled();
    expect(categoryDelete).toHaveBeenCalledWith({ where: { id: 11 } });
  });

  it('delete_category rejects missing owner-scoped category', async () => {
    categoryFindFirst.mockResolvedValue(null);

    const result = await invokeTool('delete_category', {
      ...houseArgs,
      category_id: 11,
      confirm: true,
    });

    expect(result.isError).toBe(true);
    expect(categoryDelete).not.toHaveBeenCalled();
  });
});

describe('registered budget allocation tools', () => {
  it('update_budget_allocations replaces rows', async () => {
    budgetFindFirst.mockResolvedValue({ id: 7, total_amount: '300' });
    updateBudgetAllocations.mockResolvedValue({ id: 7 });
    resolveCategoryRef
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(11);

    const result = await invokeTool('update_budget_allocations', {
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
    expect(parseResult(result)).toMatchObject({ budget_id: 7, updated: true });
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
      house_id: 3,
      user_expense_id: 501,
      house_income_id: 601,
      created_at: new Date('2026-08-01T12:00:00.000Z'),
    });

    const result = await invokeTool('transfer_to_house', {
      ...userArgs,
      house_id: 3,
      amount: 150,
      user_fortnight_id: 10,
      house_fortnight_id: 20,
    });

    expect(result.isError).toBeFalsy();
    expect(createUserToHouseTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 2,
        houseId: 3,
        amount: 150,
        userFortnightId: 10,
        houseFortnightId: 20,
      }),
    );
    expect(parseResult(result)).toMatchObject({ transfer_id: 99, amount: 150 });
  });

  it('rejects house context when personal account is not on allow-list', async () => {
    findManyAllowedContexts.mockResolvedValue([{ owner_type: 'HOUSE', owner_id: 3 }]);

    const result = await invokeTool('transfer_to_house', {
      ...houseArgs,
      house_id: 3,
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
        return Promise.resolve({ id: 20, user_id: null, house_id: 3 });
      }
      return Promise.resolve(null);
    });

    const result = await invokeTool('transfer_to_house', {
      ...userArgs,
      house_id: 3,
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
  it('get_card_reconciliation returns report', async () => {
    getCreditCardReconciliationReport.mockResolvedValue({
      issues: [],
      summary: { total: 0, repairable: 0, byKind: {} },
    });

    const result = await invokeTool('get_card_reconciliation', houseArgs);

    expect(result.isError).toBeFalsy();
    expect(getCreditCardReconciliationReport).toHaveBeenCalled();
  });

  it('get_installment_portfolio builds MSI exposure', async () => {
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

    const result = await invokeTool('get_installment_portfolio', {
      ...houseArgs,
      card_id: 8,
    });

    expect(result.isError).toBeFalsy();
    expect(parseResult(result)).toMatchObject({
      card_id: 8,
      item_count: 1,
      total_exposure: 2000,
    });
  });
});
