import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Behavior: catalog and planning write tools (categories, budgets, templates,
 * months) run their real tool code and real finance services against an
 * in-memory Prisma stand-in. Assertions read the resulting rows, not the
 * arguments forwarded to a service.
 */

const db = vi.hoisted(() => {
  type Row = Record<string, unknown> & { id: number };
  type Where = Record<string, unknown> | undefined;

  const TABLES = [
    'category',
    'wallet',
    'budget',
    'budgetAllocation',
    'budgetPeriod',
    'fortnight',
    'expenseTemplate',
    'incomeTemplate',
    'expense',
    'income',
    'user',
  ] as const;
  type TableName = (typeof TABLES)[number];

  const rows = {} as Record<TableName, Row[]>;
  const nextId = {} as Record<TableName, number>;

  const sameValue = (value: unknown, expected: unknown) => {
    if (expected instanceof Date) {
      return value instanceof Date && value.getTime() === expected.getTime();
    }
    return value === expected;
  };

  /** Scalars, null, `in`, `not`, `equals` (+ insensitive) and OR. Ranges / relation filters always match. */
  const matches = (row: Row, where: Where): boolean =>
    Object.entries(where ?? {}).every(([key, cond]) => {
      if (key === 'OR') return (cond as Where[]).some((branch) => matches(row, branch));
      const value = row[key];
      if (cond === null) return value == null;
      if (cond instanceof Date) return sameValue(value, cond);
      if (typeof cond === 'object') {
        const c = cond as Record<string, unknown>;
        if ('in' in c) return (c.in as unknown[]).includes(value);
        if ('not' in c) return c.not === null ? value != null : !sameValue(value, c.not);
        if ('equals' in c) {
          return c.mode === 'insensitive'
            ? String(value).toLowerCase() === String(c.equals).toLowerCase()
            : sameValue(value, c.equals);
        }
        return true;
      }
      return sameValue(value, cond);
    });

  const relation = (table: TableName, row: Row, key: string): unknown => {
    switch (key) {
      case 'category':
        return rows.category.find((c) => c.id === row.category_id) ?? null;
      case 'wallet':
        return rows.wallet.find((w) => w.id === row.wallet_id) ?? null;
      case 'user':
        return rows.user.find((u) => u.id === row.user_id) ?? null;
      case 'expenses':
        return rows.expense.filter((e) => e.expense_template_id === row.id);
      case 'allocations':
        return table === 'budget' ? rows.budgetAllocation.filter((a) => a.budget_id === row.id) : [];
      default:
        return null;
    }
  };

  const shape = (table: TableName, row: Row | undefined, include?: Record<string, unknown>) => {
    if (!row) return null;
    const out: Row = { ...row };
    for (const key of Object.keys(include ?? {})) out[key] = relation(table, row, key);
    return out;
  };

  type Args = { where?: Where; data?: Record<string, unknown>; include?: Record<string, unknown> };

  const model = (table: TableName) => ({
    findFirst: async ({ where, include }: Args = {}) =>
      shape(table, rows[table].find((r) => matches(r, where)), include),
    findUnique: async ({ where, include }: Args = {}) =>
      shape(table, rows[table].find((r) => matches(r, where)), include),
    findUniqueOrThrow: async ({ where, include }: Args = {}) => {
      const found = rows[table].find((r) => matches(r, where));
      if (!found) throw new Error(`${table} not found`);
      return shape(table, found, include);
    },
    findMany: async ({ where, include }: Args = {}) =>
      rows[table].filter((r) => matches(r, where)).map((r) => shape(table, r, include)),
    count: async ({ where }: Args = {}) => rows[table].filter((r) => matches(r, where)).length,
    create: async ({ data, include }: Args) => {
      const row = { ...data, id: nextId[table]++ } as Row;
      rows[table].push(row);
      return shape(table, row, include);
    },
    createMany: async ({ data }: { data: Record<string, unknown>[] }) => {
      for (const item of data) rows[table].push({ ...item, id: nextId[table]++ } as Row);
      return { count: data.length };
    },
    update: async ({ where, data, include }: Args) => {
      const found = rows[table].find((r) => matches(r, where));
      if (!found) throw new Error(`${table} not found`);
      Object.assign(found, data);
      return shape(table, found, include);
    },
    updateMany: async ({ where, data }: Args) => {
      const hit = rows[table].filter((r) => matches(r, where));
      for (const row of hit) Object.assign(row, data);
      return { count: hit.length };
    },
    deleteMany: async ({ where }: Args = {}) => {
      const before = rows[table].length;
      rows[table] = rows[table].filter((r) => !matches(r, where));
      return { count: before - rows[table].length };
    },
  });

  const client: Record<string, unknown> = {
    houseMember: { findFirst: async () => null },
    agentConnectionAllowedContext: { findMany: async () => [] },
  };
  for (const table of TABLES) client[table] = model(table);
  client.$transaction = async (fn: (tx: unknown) => unknown) => fn(client);

  const reset = () => {
    for (const table of TABLES) {
      rows[table] = [];
      nextId[table] = 1000;
    }
  };
  const seed = (table: TableName, ...items: Row[]) => {
    rows[table].push(...items.map((item) => ({ ...item })));
  };

  reset();
  return { client, rows, reset, seed };
});

vi.mock('@/lib/prisma', () => ({ default: db.client }));

import { registerCategoryTools } from '@/lib/mcp/tools/categories';
import { registerBudgetTools } from '@/lib/mcp/tools/budgets';
import { registerTemplateTools } from '@/lib/mcp/tools/templates';
import { registerFortnightTools } from '@/lib/mcp/tools/fortnights';
import { getCanonicalFortnightBounds } from '@/lib/finance/budget-period-windows';
import { formatCalendarDate } from '@/lib/calendar-dates';
import { HOUSE, HOUSE_FILTER, authPrismaMocks, callTool } from './harness';

const OTHER_HOUSE = { user_id: null, house_id: 99 };
const day = (value: unknown) => formatCalendarDate(value as Date);

const octSecond = getCanonicalFortnightBounds(2026, 10, 'SECOND');

beforeEach(() => {
  db.reset();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-20T18:00:00.000Z'));
  (db.client.houseMember as { findFirst: () => Promise<unknown> }).findFirst = async () =>
    authPrismaMocks.membership;
  (db.client.agentConnectionAllowedContext as { findMany: () => Promise<unknown> }).findMany =
    async () => authPrismaMocks.allowedContexts;

  db.seed(
    'wallet',
    { id: 4, name: 'Efectivo', type: 'CASH', ...HOUSE_FILTER },
    { id: 5, name: 'Tarjeta Oro', type: 'CREDIT_CARD', ...HOUSE_FILTER },
    { id: 6, name: 'Efectivo', type: 'CASH', ...OTHER_HOUSE },
  );
  db.seed(
    'category',
    { id: 10, name: 'Hogar', kind: 'EXPENSE', parent_id: null, active: true, sort_order: 0, icon: null, description: null, ...HOUSE_FILTER },
    { id: 11, name: 'Luz', kind: 'EXPENSE', parent_id: 10, active: true, sort_order: 0, icon: null, description: null, ...HOUSE_FILTER },
    { id: 12, name: 'Agua', kind: 'EXPENSE', parent_id: 10, active: true, sort_order: 1, icon: null, description: null, ...HOUSE_FILTER },
    { id: 20, name: 'Súper', kind: 'EXPENSE', parent_id: null, active: true, sort_order: 1, icon: null, description: null, ...HOUSE_FILTER },
    { id: 21, name: 'Farmacia', kind: 'EXPENSE', parent_id: null, active: true, sort_order: 2, icon: null, description: null, ...HOUSE_FILTER },
    { id: 30, name: 'Salario', kind: 'INCOME', parent_id: null, active: true, sort_order: 0, icon: null, description: null, ...HOUSE_FILTER },
    { id: 90, name: 'Hijo ajeno', kind: 'EXPENSE', parent_id: 10, active: true, sort_order: 0, icon: null, description: null, ...OTHER_HOUSE },
  );
  db.seed('user', { id: 2, name: 'Jorge', active: true });
});

afterEach(() => {
  vi.useRealTimers();
});

const category = (id: number) => db.rows.category.find((c) => c.id === id)!;

describe('create_category', () => {
  it('creates a house subcategory appended after its siblings', async () => {
    const result = await callTool(registerCategoryTools, 'create_category', {
      ...HOUSE,
      name: 'Gas',
      parent_id: 10,
      icon: 'HOME',
    });

    expect(result.isError).toBeUndefined();
    const created = db.rows.category.filter((c) => c.name === 'Gas');
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      kind: 'EXPENSE',
      parent_id: 10,
      active: true,
      sort_order: 2,
      icon: 'HOME',
      user_id: null,
      house_id: 42,
    });
    expect(result.body).toMatchObject({
      id: created[0]!.id,
      name: 'Gas',
      parent_id: 10,
      kind: 'EXPENSE',
      active: true,
      sort_order: 2,
    });
  });

  it('a duplicate name of the same kind → VALIDATION and no row', async () => {
    const before = db.rows.category.length;
    const result = await callTool(registerCategoryTools, 'create_category', {
      ...HOUSE,
      name: 'Súper',
    });

    expect(result.isError).toBe(true);
    expect(result.body.code).toBe('VALIDATION');
    expect(db.rows.category).toHaveLength(before);
  });

  it('an INCOME category under an EXPENSE parent is refused', async () => {
    const result = await callTool(registerCategoryTools, 'create_category', {
      ...HOUSE,
      name: 'Bonos',
      kind: 'INCOME',
      parent_id: 10,
    });

    expect(result.body.code).toBe('VALIDATION');
    expect(db.rows.category.some((c) => c.name === 'Bonos')).toBe(false);
  });
});

describe('update_category', () => {
  it('deactivating a root deactivates its children in the same context only', async () => {
    const result = await callTool(registerCategoryTools, 'update_category', {
      ...HOUSE,
      category_id: 10,
      active: false,
    });

    expect(result.isError).toBeUndefined();
    expect(result.body).toMatchObject({ id: 10, active: false });
    expect(category(10).active).toBe(false);
    expect(category(11).active).toBe(false);
    expect(category(12).active).toBe(false);
    expect(category(90).active).toBe(true);
    expect(category(20).active).toBe(true);
  });

  it('deactivating a child leaves its parent and siblings active', async () => {
    await callTool(registerCategoryTools, 'update_category', {
      ...HOUSE,
      category_id: 11,
      active: false,
    });

    expect(category(11).active).toBe(false);
    expect(category(10).active).toBe(true);
    expect(category(12).active).toBe(true);
  });

  it('renames and clears the description without touching active', async () => {
    category(20).description = 'Despensa';
    const result = await callTool(registerCategoryTools, 'update_category', {
      ...HOUSE,
      category_id: 20,
      name: 'Supermercado',
      description: null,
    });

    expect(result.body).toMatchObject({ id: 20, name: 'Supermercado', description: null });
    expect(category(20)).toMatchObject({ name: 'Supermercado', description: null, active: true });
  });

  it('a category of another house → NOT_FOUND and nothing changes', async () => {
    const result = await callTool(registerCategoryTools, 'update_category', {
      ...HOUSE,
      category_id: 90,
      active: false,
    });

    expect(result.body.code).toBe('NOT_FOUND');
    expect(category(90).active).toBe(true);
  });
});

describe('upsert_budget', () => {
  beforeEach(() => {
    // Current fortnight for 2026-10-20 (BIWEEKLY budgets anchor on it).
    db.seed('fortnight', {
      id: 70,
      year: 2026,
      month: 10,
      period: 'SECOND',
      label: 'Q2 octubre',
      closed: false,
      ...octSecond,
      ...HOUSE_FILTER,
    });
  });

  const seedBudget = () => {
    db.seed('budget', {
      id: 7,
      name: 'Comida',
      total_amount: '3000',
      frequency: 'BIWEEKLY',
      recurrent: true,
      active: true,
      ...octSecond,
      ...HOUSE_FILTER,
    });
    db.seed('budgetAllocation', {
      id: 500,
      budget_id: 7,
      wallet_id: null,
      category_id: 20,
      amount: '3000',
    });
  };

  it('without budget_id creates a biweekly budget, its allocations and the current period', async () => {
    const result = await callTool(registerBudgetTools, 'upsert_budget', {
      ...HOUSE,
      name: 'Comida',
      amount: 3000,
      allocations: [
        { category_id: 20, wallet_id: 4, amount: 2000 },
        { category_name: 'farmacia', amount: 1000 },
      ],
    });

    expect(result.isError).toBeUndefined();
    expect(db.rows.budget).toHaveLength(1);
    const budget = db.rows.budget[0]!;
    expect(result.body).toEqual({ budget_id: budget.id, created: true, allocations: 2 });
    expect(budget).toMatchObject({
      name: 'Comida',
      total_amount: 3000,
      frequency: 'BIWEEKLY',
      recurrent: true,
      active: true,
      user_id: null,
      house_id: 42,
    });
    expect(day(budget.start_date)).toBe('2026-10-15');
    expect(day(budget.end_date)).toBe('2026-10-30');

    const allocations = db.rows.budgetAllocation.filter((a) => a.budget_id === budget.id);
    expect(allocations.map(({ wallet_id, category_id, amount }) => ({ wallet_id, category_id, amount })))
      .toEqual([
        { wallet_id: 4, category_id: 20, amount: 2000 },
        { wallet_id: null, category_id: 21, amount: 1000 },
      ]);
    expect(allocations.reduce((sum, a) => sum + Number(a.amount), 0)).toBe(3000);

    const periods = db.rows.budgetPeriod.filter((p) => p.budget_id === budget.id);
    expect(periods).toHaveLength(1);
    expect(day(periods[0]!.start_date)).toBe('2026-10-15');
    expect(day(periods[0]!.end_date)).toBe('2026-10-30');
  });

  it('without allocations writes one allocation for the whole amount', async () => {
    const result = await callTool(registerBudgetTools, 'upsert_budget', {
      ...HOUSE,
      name: 'Farmacia',
      amount: 800,
      category_id: 21,
    });

    expect(result.body).toMatchObject({ created: true, allocations: 1 });
    expect(db.rows.budgetAllocation).toEqual([
      expect.objectContaining({ wallet_id: null, category_id: 21, amount: 800 }),
    ]);
  });

  it('with budget_id replaces the allocations and keeps name and amount', async () => {
    seedBudget();

    const result = await callTool(registerBudgetTools, 'upsert_budget', {
      ...HOUSE,
      budget_id: 7,
      allocations: [
        { category_id: 20, amount: 1800 },
        { category_id: 21, wallet_id: 4, amount: 1200 },
      ],
    });

    expect(result.isError).toBeUndefined();
    expect(result.body).toEqual({ budget_id: 7, updated: true, allocations: 2 });
    expect(db.rows.budget).toHaveLength(1);
    expect(db.rows.budget[0]).toMatchObject({ id: 7, name: 'Comida', frequency: 'BIWEEKLY' });
    expect(Number(db.rows.budget[0]!.total_amount)).toBe(3000);

    const allocations = db.rows.budgetAllocation.filter((a) => a.budget_id === 7);
    expect(allocations.some((a) => a.id === 500)).toBe(false);
    expect(allocations.map(({ wallet_id, category_id, amount }) => ({ wallet_id, category_id, amount })))
      .toEqual([
        { wallet_id: null, category_id: 20, amount: 1800 },
        { wallet_id: 4, category_id: 21, amount: 1200 },
      ]);
  });

  it('with budget_id changes amount and allocations together', async () => {
    seedBudget();

    const result = await callTool(registerBudgetTools, 'upsert_budget', {
      ...HOUSE,
      budget_id: 7,
      amount: 4000,
      allocations: [{ category_id: 20, amount: 4000 }],
    });

    expect(result.isError).toBeUndefined();
    expect(result.body).toEqual({ budget_id: 7, updated: true, allocations: 1 });
    expect(Number(db.rows.budget[0]!.total_amount)).toBe(4000);
    expect(db.rows.budgetAllocation.filter((a) => a.budget_id === 7)).toEqual([
      expect.objectContaining({ wallet_id: null, category_id: 20, amount: 4000 }),
    ]);
  });

  it('with budget_id renames the budget and keeps its allocations', async () => {
    seedBudget();

    const result = await callTool(registerBudgetTools, 'upsert_budget', {
      ...HOUSE,
      budget_id: 7,
      name: 'Despensa',
      category_id: 20,
    });

    expect(result.body).toMatchObject({ budget_id: 7, updated: true });
    expect(db.rows.budget[0]).toMatchObject({ name: 'Despensa' });
    expect(Number(db.rows.budget[0]!.total_amount)).toBe(3000);
    expect(db.rows.budgetAllocation.filter((a) => a.budget_id === 7)).toEqual([
      expect.objectContaining({ wallet_id: null, category_id: 20, amount: 3000 }),
    ]);
  });

  it('allocations that do not sum to amount → VALIDATION and nothing is written', async () => {
    const result = await callTool(registerBudgetTools, 'upsert_budget', {
      ...HOUSE,
      name: 'Comida',
      amount: 3000,
      allocations: [
        { category_id: 20, amount: 2000 },
        { category_id: 21, amount: 500 },
      ],
    });

    expect(result.isError).toBe(true);
    expect(result.body).toMatchObject({ code: 'VALIDATION' });
    expect(result.body.hint).toContain('2500');
    expect(db.rows.budget).toHaveLength(0);
    expect(db.rows.budgetAllocation).toHaveLength(0);
    expect(db.rows.budgetPeriod).toHaveLength(0);
  });

  it('on update, allocations that do not sum keep the stored allocations', async () => {
    seedBudget();

    const result = await callTool(registerBudgetTools, 'upsert_budget', {
      ...HOUSE,
      budget_id: 7,
      allocations: [{ category_id: 21, amount: 100 }],
    });

    expect(result.body.code).toBe('VALIDATION');
    expect(db.rows.budgetAllocation).toEqual([
      expect.objectContaining({ id: 500, category_id: 20, amount: '3000' }),
    ]);
  });

  it('an unknown budget_id → NOT_FOUND and nothing is created', async () => {
    const result = await callTool(registerBudgetTools, 'upsert_budget', {
      ...HOUSE,
      budget_id: 404,
      name: 'X',
      amount: 10,
      category_id: 20,
    });

    expect(result.body.code).toBe('NOT_FOUND');
    expect(db.rows.budget).toHaveLength(0);
  });
});

describe('create_template', () => {
  it('kind expense creates a house template with resolved category, wallet and due days', async () => {
    const result = await callTool(registerTemplateTools, 'create_template', {
      ...HOUSE,
      kind: 'expense',
      name: 'Internet',
      category_name: 'Hogar',
      wallet_name: 'Efectivo',
      suggested_amount: 599,
      applies_second_fortnight: true,
      due_day_second: 20,
    });

    expect(result.isError).toBeUndefined();
    expect(db.rows.expenseTemplate).toHaveLength(1);
    const row = db.rows.expenseTemplate[0]!;
    expect(row).toMatchObject({
      name: 'Internet',
      category_id: 10,
      wallet_id: 4,
      suggested_amount: '599',
      active: true,
      due_day_first_fortnight: null,
      due_day_second_fortnight: 20,
      due_day: 20,
      is_recurring: true,
      applies_first_fortnight: false,
      applies_second_fortnight: true,
      is_subscription: false,
      user_id: null,
      house_id: 42,
    });
    expect(result.body).toMatchObject({
      id: row.id,
      category: 'Hogar',
      wallet_id: 4,
      wallet_name: 'Efectivo',
      suggested_amount: 599,
      due_day_second: 20,
    });
  });

  it('kind income creates a house template with source and funding wallet', async () => {
    const result = await callTool(registerTemplateTools, 'create_template', {
      ...HOUSE,
      kind: 'income',
      name: 'Nómina',
      category_id: 30,
      wallet_id: 4,
      source: 'Empresa',
      suggested_amount: 15000,
      applies_first_fortnight: true,
    });

    expect(result.isError).toBeUndefined();
    expect(db.rows.incomeTemplate).toHaveLength(1);
    expect(db.rows.incomeTemplate[0]).toMatchObject({
      name: 'Nómina',
      category_id: 30,
      wallet_id: 4,
      source: 'Empresa',
      suggested_amount: '15000',
      applies_first_fortnight: true,
      applies_second_fortnight: false,
      active: true,
      user_id: null,
      house_id: 42,
    });
    expect(result.body).toMatchObject({
      category_name: 'Salario',
      wallet_id: 4,
      suggested_amount: 15000,
      source: 'Empresa',
    });
  });

  it('kind income with a credit-card wallet is refused and nothing is written', async () => {
    const result = await callTool(registerTemplateTools, 'create_template', {
      ...HOUSE,
      kind: 'income',
      name: 'Reembolso',
      category_id: 30,
      wallet_id: 5,
    });

    expect(result.body.code).toBe('VALIDATION');
    expect(db.rows.incomeTemplate).toHaveLength(0);
  });

  it('kind income with an expense category is refused', async () => {
    const result = await callTool(registerTemplateTools, 'create_template', {
      ...HOUSE,
      kind: 'income',
      name: 'Nómina',
      category_id: 20,
    });

    expect(result.body.code).toBe('NOT_FOUND');
    expect(db.rows.incomeTemplate).toHaveLength(0);
  });

  it('expense-only fields on kind income → VALIDATION and nothing is written', async () => {
    const result = await callTool(registerTemplateTools, 'create_template', {
      ...HOUSE,
      kind: 'income',
      name: 'Nómina',
      category_id: 30,
      due_day_first: 5,
    });

    expect(result.body.code).toBe('VALIDATION');
    expect(db.rows.incomeTemplate).toHaveLength(0);
    expect(db.rows.expenseTemplate).toHaveLength(0);
  });
});

describe('update_template', () => {
  beforeEach(() => {
    db.seed('expenseTemplate', {
      id: 50,
      name: 'Internet',
      category_id: 10,
      wallet_id: 4,
      suggested_amount: '599',
      active: true,
      due_day: 20,
      due_day_first_fortnight: null,
      due_day_second_fortnight: 20,
      cutoff_day: 12,
      is_recurring: true,
      applies_first_fortnight: false,
      applies_second_fortnight: true,
      is_subscription: true,
      ...HOUSE_FILTER,
    });
    db.seed('incomeTemplate', {
      id: 60,
      name: 'Nómina',
      category_id: 30,
      wallet_id: 4,
      suggested_amount: '15000',
      source: 'Empresa',
      applies_first_fortnight: true,
      applies_second_fortnight: false,
      active: true,
      ...HOUSE_FILTER,
    });
  });

  it('kind expense on a template without wallet updates and keeps no wallet', async () => {
    db.rows.expenseTemplate[0]!.wallet_id = null;

    const result = await callTool(registerTemplateTools, 'update_template', {
      ...HOUSE,
      kind: 'expense',
      template_id: 50,
      suggested_amount: 8500,
    });

    expect(result.isError).toBeUndefined();
    expect(db.rows.expenseTemplate[0]).toMatchObject({
      id: 50,
      wallet_id: null,
      suggested_amount: '8500',
    });
  });

  it('kind expense with a wallet of another house → NOT_FOUND, template unchanged', async () => {
    const result = await callTool(registerTemplateTools, 'update_template', {
      ...HOUSE,
      kind: 'expense',
      template_id: 50,
      wallet_id: 6,
    });

    expect(result.isError).toBe(true);
    expect(result.body.code).toBe('NOT_FOUND');
    expect(db.rows.expenseTemplate[0]).toMatchObject({ id: 50, wallet_id: 4 });
  });

  it('kind expense changes only the sent fields', async () => {
    const result = await callTool(registerTemplateTools, 'update_template', {
      ...HOUSE,
      kind: 'expense',
      template_id: 50,
      suggested_amount: 650,
      active: false,
    });

    expect(result.isError).toBeUndefined();
    expect(db.rows.expenseTemplate[0]).toMatchObject({
      id: 50,
      name: 'Internet',
      category_id: 10,
      wallet_id: 4,
      suggested_amount: '650',
      active: false,
      due_day_second_fortnight: 20,
      due_day: 20,
      cutoff_day: 12,
      is_subscription: true,
      applies_second_fortnight: true,
      house_id: 42,
    });
    expect(result.body).toMatchObject({ id: 50, suggested_amount: 650, active: false });
  });

  it('kind expense moves the template to another category by name', async () => {
    await callTool(registerTemplateTools, 'update_template', {
      ...HOUSE,
      kind: 'expense',
      template_id: 50,
      category_name: 'Súper',
    });

    expect(db.rows.expenseTemplate[0]).toMatchObject({ category_id: 20, wallet_id: 4 });
  });

  it('kind income changes only the sent fields and keeps the house owner', async () => {
    const result = await callTool(registerTemplateTools, 'update_template', {
      ...HOUSE,
      kind: 'income',
      template_id: 60,
      source: 'Bono',
      applies_second_fortnight: true,
    });

    expect(result.isError).toBeUndefined();
    expect(db.rows.incomeTemplate[0]).toMatchObject({
      id: 60,
      name: 'Nómina',
      suggested_amount: '15000',
      source: 'Bono',
      category_id: 30,
      wallet_id: 4,
      applies_first_fortnight: true,
      applies_second_fortnight: true,
      user_id: null,
      house_id: 42,
    });
  });

  it('a template of another context → NOT_FOUND', async () => {
    db.rows.expenseTemplate[0]!.house_id = 99;
    const result = await callTool(registerTemplateTools, 'update_template', {
      ...HOUSE,
      kind: 'expense',
      template_id: 50,
      name: 'Hack',
    });

    expect(result.body.code).toBe('NOT_FOUND');
    expect(db.rows.expenseTemplate[0]!.name).toBe('Internet');
  });
});

const seedPlanningTemplates = () => {
  db.seed(
    'expenseTemplate',
    {
      id: 50,
      name: 'Renta',
      category_id: 10,
      wallet_id: null,
      suggested_amount: '8000',
      active: true,
      due_day: 5,
      due_day_first_fortnight: 5,
      due_day_second_fortnight: null,
      applies_first_fortnight: true,
      applies_second_fortnight: false,
      ...HOUSE_FILTER,
    },
    {
      id: 51,
      name: 'Internet',
      category_id: 10,
      wallet_id: 4,
      suggested_amount: '599',
      active: true,
      due_day: 20,
      due_day_first_fortnight: null,
      due_day_second_fortnight: 20,
      applies_first_fortnight: false,
      applies_second_fortnight: true,
      ...HOUSE_FILTER,
    },
    {
      id: 52,
      name: 'Gimnasio (pausado)',
      category_id: 10,
      wallet_id: null,
      suggested_amount: '500',
      active: false,
      applies_first_fortnight: true,
      applies_second_fortnight: true,
      ...HOUSE_FILTER,
    },
    {
      id: 53,
      name: 'Plantilla ajena',
      category_id: 10,
      wallet_id: null,
      suggested_amount: '1',
      active: true,
      applies_first_fortnight: true,
      applies_second_fortnight: true,
      ...OTHER_HOUSE,
    },
  );
  db.seed('incomeTemplate', {
    id: 60,
    name: 'Aportación casa',
    category_id: 30,
    wallet_id: null,
    suggested_amount: '12000',
    source: 'Casa',
    applies_first_fortnight: true,
    applies_second_fortnight: false,
    active: true,
    ...HOUSE_FILTER,
  });
};

describe('create_month', () => {
  beforeEach(() => {
    seedPlanningTemplates();
    db.seed('budget', {
      id: 7,
      name: 'Comida',
      total_amount: '3000',
      frequency: 'BIWEEKLY',
      recurrent: true,
      active: true,
      ...HOUSE_FILTER,
    });
  });

  it('creates both fortnights, expands active templates and budget periods', async () => {
    const result = await callTool(registerFortnightTools, 'create_month', {
      ...HOUSE,
      year: 2026,
      month: 11,
    });

    expect(result.isError).toBeUndefined();

    const fortnights = db.rows.fortnight;
    expect(fortnights).toHaveLength(2);
    const first = fortnights.find((f) => f.period === 'FIRST')!;
    const second = fortnights.find((f) => f.period === 'SECOND')!;
    expect(first).toMatchObject({ year: 2026, month: 11, closed: false, user_id: null, house_id: 42 });
    expect([day(first.start_date), day(first.end_date)]).toEqual(['2026-10-31', '2026-11-14']);
    expect([day(second.start_date), day(second.end_date)]).toEqual(['2026-11-15', '2026-11-29']);

    expect(
      db.rows.expense.map(({ fortnight_id, expense_template_id, amount, wallet_id, due_day, house_id, user_id, is_paid }) => ({
        fortnight_id,
        expense_template_id,
        amount,
        wallet_id,
        due_day,
        house_id,
        user_id,
        is_paid,
      })),
    ).toEqual([
      { fortnight_id: first.id, expense_template_id: 50, amount: '8000', wallet_id: undefined, due_day: 5, house_id: 42, user_id: null, is_paid: false },
      { fortnight_id: second.id, expense_template_id: 51, amount: '599', wallet_id: 4, due_day: 20, house_id: 42, user_id: null, is_paid: false },
    ]);

    expect(db.rows.income).toHaveLength(1);
    expect(db.rows.income[0]).toMatchObject({
      fortnight_id: first.id,
      income_template_id: 60,
      amount: '12000',
      source: 'Casa',
      user_id: null,
      house_id: 42,
      category_id: 30,
    });
    expect(day(db.rows.income[0]!.received_at)).toBe('2026-10-31');

    expect(db.rows.budgetPeriod.filter((p) => p.budget_id === 7)).toHaveLength(2);

    expect(result.body).toMatchObject({
      message: 'Mes creado: ambas quincenas creadas',
      year: 2026,
      month: 11,
      expenses_created: {
        first_fortnight: { count: 1, names: ['Renta'] },
        second_fortnight: { count: 1, names: ['Internet'] },
        total: 2,
      },
      income_created: { first_fortnight: 1, second_fortnight: 0, total: 1 },
      budget_periods_created: 2,
    });
  });

  it('is safe to repeat: no new fortnights, expenses, incomes or periods', async () => {
    await callTool(registerFortnightTools, 'create_month', { ...HOUSE, year: 2026, month: 11 });
    const counts = () => [
      db.rows.fortnight.length,
      db.rows.expense.length,
      db.rows.income.length,
      db.rows.budgetPeriod.length,
    ];
    const before = counts();

    const again = await callTool(registerFortnightTools, 'create_month', {
      ...HOUSE,
      year: 2026,
      month: 11,
    });

    expect(counts()).toEqual(before);
    expect(again.body).toMatchObject({
      message: 'Quincenas existentes: se sincronizaron plantillas de gastos e ingresos',
      created: [],
      expenses_created: { total: 0 },
      income_created: { total: 0 },
      budget_periods_created: 0,
    });
  });

  it('a past month → VALIDATION and nothing is created', async () => {
    const result = await callTool(registerFortnightTools, 'create_month', {
      ...HOUSE,
      year: 2026,
      month: 9,
    });

    expect(result.body.code).toBe('VALIDATION');
    expect(db.rows.fortnight).toHaveLength(0);
    expect(db.rows.expense).toHaveLength(0);
  });
});

describe('regenerate_from_templates', () => {
  beforeEach(() => {
    seedPlanningTemplates();
    db.seed('fortnight', {
      id: 70,
      year: 2026,
      month: 10,
      period: 'SECOND',
      label: 'Q2 octubre',
      closed: false,
      ...octSecond,
      ...HOUSE_FILTER,
    });
    db.seed(
      'expense',
      // Generated by template 51 and edited by hand afterwards.
      { id: 300, fortnight_id: 70, expense_template_id: 51, amount: '999', description: 'Internet', ...HOUSE_FILTER },
      // Manual expense: must survive.
      { id: 301, fortnight_id: 70, expense_template_id: null, amount: '120', description: 'Tacos', ...HOUSE_FILTER },
    );
    db.seed('income', {
      id: 400,
      fortnight_id: 70,
      income_template_id: 60,
      amount: '1',
      ...HOUSE_FILTER,
    });
  });

  it('without confirm: true → CONFIRM_REQUIRED and nothing is deleted', async () => {
    const result = await callTool(registerFortnightTools, 'regenerate_from_templates', {
      ...HOUSE,
      fortnight_id: 70,
    });

    expect(result.isError).toBe(true);
    expect(result.body.code).toBe('CONFIRM_REQUIRED');
    expect(db.rows.expense.map((e) => e.id)).toEqual([300, 301]);
    expect(db.rows.income.map((i) => i.id)).toEqual([400]);
  });

  it('with confirm: true replaces template rows and keeps manual ones', async () => {
    const result = await callTool(registerFortnightTools, 'regenerate_from_templates', {
      ...HOUSE,
      year: 2026,
      month: 10,
      period: 'SECOND',
      confirm: true,
    });

    expect(result.isError).toBeUndefined();
    expect(result.body).toEqual({
      message: 'Quincena regenerada desde plantillas',
      fortnight_id: 70,
      expenses_created: { count: 1, names: ['Internet'] },
      income_created: { count: 0, names: [] },
    });

    const expenses = db.rows.expense.filter((e) => e.fortnight_id === 70);
    expect(expenses.find((e) => e.id === 300)).toBeUndefined();
    expect(expenses.find((e) => e.id === 301)).toMatchObject({ amount: '120' });
    expect(expenses.filter((e) => e.expense_template_id === 51)).toEqual([
      expect.objectContaining({ amount: '599', wallet_id: 4, due_day: 20, house_id: 42 }),
    ]);
    // SECOND fortnight: the FIRST-only templates are not expanded and the old generated income is gone.
    expect(expenses.some((e) => e.expense_template_id === 50)).toBe(false);
    expect(db.rows.income).toHaveLength(0);
  });

  it('a fortnight of another house → NOT_FOUND and nothing is deleted', async () => {
    db.seed('fortnight', { id: 71, year: 2026, month: 10, period: 'SECOND', ...octSecond, ...OTHER_HOUSE });
    db.seed('expense', { id: 310, fortnight_id: 71, expense_template_id: 53, amount: '1', ...OTHER_HOUSE });

    const result = await callTool(registerFortnightTools, 'regenerate_from_templates', {
      ...HOUSE,
      fortnight_id: 71,
      confirm: true,
    });

    expect(result.body.code).toBe('NOT_FOUND');
    expect(db.rows.expense.some((e) => e.id === 310)).toBe(true);
  });
});
