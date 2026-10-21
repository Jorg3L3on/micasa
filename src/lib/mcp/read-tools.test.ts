import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthInfo } from '@modelcontextprotocol/server';

/**
 * Every read tool through the real MCP pipeline with fixture services:
 * the response validates against its published output schema, carries no
 * camelCase key, lists paginate, and the registry itself is fully described.
 */

const m = vi.hoisted(() => ({
  houseMemberFindFirst: vi.fn(),
  allowedContextsFindMany: vi.fn(),
  walletFindFirst: vi.fn(),
  listUserHouses: vi.fn(),
  listHouseMembersByHouse: vi.fn(),
  listWalletsByOwner: vi.fn(),
  getWalletAmountForOwner: vi.fn(),
  listWalletMovements: vi.fn(),
  listCardMovementsForRange: vi.fn(),
  getCreditCardByOwner: vi.fn(),
  getCreditCardStatementByOwner: vi.fn(),
  getCreditCardReconciliationReport: vi.fn(),
  listInstallmentPlansForCard: vi.fn(),
  listScheduledPaymentsForCard: vi.fn(),
  listExpensesWithTotals: vi.fn(),
  listIncomesForFortnight: vi.fn(),
  listCategoriesForOwner: vi.fn(),
  listActivePeriods: vi.fn(),
  listExpenseTemplatesForOwner: vi.fn(),
  listIncomeTemplatesForOwner: vi.fn(),
  listLoansByOwner: vi.fn(),
  getLoanByIdForOwner: vi.fn(),
  listLendersByOwner: vi.fn(),
  listUpcomingCommitments: vi.fn(),
  getLiquidityProjection: vi.fn(),
  buildMcpLiquidityPayload: vi.fn(),
  getReportSummary: vi.fn(),
  getAlerts: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    houseMember: { findFirst: m.houseMemberFindFirst },
    agentConnectionAllowedContext: { findMany: m.allowedContextsFindMany },
    wallet: { findFirst: m.walletFindFirst },
  },
}));
vi.mock('@/lib/house/house.service', () => ({
  listUserHouses: m.listUserHouses,
  listHouseMembersByHouse: m.listHouseMembersByHouse,
}));
vi.mock('@/lib/finance/wallet.service', () => ({
  listWalletsByOwner: m.listWalletsByOwner,
  getWalletAmountForOwner: m.getWalletAmountForOwner,
}));
vi.mock('@/lib/finance/wallet-movements', () => ({
  listWalletMovements: m.listWalletMovements,
  computeMovementTotals: () => ({ inflow: 500, outflow: 120, net: 380 }),
}));
vi.mock('@/lib/finance/credit-card-movements.service', () => ({
  listCardMovementsForRange: m.listCardMovementsForRange,
}));
vi.mock('@/lib/finance/credit-card.service', () => ({
  getCreditCardByOwner: m.getCreditCardByOwner,
}));
vi.mock('@/lib/finance/credit-card-statement.service', () => ({
  getCreditCardStatementByOwner: m.getCreditCardStatementByOwner,
}));
vi.mock('@/lib/finance/credit-card-reconciliation.service', () => ({
  getCreditCardReconciliationReport: m.getCreditCardReconciliationReport,
}));
vi.mock('@/lib/finance/credit-card-installment-plan.service', () => ({
  listInstallmentPlansForCard: m.listInstallmentPlansForCard,
}));
vi.mock('@/lib/finance/credit-card-scheduled-payment.service', () => ({
  listScheduledPaymentsForCard: m.listScheduledPaymentsForCard,
}));
vi.mock('@/lib/finance/expense-list.service', () => ({
  listExpensesWithTotals: m.listExpensesWithTotals,
}));
vi.mock('@/lib/finance/income.service', () => ({
  listIncomesForFortnight: m.listIncomesForFortnight,
  IncomeServiceError: class IncomeServiceError extends Error {},
}));
vi.mock('@/lib/finance/category.service', () => ({
  listCategoriesForOwner: m.listCategoriesForOwner,
  CategoryServiceError: class CategoryServiceError extends Error {},
}));
vi.mock('@/lib/finance/budget-period.service', () => ({
  listActivePeriods: m.listActivePeriods,
}));
vi.mock('@/lib/finance/expense-template.service', () => ({
  listExpenseTemplatesForOwner: m.listExpenseTemplatesForOwner,
}));
vi.mock('@/lib/finance/income-template.service', () => ({
  listIncomeTemplatesForOwner: m.listIncomeTemplatesForOwner,
}));
vi.mock('@/lib/finance/loan.service', () => ({
  listLoansByOwner: m.listLoansByOwner,
  getLoanByIdForOwner: m.getLoanByIdForOwner,
}));
vi.mock('@/lib/finance/lender.service', () => ({
  listLendersByOwner: m.listLendersByOwner,
}));
vi.mock('@/lib/mcp/upcoming-commitments.service', () => ({
  listUpcomingCommitments: m.listUpcomingCommitments,
}));
vi.mock('@/lib/finance/liquidity-projection.service', () => ({
  getLiquidityProjection: m.getLiquidityProjection,
  defaultLiquidityUntilFromAsOf: () => new Date('2026-12-20T12:00:00.000Z'),
}));
vi.mock('@/lib/mcp/liquidity-response', () => ({
  buildMcpLiquidityPayload: m.buildMcpLiquidityPayload,
}));
vi.mock('@/lib/finance/report-summary.service', () => ({
  getReportSummary: m.getReportSummary,
}));
vi.mock('@/features/alerts/server/alerts.service', () => ({ getAlerts: m.getAlerts }));

import { Prisma } from '@/generated/prisma/client';
import { registerMcpTools } from '@/lib/mcp/register-tools';
import { toolOutputSchemas } from '@/lib/mcp/define-tool';
import { connectInMemoryMcp, type ListedTool } from '@/lib/mcp/testing/in-memory-client';

const HOUSE = { owner_type: 'house' as const, owner_id: 42 };

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

const wallet = (id: number, type: string, amount: number) => ({
  id,
  name: `W${id}`,
  type,
  amount,
  credit_limit: type === 'CREDIT_CARD' ? 10000 : null,
  temporary_credit_limit: null,
  active: true,
  include_in_liquidity: true,
  cutoff_day: type === 'CREDIT_CARD' ? 5 : null,
  due_day: type === 'CREDIT_CARD' ? 25 : null,
  goal_amount: null,
  goal_due_date: null,
  created_at: '2026-01-01',
});

const loan = (id: number) => ({
  id,
  name: `Préstamo ${id}`,
  lender: 'Banco',
  lenderId: 1,
  type: 'PERSONAL',
  status: 'ACTIVE',
  frequency: 'MONTHLY',
  paymentSource: 'WALLET',
  paymentAmount: 1000,
  paymentCount: 12,
  totalPayable: 12000,
  paidAmount: 3000,
  remainingAmount: 9000,
  paidPayments: 3,
  remainingPayments: 9,
  overduePayment: null,
  nextPayment: { id: 50 + id, dueDate: '2026-11-15', amount: 1000 },
  payments: [{ id: 50 + id, dueDate: '2026-11-15', amount: 1000, status: 'SCHEDULED' }],
});

function seedFixtures() {
  m.houseMemberFindFirst.mockResolvedValue({ role: 'OWNER' });
  m.allowedContextsFindMany.mockResolvedValue([
    { owner_type: 'USER', owner_id: 2 },
    { owner_type: 'HOUSE', owner_id: 42 },
  ]);
  m.walletFindFirst.mockResolvedValue({ id: 4, name: 'W4', type: 'CASH' });
  m.listUserHouses.mockResolvedValue([
    { id: 42, name: 'Casa', role: 'OWNER' },
    { id: 43, name: 'Otra', role: 'MEMBER' },
  ]);
  m.listHouseMembersByHouse.mockResolvedValue(new Map([[42, [{ user_id: 2, name: 'Ana' }]]]));
  m.listWalletsByOwner.mockResolvedValue([wallet(4, 'CASH', 500), wallet(9, 'CREDIT_CARD', 1200)]);
  m.getWalletAmountForOwner.mockResolvedValue(500);
  m.listWalletMovements.mockResolvedValue([
    { id: 1, kind: 'expense', date: '2026-10-02', amount: 120, direction: 'out', categoryIcon: null, fortnightYear: 2026 },
    { id: 2, kind: 'income', date: '2026-10-05', amount: 500, direction: 'in', categoryIcon: null, fortnightYear: 2026 },
  ]);
  m.getCreditCardByOwner.mockResolvedValue({
    id: 9,
    name: 'Visa',
    type: 'CREDIT_CARD',
    amount: 1200,
    credit_limit: 10000,
    temporary_credit_limit: null,
    available_credit: 8800,
    cutoff_day: 5,
    due_day: 25,
    active: true,
  });
  m.getCreditCardStatementByOwner.mockResolvedValue({
    statement_start: '2026-09-06',
    statement_end: '2026-10-05',
    statement_due_date: '2026-10-25',
    last_statement_balance: 900,
    payments_applied_to_statement: 0,
    next_due_payment: 900,
    period_obligation: { amount: 900, confidence: 'ledger' },
    minimum_payment: 150,
    current_cycle_purchases: 300,
    current_cycle_payments: 0,
    current_cycle_purchase_items: [],
    statement_purchases: [],
    installment_active_purchases: [],
    payment_history: [],
  });
  m.listExpensesWithTotals.mockResolvedValue({
    totalCount: 3,
    expenses: [
      {
        id: 7,
        payment_date: new Date('2026-10-02T12:00:00.000Z'),
        created_at: new Date('2026-10-02T12:00:00.000Z'),
        description: 'Super',
        amount: new Prisma.Decimal('120.00'),
        wallet_id: 4,
        wallet: { name: 'W4', type: 'CASH' },
        category_id: 10,
        category: { name: 'Comida' },
        is_paid: true,
      },
    ],
    totals: { by_wallet: { W4: 300, MercadoPago: 20 }, by_category: { Comida: 320 } },
    totalsInPage: { by_wallet: {}, by_category: {} },
  });
  m.listIncomesForFortnight.mockResolvedValue([
    { id: 1, amount: 5000, receivedAt: '2026-10-15', walletName: 'W4' },
    { id: 2, amount: 800, receivedAt: '2026-10-20', walletName: 'W4' },
  ]);
  m.listCategoriesForOwner.mockResolvedValue([
    { id: 10, name: 'Comida', description: null, icon: null, active: true, sort_order: 0, parent_id: null, kind: 'EXPENSE' },
    { id: 11, name: 'Super', description: null, icon: null, active: true, sort_order: 0, parent_id: 10, kind: 'EXPENSE' },
  ]);
  m.listActivePeriods.mockResolvedValue([
    {
      period_id: 1,
      budget_id: 3,
      name: 'Despensa',
      start_date: '2026-10-15',
      end_date: '2026-10-30',
      allocated_amount: 3000,
      spent_amount: 1200,
      remaining_amount: 1800,
      allocations: [{ categoryId: 10, walletId: null, amount: 3000 }],
    },
  ]);
  m.listExpenseTemplatesForOwner.mockResolvedValue([
    {
      id: 1,
      name: 'Renta',
      suggested_amount: '1500',
      active: true,
      due_day: 1,
      due_day_first_fortnight: 1,
      due_day_second_fortnight: null,
      cutoff_day: null,
      is_recurring: true,
      applies_first_fortnight: true,
      applies_second_fortnight: false,
      is_subscription: false,
      category: { name: 'Vivienda', icon: null },
      wallet: { id: 4, name: 'W4' },
    },
  ]);
  m.listIncomeTemplatesForOwner.mockResolvedValue([
    {
      id: 2,
      name: 'Salario',
      suggested_amount: '5000',
      source: 'Nómina',
      category_id: 20,
      wallet_id: 4,
      applies_first_fortnight: true,
      applies_second_fortnight: true,
      active: true,
      user_id: null,
      category: { id: 20, name: 'Ingresos', icon: null },
      user: null,
    },
  ]);
  m.listLoansByOwner.mockResolvedValue([loan(1), loan(2)]);
  m.getLoanByIdForOwner.mockResolvedValue(loan(1));
  m.listLendersByOwner.mockResolvedValue([
    {
      id: 1,
      name: 'Banco',
      remainingPrincipal: 9000,
      activeContractCount: 2,
      payrollOnly: false,
      payWindow: { amount: 2000, commitmentDate: '2026-11-15', commitmentDateEnd: '2026-11-15', canPay: true },
      loans: [loan(1)],
    },
  ]);
  m.listUpcomingCommitments.mockResolvedValue({
    year: 2026,
    month: 11,
    items: [
      { date: '2026-11-15', type: 'loan', name: 'Préstamo 1', amount: 1000, is_paid: false, source_id: 51, wallet_or_loan: 'Banco' },
      { date: '2026-11-25', type: 'revolving', name: 'Visa', amount: 900, is_paid: false, source_id: 9, wallet_or_loan: 'Visa' },
    ],
    period_total: 1900,
  });
  m.getLiquidityProjection.mockResolvedValue({ funding_wallets: [], projection_events: [] });
  m.buildMcpLiquidityPayload.mockReturnValue({
    as_of: '2026-10-21',
    until: '2026-12-20',
    funding_total: 500,
    committed_obligations_total: 1900,
    net_liquidity: -1400,
    lasts_until: '2026-11-15',
    lasts_until_including_income: null,
    next_gap: null,
  });
  m.getReportSummary.mockResolvedValue({
    totalIncome: 5800,
    totalExpense: 1200,
    totalPaid: 900,
    totalUnpaid: 300,
    balance: 4600,
    fundingWalletBreakdown: [{ id: 4, name: 'W4', amount: 500, type: 'CASH', provider_icon_key: null }],
  });
  m.getAlerts.mockResolvedValue({
    period: { year: 2026, month: 10, period: 'SECOND' },
    alerts: [
      { id: 'a', type: 'missing_income', title: 'Sin ingreso', description: '…', severity: 'warning', target: { path: '/monthly' }, fingerprint: 'x' },
    ],
  });
}

const READ_CALLS: Record<string, Record<string, unknown>> = {
  list_houses: { include_members: true },
  list_wallets: { ...HOUSE },
  list_movements: { ...HOUSE, wallet_id: 4, from: '2026-10-01', to: '2026-10-31' },
  get_card: { ...HOUSE, card_id: 9, include: ['statement', 'movements', 'installments', 'reconciliation'] },
  list_expenses: { ...HOUSE, from: '2026-10-01', to: '2026-10-31' },
  list_incomes: { ...HOUSE, fortnight_id: 55 },
  list_categories: { ...HOUSE },
  list_budgets: { ...HOUSE },
  list_templates: { ...HOUSE },
  list_loans: { ...HOUSE, year: 2026, month: 11 },
  list_lenders: { ...HOUSE },
  get_loan: { ...HOUSE, loan_id: 1 },
  list_upcoming: { ...HOUSE, year: 2026, month: 11 },
  get_liquidity: { ...HOUSE },
  get_period_summary: { ...HOUSE, year: 2026, month: 10, period: 'SECOND' },
  get_alerts: { ...HOUSE },
};

const camelKeys = (value: unknown, path = '$'): string[] => {
  if (Array.isArray(value)) return value.flatMap((v, i) => camelKeys(v, `${path}[${i}]`));
  if (value == null || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, v]) => [
    ...(/^[a-z]+[A-Z]/.test(key) ? [`${path}.${key}`] : []),
    ...camelKeys(v, `${path}.${key}`),
  ]);
};

let tools: ListedTool[] = [];

beforeEach(async () => {
  vi.clearAllMocks();
  seedFixtures();
  const client = await connectInMemoryMcp(registerMcpTools, { authInfo });
  tools = await client.listTools();
  await client.close();
});

const call = async (name: string, args: Record<string, unknown>) => {
  const client = await connectInMemoryMcp(registerMcpTools, { authInfo });
  const result = await client.callTool(name, args);
  await client.close();
  return result as typeof result & { structuredContent?: Record<string, unknown> };
};

describe('read tools', () => {
  it('every read-only tool has a fixture call here', () => {
    const readTools = tools.filter((t) => t.annotations?.readOnlyHint).map((t) => t.name);
    expect(readTools.sort()).toEqual(Object.keys(READ_CALLS).sort());
  });

  it.each(Object.entries(READ_CALLS))(
    '%s returns structuredContent that validates against its output schema, in snake_case',
    async (name, args) => {
      const result = await call(name, args);

      expect(result.isError, result.content[0]?.text).toBeUndefined();
      const schema = toolOutputSchemas.get(name);
      expect(schema, `${name} declares an outputSchema`).toBeDefined();
      expect(tools.find((t) => t.name === name)).toHaveProperty('outputSchema');

      const structured = result.structuredContent;
      expect(structured).toEqual(JSON.parse(result.content[0]!.text));
      const parsed = schema!.safeParse(structured);
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
      expect(camelKeys(structured)).toEqual([]);
    },
  );

  it.each(
    Object.keys(READ_CALLS).filter((name) => name.startsWith('list_')),
  )('%s respects limit and reports total_count', async (name) => {
    const result = await call(name, { ...READ_CALLS[name], limit: 1, offset: 0 });
    const body = result.structuredContent!;
    const listKey = Object.keys(body).find(
      (key) => Array.isArray(body[key]) && !['scopes'].includes(key),
    )!;

    expect(body).toMatchObject({ limit: 1, offset: 0 });
    expect(typeof body.total_count).toBe('number');
    expect((body[listKey] as unknown[]).length).toBeLessThanOrEqual(1);
    expect(body.total_count as number).toBeGreaterThanOrEqual((body[listKey] as unknown[]).length);
  });

  it('list_loans leaves the calendar out unless include_schedule', async () => {
    const without = (await call('list_loans', { ...HOUSE })).structuredContent!;
    const withSchedule = (await call('list_loans', { ...HOUSE, include_schedule: true }))
      .structuredContent!;

    for (const row of without.loans as Array<Record<string, unknown>>) {
      expect(row).not.toHaveProperty('payments');
    }
    expect((withSchedule.loans as Array<Record<string, unknown>>)[0]).toHaveProperty('payments');
  });

  it('list_expenses totals are name/amount arrays (wallet names are data, not keys)', async () => {
    const body = (await call('list_expenses', READ_CALLS.list_expenses)).structuredContent!;

    expect(body.totals).toEqual({
      by_wallet: [
        { name: 'W4', amount: 300 },
        { name: 'MercadoPago', amount: 20 },
      ],
      by_category: [{ name: 'Comida', amount: 320 }],
    });
    expect(body).not.toHaveProperty('totals_in_page');
    expect((body.expenses as Array<Record<string, unknown>>)[0]).toMatchObject({
      date: '2026-10-02',
      amount: 120,
    });
  });
});

describe('registry descriptions and hints', () => {
  const describedFields = (props: Record<string, Record<string, unknown>> = {}, prefix = ''): string[] =>
    Object.entries(props).flatMap(([key, prop]) => {
      const nested = (prop.items as { properties?: Record<string, Record<string, unknown>> })?.properties;
      return [
        ...(prop.description ? [] : [`${prefix}${key}`]),
        ...(nested ? describedFields(nested, `${prefix}${key}[].`) : []),
      ];
    });

  it('every input field has a description', () => {
    const missing = tools.flatMap((tool) =>
      describedFields(tool.inputSchema.properties as Record<string, Record<string, unknown>>).map(
        (field) => `${tool.name}.${field}`,
      ),
    );
    expect(missing).toEqual([]);
  });

  it('every tool declares openWorldHint: false and no description names an HTTP route', () => {
    for (const tool of tools) {
      expect(tool.annotations?.openWorldHint, tool.name).toBe(false);
      const description = (tool as ListedTool & { description?: string }).description ?? '';
      expect(description, tool.name).not.toMatch(/\b(POST|PUT|PATCH)\b|\/api\//);
    }
  });
});
