import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthInfo } from '@modelcontextprotocol/server';

/**
 * Parity: the REST route and the MCP tool reach the same service, so the same
 * input produces the same row. Prisma is mocked at the data level and the
 * `create` payloads of both callers are compared.
 */

const db = vi.hoisted(() => ({
  expenseTemplateCreate: vi.fn(),
  incomeTemplateCreate: vi.fn(),
  categoryCreate: vi.fn(),
  categoryCount: vi.fn(),
  categoryFindFirst: vi.fn(),
  walletFindFirst: vi.fn(),
  houseMemberFindFirst: vi.fn(),
  allowedContextsFindMany: vi.fn(),
  getOwnerContext: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    expenseTemplate: { create: db.expenseTemplateCreate },
    incomeTemplate: { create: db.incomeTemplateCreate },
    category: {
      create: db.categoryCreate,
      count: db.categoryCount,
      findFirst: db.categoryFindFirst,
    },
    wallet: { findFirst: db.walletFindFirst },
    houseMember: { findFirst: db.houseMemberFindFirst },
    agentConnectionAllowedContext: { findMany: db.allowedContextsFindMany },
  },
}));

vi.mock('@/lib/server/get-owner-context', () => ({ getOwnerContext: db.getOwnerContext }));

import { POST as postExpenseTemplate } from '@/app/api/expense-templates/route';
import { POST as postIncomeTemplate } from '@/app/api/income-templates/route';
import { POST as postCategory } from '@/app/api/categories/route';
import { registerTemplateTools } from '@/lib/mcp/tools/templates';
import { registerCategoryTools } from '@/lib/mcp/tools/categories';
import { connectInMemoryMcp } from '@/lib/mcp/testing/in-memory-client';

const HOUSE = { owner_type: 'house' as const, owner_id: 42 };

const houseContext = {
  userId: 2,
  ownerType: 'house' as const,
  ownerId: 42,
  ownerFilter: { user_id: null, house_id: 42 },
  role: 'owner' as const,
};

const authInfo: AuthInfo = {
  token: 'micasa_token-verificado',
  clientId: 'api-key:10',
  scopes: ['read', 'write'],
  extra: {
    micasa_agent: {
      userId: 2,
      scopes: ['read', 'write'],
      authSource: 'api_key',
      apiKeyId: 10,
      rateLimitIdentity: 10,
    },
  },
};

const jsonRequest = (url: string, body: unknown) =>
  new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as Parameters<typeof postCategory>[0];

const connect = () =>
  connectInMemoryMcp(
    (server) => {
      registerTemplateTools(server);
      registerCategoryTools(server);
    },
    { authInfo },
  );

const lastData = (mock: ReturnType<typeof vi.fn>) => mock.mock.lastCall?.[0]?.data;

beforeEach(() => {
  vi.clearAllMocks();
  db.getOwnerContext.mockResolvedValue(houseContext);
  db.houseMemberFindFirst.mockResolvedValue({ role: 'OWNER' });
  db.allowedContextsFindMany.mockResolvedValue([{ owner_type: 'HOUSE', owner_id: 42 }]);
  db.categoryFindFirst.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
    // Owned category lookups by id succeed; duplicate-name lookups find nothing.
    'id' in where ? { id: where.id, kind: where.kind ?? 'EXPENSE', parent_id: null } : null,
  );
  db.walletFindFirst.mockResolvedValue({ id: 4, name: 'Efectivo', type: 'CASH' });
  db.categoryCount.mockResolvedValue(3);
  db.expenseTemplateCreate.mockResolvedValue({ id: 1, name: 'Renta', category: null, wallet: null });
  db.incomeTemplateCreate.mockResolvedValue({ id: 2, name: 'Salario', category: null, user: null });
  db.categoryCreate.mockResolvedValue({ id: 11, name: 'Ocio', kind: 'EXPENSE' });
});

describe('REST ↔ MCP parity', () => {
  it('expense template: POST /api/expense-templates and create_template write the same row', async () => {
    const rest = await postExpenseTemplate(
      jsonRequest('http://localhost/api/expense-templates', {
        name: 'Renta',
        categoryId: 10,
        suggestedAmount: 1500,
        paymentMethodId: 4,
        active: true,
        dueDayFirst: 5,
        dueDaySecond: null,
        cutoffDay: null,
        isRecurring: true,
        appliesFirstFortnight: true,
        appliesSecondFortnight: false,
        isSubscription: false,
      }),
    );
    expect(rest.status).toBe(201);
    const restData = lastData(db.expenseTemplateCreate);

    const client = await connect();
    const mcp = await client.callTool('create_template', {
      ...HOUSE,
      kind: 'expense',
      name: 'Renta',
      category_id: 10,
      wallet_id: 4,
      suggested_amount: 1500,
      due_day_first: 5,
      applies_first_fortnight: true,
    });
    await client.close();

    expect(mcp.isError).toBeUndefined();
    expect(lastData(db.expenseTemplateCreate)).toEqual(restData);
    expect(restData).toMatchObject({
      name: 'Renta',
      category_id: 10,
      wallet_id: 4,
      due_day_first_fortnight: 5,
      due_day: 5,
      house_id: 42,
      user_id: null,
    });
  });

  it('income template: POST /api/income-templates and create_template write the same row', async () => {
    db.categoryFindFirst.mockResolvedValue({ id: 20, kind: 'INCOME', active: true });

    const rest = await postIncomeTemplate(
      jsonRequest('http://localhost/api/income-templates', {
        name: 'Salario',
        categoryId: 20,
        suggestedAmount: 5000,
        source: 'Nómina',
        walletId: 4,
        appliesFirstFortnight: true,
        appliesSecondFortnight: true,
        active: true,
      }),
    );
    expect(rest.status).toBe(201);
    const restData = lastData(db.incomeTemplateCreate);

    const client = await connect();
    const mcp = await client.callTool('create_template', {
      ...HOUSE,
      kind: 'income',
      name: 'Salario',
      category_id: 20,
      wallet_id: 4,
      suggested_amount: 5000,
      source: 'Nómina',
      applies_first_fortnight: true,
      applies_second_fortnight: true,
    });
    await client.close();

    expect(mcp.isError).toBeUndefined();
    expect(lastData(db.incomeTemplateCreate)).toEqual(restData);
    expect(restData).toMatchObject({ wallet_id: 4, source: 'Nómina', house_id: 42 });
  });

  it('category: POST /api/categories and create_category write the same row', async () => {
    const rest = await postCategory(
      jsonRequest('http://localhost/api/categories', { name: 'Ocio', kind: 'EXPENSE' }),
    );
    expect(rest.status).toBe(201);
    const restData = lastData(db.categoryCreate);

    const client = await connect();
    const mcp = await client.callTool('create_category', { ...HOUSE, name: 'Ocio', kind: 'EXPENSE' });
    await client.close();

    expect(mcp.isError).toBeUndefined();
    expect(lastData(db.categoryCreate)).toEqual(restData);
    expect(restData).toMatchObject({ name: 'Ocio', sort_order: 3, house_id: 42, user_id: null });
  });

  it('category: a duplicate name is rejected the same way by both callers', async () => {
    db.categoryFindFirst.mockResolvedValue({ id: 99, name: 'Ocio' });

    const rest = await postCategory(
      jsonRequest('http://localhost/api/categories', { name: 'Ocio', kind: 'EXPENSE' }),
    );
    const client = await connect();
    const mcp = await client.callTool('create_category', { ...HOUSE, name: 'Ocio', kind: 'EXPENSE' });
    await client.close();

    expect(rest.status).toBe(409);
    expect(await rest.json()).toEqual({ error: 'Ya existe una categoría con este nombre' });
    expect(JSON.parse(mcp.content[0]!.text)).toEqual({
      error: 'Ya existe una categoría con este nombre',
      code: 'VALIDATION',
    });
    expect(db.categoryCreate).not.toHaveBeenCalled();
  });
});
