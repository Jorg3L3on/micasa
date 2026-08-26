import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashSync } from 'bcryptjs';
import type { McpServer } from '@modelcontextprotocol/server';
import { registerExpenseTools } from '@/lib/mcp/tools/expenses';
import { registerLoanTools } from '@/lib/mcp/tools/loans';
import { registerCreditCardTools } from '@/lib/mcp/tools/credit-cards';
import { registerWalletTools } from '@/lib/mcp/tools/wallets';
import { registerTemplateTools } from '@/lib/mcp/tools/templates';
import type { McpToolContext } from '@/lib/mcp/tool-helpers';

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
  listWalletMovements,
  expenseTemplateFindMany,
  expenseTemplateCreate,
  expenseTemplateFindFirst,
  expenseTemplateUpdate,
  expenseTemplateDelete,
  expenseUpdateMany,
  incomeTemplateFindMany,
  incomeTemplateCreate,
  incomeTemplateFindFirst,
  incomeTemplateUpdate,
  incomeTemplateDelete,
  incomeFindFirst,
  prismaTransaction,
  resolveCategoryRef,
  resolveWalletRef,
  resolveDateRange,
  assertOwnedCategoryOfKind,
  findFortnightByCalendarPeriod,
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
  listWalletMovements: vi.fn(),
  expenseTemplateFindMany: vi.fn(),
  expenseTemplateCreate: vi.fn(),
  expenseTemplateFindFirst: vi.fn(),
  expenseTemplateUpdate: vi.fn(),
  expenseTemplateDelete: vi.fn(),
  expenseUpdateMany: vi.fn(),
  incomeTemplateFindMany: vi.fn(),
  incomeTemplateCreate: vi.fn(),
  incomeTemplateFindFirst: vi.fn(),
  incomeTemplateUpdate: vi.fn(),
  incomeTemplateDelete: vi.fn(),
  incomeFindFirst: vi.fn(),
  prismaTransaction: vi.fn(),
  resolveCategoryRef: vi.fn(),
  resolveWalletRef: vi.fn(),
  resolveDateRange: vi.fn(),
  assertOwnedCategoryOfKind: vi.fn(),
  findFortnightByCalendarPeriod: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    apiKey: { findUnique: findUniqueApiKey, update: updateApiKey },
    houseMember: { findFirst: findFirstMembership },
    agentConnectionAllowedContext: { findMany: findManyAllowedContexts },
    wallet: { findUnique: vi.fn().mockResolvedValue({ amount: 1000, type: 'CASH' }) },
    expenseTemplate: {
      findMany: expenseTemplateFindMany,
      create: expenseTemplateCreate,
      findFirst: expenseTemplateFindFirst,
      update: expenseTemplateUpdate,
      delete: expenseTemplateDelete,
    },
    incomeTemplate: {
      findMany: incomeTemplateFindMany,
      create: incomeTemplateCreate,
      findFirst: incomeTemplateFindFirst,
      update: incomeTemplateUpdate,
      delete: incomeTemplateDelete,
    },
    income: { findFirst: incomeFindFirst },
    expense: { updateMany: expenseUpdateMany },
    $transaction: prismaTransaction,
  },
}));

vi.mock('@/lib/finance/expense.service', () => ({
  toggleExpensePaid,
  createExpense: vi.fn(),
  deleteExpense: vi.fn(),
  updateExpense: vi.fn(),
}));

vi.mock('@/lib/finance/loan.service', () => ({
  batchUpdateLoanPaymentsForOwner,
  updateLoanPaymentForOwner,
  createLoanForOwnerWithProgress: vi.fn(),
  deleteLoanForOwner: vi.fn(),
  getLoanByIdForOwner: vi.fn(),
  listLoansByOwner: vi.fn(),
  updateLoanScheduleForOwner: vi.fn(),
}));

vi.mock('@/lib/finance/credit-card.service', () => ({
  createScheduledPayment: vi.fn(),
  createCreditCardForOwner: vi.fn(),
  createCreditCardPayment: vi.fn(),
  createCreditCardPurchase: vi.fn(),
  getCreditCardByOwner: vi.fn(),
  listCreditCardsByOwner: vi.fn(),
  updateCreditCardForOwner: vi.fn(),
}));

vi.mock('@/lib/finance/credit-card-scheduled-payment.service', () => ({
  createScheduledPayment,
  deleteScheduledPayment: vi.fn(),
  listScheduledPaymentsForCard: vi.fn(),
}));

vi.mock('@/lib/finance/credit-card-payment-plan.service', () => ({
  upsertCreditCardPaymentPlan,
}));

vi.mock('@/lib/finance/credit-card-installment-plan.service', () => ({
  createInstallmentPlan: vi.fn(),
  listInstallmentPlansForCard: vi.fn(),
  updateInstallmentPlan: vi.fn(),
}));

vi.mock('@/lib/finance/credit-card-statement.service', () => ({
  getCreditCardStatementByOwner: vi.fn(),
}));

vi.mock('@/lib/finance/wallet.service', () => ({
  createWalletForOwner: vi.fn(),
  listWalletsByOwner: vi.fn(),
  updateWalletMetadataForOwner: vi.fn(),
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
  resolveCategoryRef,
  resolveWalletRef,
  resolveDateRange,
  resolveFortnightIdForDate: vi.fn(),
  calendarRangeBounds: vi.fn(),
}));

vi.mock('@/lib/finance/category.service', () => ({
  assertOwnedCategoryOfKind,
  CategoryServiceError: class CategoryServiceError extends Error {
    status = 400;
  },
}));

vi.mock('@/features/monthly/server/monthly.queries', () => ({
  findFortnightByCalendarPeriod,
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

const ctxWithToken = (token?: string) => ({
  http: {
    req: new Request('http://localhost/api/mcp', {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }),
  },
});

const houseArgs = { ownerType: 'house' as const, ownerId: 3 };

const invokeTool = async (name: string, args: Record<string, unknown>) => {
  const handler = registeredTools.get(name);
  if (!handler) {
    throw new Error(`Tool not registered: ${name}`);
  }
  return handler(args, ctxWithToken(VALID_TOKEN));
};

const parseResult = (result: Awaited<ReturnType<typeof invokeTool>>) =>
  JSON.parse(result.content[0].text);

const sampleExpenseTemplateRow = {
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
  category: { name: 'Vivienda', icon: 'HOME' },
  wallet: { id: 4, name: 'Efectivo' },
};

const sampleIncomeTemplateRow = {
  id: 2,
  name: 'Salario',
  suggested_amount: '5000',
  source: 'Nómina',
  category_id: 10,
  applies_first_fortnight: true,
  applies_second_fortnight: true,
  active: true,
  user_id: null,
  category: { id: 10, name: 'Ingresos', icon: 'BANK' },
  user: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  registeredTools.clear();
  registerExpenseTools(testServer);
  registerLoanTools(testServer);
  registerCreditCardTools(testServer);
  registerWalletTools(testServer);
  registerTemplateTools(testServer);

  updateApiKey.mockResolvedValue({});
  findUniqueApiKey.mockResolvedValue(writeApiKey);
  findFirstMembership.mockResolvedValue({ role: 'OWNER' });
  findManyAllowedContexts.mockResolvedValue([{ owner_type: 'HOUSE', owner_id: 3 }]);
  resolveCategoryRef.mockResolvedValue(10);
  resolveWalletRef.mockResolvedValue({ id: 4, name: 'Efectivo', type: 'CASH' });
  resolveDateRange.mockReturnValue({ from: '2026-08-01', to: '2026-08-31' });
  assertOwnedCategoryOfKind.mockResolvedValue(undefined);
  prismaTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      expense: { updateMany: expenseUpdateMany },
      expenseTemplate: { delete: expenseTemplateDelete },
    }),
  );
  expenseUpdateMany.mockResolvedValue({ count: 0 });
});

describe('registered MCP P1 tools auth', () => {
  it('set_expense_paid requires write scope', async () => {
    findUniqueApiKey.mockResolvedValue({ ...writeApiKey, scopes: ['read'] });

    const result = await invokeTool('set_expense_paid', {
      ...houseArgs,
      expense_id: 1,
      is_paid: true,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('scope \\"write\\"');
    expect(toggleExpensePaid).not.toHaveBeenCalled();
  });

  it('create_expense_template requires write scope', async () => {
    findUniqueApiKey.mockResolvedValue({ ...writeApiKey, scopes: ['read'] });

    const result = await invokeTool('create_expense_template', {
      ...houseArgs,
      name: 'Renta',
      category_id: 10,
      applies_first_fortnight: true,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('scope \\"write\\"');
    expect(expenseTemplateCreate).not.toHaveBeenCalled();
  });
});

describe('registered set_expense_paid', () => {
  it('maps wallet name from prisma expense row', async () => {
    toggleExpensePaid.mockResolvedValue({
      id: 12,
      is_paid: true,
      amount: '250',
      description: 'Compra',
      wallet: { name: 'Efectivo', type: 'CASH' },
      category: null,
    });

    const result = await invokeTool('set_expense_paid', {
      ...houseArgs,
      expense_id: 12,
      is_paid: true,
    });

    expect(result.isError).toBeFalsy();
    expect(toggleExpensePaid).toHaveBeenCalledWith({
      id: 12,
      paid: true,
      ownerFilter: { user_id: null, house_id: 3 },
    });
    expect(parseResult(result)).toMatchObject({
      expense_id: 12,
      is_paid: true,
      wallet_name: 'Efectivo',
      amount: 250,
    });
  });
});

describe('registered expense template tools', () => {
  it('list_expense_templates returns formatted rows', async () => {
    expenseTemplateFindMany.mockResolvedValue([sampleExpenseTemplateRow]);

    const result = await invokeTool('list_expense_templates', houseArgs);

    expect(result.isError).toBeFalsy();
    expect(parseResult(result).templates[0]).toMatchObject({
      id: 1,
      name: 'Renta',
      applies_first_fortnight: true,
    });
  });

  it('create_expense_template persists via prisma', async () => {
    expenseTemplateCreate.mockResolvedValue(sampleExpenseTemplateRow);

    const result = await invokeTool('create_expense_template', {
      ...houseArgs,
      name: 'Renta',
      category_id: 10,
      applies_first_fortnight: true,
      applies_second_fortnight: false,
      is_recurring: true,
      is_subscription: false,
      suggested_amount: 1500,
    });

    expect(result.isError).toBeFalsy();
    expect(expenseTemplateCreate).toHaveBeenCalled();
    expect(parseResult(result)).toMatchObject({ id: 1, name: 'Renta' });
  });

  it('update_expense_template updates owned template', async () => {
    expenseTemplateFindFirst.mockResolvedValue({
      ...sampleExpenseTemplateRow,
      category_id: 10,
      wallet_id: 4,
    });
    expenseTemplateUpdate.mockResolvedValue({
      ...sampleExpenseTemplateRow,
      name: 'Renta actualizada',
    });

    const result = await invokeTool('update_expense_template', {
      ...houseArgs,
      template_id: 1,
      name: 'Renta actualizada',
    });

    expect(result.isError).toBeFalsy();
    expect(expenseTemplateUpdate).toHaveBeenCalled();
    expect(parseResult(result).name).toBe('Renta actualizada');
  });

  it('delete_expense_template detaches and deletes', async () => {
    expenseTemplateFindFirst.mockResolvedValue(sampleExpenseTemplateRow);
    expenseUpdateMany.mockResolvedValue({ count: 2 });

    const result = await invokeTool('delete_expense_template', {
      ...houseArgs,
      template_id: 1,
      confirm: true,
    });

    expect(result.isError).toBeFalsy();
    expect(prismaTransaction).toHaveBeenCalled();
    expect(parseResult(result)).toMatchObject({
      deleted: true,
      template_id: 1,
      detached_expense_count: 2,
    });
  });
});

describe('registered income template tools', () => {
  it('list_income_templates returns formatted rows', async () => {
    incomeTemplateFindMany.mockResolvedValue([sampleIncomeTemplateRow]);

    const result = await invokeTool('list_income_templates', houseArgs);

    expect(result.isError).toBeFalsy();
    expect(parseResult(result).templates[0]).toMatchObject({
      id: 2,
      name: 'Salario',
    });
  });

  it('create_income_template persists via prisma', async () => {
    incomeTemplateCreate.mockResolvedValue(sampleIncomeTemplateRow);

    const result = await invokeTool('create_income_template', {
      ...houseArgs,
      name: 'Salario',
      category_id: 10,
      applies_first_fortnight: true,
      applies_second_fortnight: true,
    });

    expect(result.isError).toBeFalsy();
    expect(assertOwnedCategoryOfKind).toHaveBeenCalled();
    expect(incomeTemplateCreate).toHaveBeenCalled();
    expect(parseResult(result)).toMatchObject({ id: 2, name: 'Salario' });
  });

  it('update_income_template updates owned template', async () => {
    incomeTemplateFindFirst.mockResolvedValue({
      ...sampleIncomeTemplateRow,
      category_id: 10,
    });
    incomeTemplateUpdate.mockResolvedValue({
      ...sampleIncomeTemplateRow,
      name: 'Salario actualizado',
    });

    const result = await invokeTool('update_income_template', {
      ...houseArgs,
      template_id: 2,
      name: 'Salario actualizado',
    });

    expect(result.isError).toBeFalsy();
    expect(incomeTemplateUpdate).toHaveBeenCalled();
    expect(parseResult(result).name).toBe('Salario actualizado');
  });

  it('delete_income_template removes unused template', async () => {
    incomeTemplateFindFirst.mockResolvedValue(sampleIncomeTemplateRow);
    incomeFindFirst.mockResolvedValue(null);

    const result = await invokeTool('delete_income_template', {
      ...houseArgs,
      template_id: 2,
      confirm: true,
    });

    expect(result.isError).toBeFalsy();
    expect(incomeTemplateDelete).toHaveBeenCalledWith({ where: { id: 2 } });
    expect(parseResult(result)).toMatchObject({ deleted: true, template_id: 2 });
  });
});

describe('registered add_loan_payment', () => {
  it('MARK_PAID delegates to updateLoanPaymentForOwner', async () => {
    updateLoanPaymentForOwner.mockResolvedValue({
      id: 7,
      loanId: 2,
      status: 'PAID',
    });

    const result = await invokeTool('add_loan_payment', {
      ...houseArgs,
      payment_id: 7,
      action: 'MARK_PAID',
      source_wallet_id: 4,
      paid_at: '2026-08-15',
    });

    expect(result.isError).toBeFalsy();
    expect(updateLoanPaymentForOwner).toHaveBeenCalledWith(
      7,
      { user_id: null, house_id: 3 },
      expect.objectContaining({ action: 'MARK_PAID', sourceWalletId: 4 }),
    );
  });

  it('batch MARK_PAID delegates to batchUpdateLoanPaymentsForOwner', async () => {
    batchUpdateLoanPaymentsForOwner.mockResolvedValue([
      { id: 10, loanId: 2, status: 'PAID' },
    ]);

    const result = await invokeTool('add_loan_payment', {
      ...houseArgs,
      payment_ids: [10, 11],
      action: 'MARK_PAID',
      source_wallet_id: 4,
    });

    expect(result.isError).toBeFalsy();
    expect(batchUpdateLoanPaymentsForOwner).toHaveBeenCalled();
  });
});

describe('registered card calendar tools', () => {
  it('create_scheduled_payment calls service', async () => {
    createScheduledPayment.mockResolvedValue({
      id: 1,
      creditCardWalletId: 9,
      dueDate: '2026-09-01',
      amount: 500,
      label: 'Cuota',
      status: 'SCHEDULED',
      paidAt: null,
    });

    const result = await invokeTool('create_scheduled_payment', {
      ...houseArgs,
      card_id: 9,
      due_date: '2026-09-01',
      amount: 500,
      label: 'Cuota',
    });

    expect(result.isError).toBeFalsy();
    expect(createScheduledPayment).toHaveBeenCalledWith(
      9,
      { user_id: null, house_id: 3 },
      expect.objectContaining({ due_date: '2026-09-01', amount: 500 }),
    );
  });

  it('upsert_card_payment_plan calls service', async () => {
    upsertCreditCardPaymentPlan.mockResolvedValue({
      credit_card_wallet_id: 9,
      fortnight_id: 55,
      planned_amount: '1200',
    });

    const result = await invokeTool('upsert_card_payment_plan', {
      ...houseArgs,
      card_id: 9,
      fortnight_id: 55,
      planned_amount: 1200,
    });

    expect(result.isError).toBeFalsy();
    expect(upsertCreditCardPaymentPlan).toHaveBeenCalledWith(
      { user_id: null, house_id: 3 },
      55,
      9,
      1200,
    );
  });
});

describe('registered list_wallet_movements', () => {
  it('rejects credit card wallets', async () => {
    resolveWalletRef.mockResolvedValueOnce({
      id: 9,
      name: 'Visa',
      type: 'CREDIT_CARD',
    });

    const result = await invokeTool('list_wallet_movements', {
      ...houseArgs,
      wallet_id: 9,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('list_card_movements');
    expect(listWalletMovements).not.toHaveBeenCalled();
  });

  it('loads movements for funding wallets', async () => {
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

    const result = await invokeTool('list_wallet_movements', {
      ...houseArgs,
      wallet_id: 4,
    });

    expect(result.isError).toBeFalsy();
    expect(listWalletMovements).toHaveBeenCalledWith(
      4,
      { user_id: null, house_id: 3 },
      '2026-08-01',
      '2026-08-31',
    );
    expect(parseResult(result).movements).toHaveLength(1);
  });
});
