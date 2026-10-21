import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Behavior tests for the expense / income write tools: real tool code, real
 * finance services, Prisma replaced by a tiny in-memory store. Assertions
 * check the effect on the store (wallet balance, card debt, rows written).
 */

type Row = Record<string, unknown>;
type Tables = {
  wallet: Row[];
  category: Row[];
  fortnight: Row[];
  expense: Row[];
  income: Row[];
};

const db = vi.hoisted(() => {
  const state: { tables: Record<string, Row[]>; nextId: number } = {
    tables: {},
    nextId: 1000,
  };

  const matchesValue = (actual: unknown, expected: unknown): boolean => {
    if (expected !== null && typeof expected === 'object' && !(expected instanceof Date)) {
      const cond = expected as Record<string, unknown>;
      if ('in' in cond) return (cond.in as unknown[]).includes(actual);
      if ('equals' in cond) {
        return cond.mode === 'insensitive'
          ? String(actual).toLowerCase() === String(cond.equals).toLowerCase()
          : actual === cond.equals;
      }
      throw new Error(`unsupported where condition ${JSON.stringify(cond)}`);
    }
    return (actual ?? null) === expected;
  };

  const matches = (row: Row, where: Row = {}) =>
    Object.entries(where).every(([key, expected]) =>
      expected === undefined ? true : matchesValue(row[key], expected),
    );

  const withRelations = (table: string, row: Row): Row => {
    if (table !== 'expense' && table !== 'income') return { ...row };
    const wallet = state.tables.wallet!.find((w) => w.id === row.wallet_id) ?? null;
    const category = state.tables.category!.find((c) => c.id === row.category_id) ?? null;
    return {
      ...row,
      wallet,
      category,
      loan_payment: null,
      transferAsUser: null,
      credit_card_payment: null,
    };
  };

  const applyData = (row: Row, data: Row) => {
    for (const [key, value] of Object.entries(data)) {
      if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
        const op = value as { increment?: number; decrement?: number };
        if (op.increment != null) row[key] = Number(row[key]) + op.increment;
        else if (op.decrement != null) row[key] = Number(row[key]) - op.decrement;
        else throw new Error(`unsupported data op ${JSON.stringify(value)}`);
      } else if (value !== undefined) {
        row[key] = value;
      }
    }
  };

  const model = (table: string) => ({
    findFirst: vi.fn(async ({ where }: { where?: Row } = {}) => {
      const row = state.tables[table]!.find((r) => matches(r, where));
      return row ? withRelations(table, row) : null;
    }),
    findUnique: vi.fn(async ({ where }: { where: Row }) => {
      const row = state.tables[table]!.find((r) => matches(r, where));
      return row ? withRelations(table, row) : null;
    }),
    findMany: vi.fn(async ({ where }: { where?: Row } = {}) =>
      state.tables[table]!.filter((r) => matches(r, where)).map((r) => withRelations(table, r)),
    ),
    create: vi.fn(async ({ data }: { data: Row }) => {
      const row: Row = { id: state.nextId++, created_at: new Date('2026-10-05T18:00:00.000Z') };
      applyData(row, data);
      state.tables[table]!.push(row);
      return withRelations(table, row);
    }),
    update: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
      const row = state.tables[table]!.find((r) => matches(r, where));
      if (!row) throw new Error(`${table} ${JSON.stringify(where)} not found`);
      applyData(row, data);
      return withRelations(table, row);
    }),
  });

  const client = {
    houseMember: { findFirst: vi.fn() },
    agentConnectionAllowedContext: { findMany: vi.fn() },
    wallet: model('wallet'),
    category: model('category'),
    fortnight: model('fortnight'),
    expense: model('expense'),
    income: model('income'),
    creditCardPayment: { findFirst: vi.fn(async () => null) },
    transfer: { findFirst: vi.fn(async () => null) },
    expenseTemplate: { findUnique: vi.fn(async () => null) },
  };

  const prisma = {
    ...client,
    $transaction: vi.fn(async (fn: (tx: typeof client) => unknown) => fn(client)),
  };

  return { state, prisma };
});

vi.mock('@/lib/prisma', () => ({ default: db.prisma }));

import { registerExpenseTools } from '@/lib/mcp/tools/expenses';
import { registerIncomeTools } from '@/lib/mcp/tools/incomes';
import {
  authPrismaMocks,
  callTool,
  HOUSE,
  HOUSE_FILTER,
  HOUSE_ID,
} from '@/lib/mcp/behavior/harness';

const tables = () => db.state.tables as Tables;
const wallet = (id: number) => tables().wallet.find((w) => w.id === id)!;
const expense = (id: number) => tables().expense.find((e) => e.id === id)!;
const income = (id: number) => tables().income.find((i) => i.id === id)!;

const CASH = 1;
const DEBIT = 2;
const CARD = 3;
const OTHER_DEBIT = 4;
const GOAL = 5;
const CATEGORY = 7;

beforeEach(() => {
  vi.clearAllMocks();
  db.state.nextId = 1000;
  db.state.tables = {
    wallet: [
      { id: CASH, name: 'Efectivo', type: 'CASH', amount: 1000, credit_limit: null, temporary_credit_limit: null, ...HOUSE_FILTER },
      { id: DEBIT, name: 'Nómina', type: 'DEBIT_CARD', amount: 5000, credit_limit: null, temporary_credit_limit: null, ...HOUSE_FILTER },
      { id: CARD, name: 'Mercado Pago', type: 'CREDIT_CARD', amount: 2000, credit_limit: 10000, temporary_credit_limit: null, ...HOUSE_FILTER },
      { id: OTHER_DEBIT, name: 'Ahorro', type: 'DEBIT_CARD', amount: 300, credit_limit: null, temporary_credit_limit: null, ...HOUSE_FILTER },
      { id: GOAL, name: 'Viaje', type: 'GOAL', amount: 400, credit_limit: null, temporary_credit_limit: null, ...HOUSE_FILTER },
    ],
    category: [{ id: CATEGORY, name: 'Super', active: true, ...HOUSE_FILTER }],
    fortnight: [],
    expense: [],
    income: [],
  };
  db.prisma.houseMember.findFirst.mockResolvedValue(authPrismaMocks.membership);
  db.prisma.agentConnectionAllowedContext.findMany.mockResolvedValue(
    authPrismaMocks.allowedContexts,
  );
});

describe('add_expense', () => {
  it('funding wallet: lowers the balance, writes a paid row in the date fortnight', async () => {
    const res = await callTool(registerExpenseTools, 'add_expense', {
      ...HOUSE,
      wallet_name: 'efectivo',
      amount: 250,
      description: 'Tortillas',
      expense_date: '2026-10-05',
      category_id: CATEGORY,
    });

    expect(res.isError).toBeFalsy();
    expect(wallet(CASH).amount).toBe(750);
    expect(tables().expense).toHaveLength(1);
    const row = tables().expense[0]!;
    expect(row).toMatchObject({
      wallet_id: CASH,
      category_id: CATEGORY,
      amount: 250,
      is_paid: true,
      house_id: HOUSE_ID,
      user_id: null,
      due_day: 5,
    });
    // 2026-10-05 → FIRST fortnight of October 2026, created for the house.
    expect(tables().fortnight).toHaveLength(1);
    expect(tables().fortnight[0]).toMatchObject({
      id: row.fortnight_id,
      year: 2026,
      month: 10,
      period: 'FIRST',
      house_id: HOUSE_ID,
      user_id: null,
    });
    expect(res.body).toMatchObject({
      expense_id: row.id,
      wallet_id: CASH,
      effect: 'balance_decrease',
      new_balance_or_debt: 750,
      is_paid: true,
    });
  });

  it('funding wallet with is_paid: false records a pending row without moving the balance', async () => {
    const res = await callTool(registerExpenseTools, 'add_expense', {
      ...HOUSE,
      wallet_id: DEBIT,
      amount: 400,
      description: 'Luz',
      expense_date: '2026-10-20',
      is_paid: false,
    });

    expect(res.isError).toBeFalsy();
    expect(wallet(DEBIT).amount).toBe(5000);
    expect(tables().expense[0]).toMatchObject({ is_paid: false, wallet_id: DEBIT });
    expect(tables().fortnight[0]).toMatchObject({ month: 10, period: 'SECOND' });
    expect(res.body).toMatchObject({ effect: 'pending_expense', new_balance_or_debt: 5000 });
  });

  it('already_in_balance on a funding wallet writes the paid row without moving the balance', async () => {
    await callTool(registerExpenseTools, 'add_expense', {
      ...HOUSE,
      wallet_id: CASH,
      amount: 100,
      description: 'Histórico',
      expense_date: '2026-10-05',
      already_in_balance: true,
    });
    expect(wallet(CASH).amount).toBe(1000);
    expect(tables().expense[0]).toMatchObject({ is_paid: true, amount: 100 });
  });

  it('insufficient balance on a funding wallet → VALIDATION, nothing written', async () => {
    const res = await callTool(registerExpenseTools, 'add_expense', {
      ...HOUSE,
      wallet_id: OTHER_DEBIT,
      amount: 301,
      description: 'Demasiado',
      expense_date: '2026-10-05',
    });
    expect(res.isError).toBe(true);
    expect(res.body).toEqual({ error: 'Saldo insuficiente en la billetera', code: 'VALIDATION' });
    expect(wallet(OTHER_DEBIT).amount).toBe(300);
    expect(tables().expense).toHaveLength(0);
  });

  it('credit wallet: the purchase raises the debt and stores the installments', async () => {
    const res = await callTool(registerExpenseTools, 'add_expense', {
      ...HOUSE,
      wallet_id: CARD,
      amount: 1200,
      description: 'Lavadora MSI',
      expense_date: '2026-10-05',
      category_id: CATEGORY,
      installment_current: 2,
      installment_total: 12,
    });

    expect(res.isError).toBeFalsy();
    expect(wallet(CARD).amount).toBe(3200);
    expect(tables().expense[0]).toMatchObject({
      wallet_id: CARD,
      amount: 1200,
      is_paid: true,
      credit_installment_current: 2,
      credit_installment_total: 12,
      house_id: HOUSE_ID,
    });
    expect(res.body).toMatchObject({
      effect: 'debt_increase',
      new_balance_or_debt: 3200,
      installment: '2/12',
    });
  });

  it('credit wallet with already_in_balance records the purchase without raising the debt', async () => {
    await callTool(registerExpenseTools, 'add_expense', {
      ...HOUSE,
      wallet_id: CARD,
      amount: 500,
      description: 'Ya en el corte',
      expense_date: '2026-10-05',
      category_id: CATEGORY,
      already_in_balance: true,
    });
    expect(wallet(CARD).amount).toBe(2000);
    expect(tables().expense[0]).toMatchObject({ wallet_id: CARD, is_paid: true, amount: 500 });
  });

  it('credit wallet over the limit → VALIDATION, debt unchanged', async () => {
    const res = await callTool(registerExpenseTools, 'add_expense', {
      ...HOUSE,
      wallet_id: CARD,
      amount: 8001,
      description: 'Pantalla',
      expense_date: '2026-10-05',
      category_id: CATEGORY,
    });
    expect(res.isError).toBe(true);
    expect(res.body.code).toBe('VALIDATION');
    expect(wallet(CARD).amount).toBe(2000);
    expect(tables().expense).toHaveLength(0);
  });

  it('card purchase without a category → VALIDATION before anything is written', async () => {
    const res = await callTool(registerExpenseTools, 'add_expense', {
      ...HOUSE,
      wallet_id: CARD,
      amount: 10,
      description: 'Sin categoría',
      expense_date: '2026-10-05',
    });

    expect(res.isError).toBe(true);
    expect(res.body).toEqual({
      error: 'Las compras con tarjeta requieren categoría.',
      code: 'VALIDATION',
      hint: 'Indica category_id o category_name (de list_categories).',
    });
    expect(wallet(CARD).amount).toBe(2000);
    expect(tables().expense).toHaveLength(0);
    expect(tables().fortnight).toHaveLength(0);
  });

  it('installments on a cash wallet → VALIDATION, nothing written', async () => {
    const res = await callTool(registerExpenseTools, 'add_expense', {
      ...HOUSE,
      wallet_id: CASH,
      amount: 100,
      description: 'MSI en efectivo',
      expense_date: '2026-10-05',
      installment_current: 1,
      installment_total: 3,
    });

    expect(res.isError).toBe(true);
    expect(res.body).toEqual({
      error: 'installment_current / installment_total solo aplican a compras con tarjeta',
      code: 'VALIDATION',
    });
    expect(wallet(CASH).amount).toBe(1000);
    expect(tables().expense).toHaveLength(0);
    expect(tables().fortnight).toHaveLength(0);
  });

  it('wallet outside the context → NOT_FOUND, nothing written', async () => {
    tables().wallet.push({ id: 99, name: 'Ajena', type: 'CASH', amount: 50, user_id: 2, house_id: null });
    const res = await callTool(registerExpenseTools, 'add_expense', {
      ...HOUSE,
      wallet_id: 99,
      amount: 10,
      description: 'x',
    });
    expect(res.isError).toBe(true);
    expect(res.body.code).toBe('NOT_FOUND');
    expect(wallet(99).amount).toBe(50);
    expect(tables().expense).toHaveLength(0);
  });
});

const seedExpense = (row: Row) => {
  tables().fortnight.push({
    id: 500,
    year: 2026,
    month: 10,
    period: 'FIRST',
    ...HOUSE_FILTER,
  });
  const full: Row = {
    id: 77,
    fortnight_id: 500,
    category_id: CATEGORY,
    description: 'Super',
    payment_date: new Date('2026-10-05T12:00:00.000Z'),
    created_at: new Date('2026-10-05T12:00:00.000Z'),
    loan_payment_id: null,
    ...HOUSE_FILTER,
    ...row,
  };
  tables().expense.push(full);
  return full;
};

describe('update_expense', () => {
  it('amount edit on a paid funding expense applies only the difference', async () => {
    // Already paid 200 from cash: 1000 → 800 when it was registered.
    wallet(CASH).amount = 800;
    seedExpense({ wallet_id: CASH, amount: 200, is_paid: true });

    const res = await callTool(registerExpenseTools, 'update_expense', {
      ...HOUSE,
      expense_id: 77,
      amount: 350,
    });

    expect(res.isError).toBeFalsy();
    expect(wallet(CASH).amount).toBe(650);
    expect(expense(77)).toMatchObject({ amount: 350, is_paid: true, wallet_id: CASH });
    expect(db.prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('moving a paid expense to another wallet refunds the old one and charges the new one', async () => {
    wallet(CASH).amount = 800;
    seedExpense({ wallet_id: CASH, amount: 200, is_paid: true });

    const res = await callTool(registerExpenseTools, 'update_expense', {
      ...HOUSE,
      expense_id: 77,
      wallet_name: 'Mercado Pago',
    });

    expect(res.isError).toBeFalsy();
    expect(wallet(CASH).amount).toBe(1000);
    expect(wallet(CARD).amount).toBe(2200);
    expect(wallet(DEBIT).amount).toBe(5000);
    expect(expense(77)).toMatchObject({ wallet_id: CARD, is_paid: true });
  });

  it('editing the date of an unpaid expense re-files it without touching any balance', async () => {
    seedExpense({ wallet_id: DEBIT, amount: 400, is_paid: false });

    const res = await callTool(registerExpenseTools, 'update_expense', {
      ...HOUSE,
      expense_id: 77,
      expense_date: '2026-10-18',
      description: 'Luz (corregido)',
    });

    expect(res.isError).toBeFalsy();
    expect(wallet(DEBIT).amount).toBe(5000);
    const second = tables().fortnight.find((f) => f.period === 'SECOND')!;
    expect(second).toMatchObject({ year: 2026, month: 10, house_id: HOUSE_ID });
    expect(expense(77)).toMatchObject({
      fortnight_id: second.id,
      description: 'Luz (corregido)',
      due_day: 18,
      is_paid: false,
    });
    expect(db.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('only is_paid: true goes through the toggle and lowers the balance', async () => {
    seedExpense({ wallet_id: DEBIT, amount: 400, is_paid: false, payment_date: null });

    const res = await callTool(registerExpenseTools, 'update_expense', {
      ...HOUSE,
      expense_id: 77,
      is_paid: true,
    });

    expect(res.isError).toBeFalsy();
    expect(wallet(DEBIT).amount).toBe(4600);
    expect(expense(77).is_paid).toBe(true);
    expect(expense(77).payment_date).toBeInstanceOf(Date);
    // The toggle path checks the transfer / card-payment locks; updateExpense does not.
    expect(db.prisma.transfer.findFirst).toHaveBeenCalledWith({ where: { user_expense_id: 77 } });
    expect(res.body).toEqual({
      expense_id: 77,
      is_paid: true,
      amount: 400,
      description: 'Super',
      wallet_name: 'Nómina',
    });
  });

  it('only is_paid: false on a card purchase reverts the debt', async () => {
    seedExpense({ wallet_id: CARD, amount: 700, is_paid: true });

    const res = await callTool(registerExpenseTools, 'update_expense', {
      ...HOUSE,
      expense_id: 77,
      is_paid: false,
    });

    expect(res.isError).toBeFalsy();
    expect(wallet(CARD).amount).toBe(1300);
    expect(expense(77)).toMatchObject({ is_paid: false, payment_date: null });
  });

  it('a card-payment-generated expense cannot be toggled; balance unchanged', async () => {
    seedExpense({ wallet_id: DEBIT, amount: 400, is_paid: true });
    db.prisma.creditCardPayment.findFirst.mockResolvedValueOnce({ id: 3 } as never);

    const res = await callTool(registerExpenseTools, 'update_expense', {
      ...HOUSE,
      expense_id: 77,
      is_paid: false,
    });

    expect(res.isError).toBe(true);
    expect(res.body.code).toBe('VALIDATION');
    expect(wallet(DEBIT).amount).toBe(5000);
    expect(expense(77).is_paid).toBe(true);
  });

  it('no field and no is_paid → VALIDATION, nothing touched', async () => {
    seedExpense({ wallet_id: CASH, amount: 200, is_paid: true });
    const res = await callTool(registerExpenseTools, 'update_expense', {
      ...HOUSE,
      expense_id: 77,
    });
    expect(res.body).toEqual({ error: 'Indica al menos un campo a cambiar', code: 'VALIDATION' });
    expect(db.prisma.expense.update).not.toHaveBeenCalled();
  });
});

describe('add_income', () => {
  it('raises the wallet balance and writes a credited income row', async () => {
    const res = await callTool(registerIncomeTools, 'add_income', {
      ...HOUSE,
      wallet_name: 'Nómina',
      amount: 12000,
      description: '  Quincena  ',
      income_date: '2026-10-15',
    });

    expect(res.isError).toBeFalsy();
    expect(wallet(DEBIT).amount).toBe(17000);
    expect(tables().income).toHaveLength(1);
    const row = tables().income[0]!;
    expect(row).toMatchObject({
      wallet_id: DEBIT,
      amount: 12000,
      source: 'Quincena',
      wallet_credited: true,
      house_id: HOUSE_ID,
      user_id: null,
    });
    expect(tables().fortnight.find((f) => f.id === row.fortnight_id)).toMatchObject({
      year: 2026,
      month: 10,
      period: 'SECOND',
    });
    expect(res.body).toEqual({
      income_id: row.id,
      amount: 12000,
      received_at: '2026-10-15',
      wallet_id: DEBIT,
      new_balance: 17000,
    });
  });

  it('uses an explicit fortnight_id when given', async () => {
    tables().fortnight.push({ id: 600, year: 2026, month: 9, period: 'SECOND', ...HOUSE_FILTER });
    await callTool(registerIncomeTools, 'add_income', {
      ...HOUSE,
      wallet_id: CASH,
      amount: 50,
      income_date: '2026-10-05',
      fortnight_id: 600,
    });
    expect(wallet(CASH).amount).toBe(1050);
    expect(tables().income[0]).toMatchObject({ fortnight_id: 600, source: null });
    expect(tables().fortnight).toHaveLength(1);
  });

  it('credit wallet → VALIDATION, nothing written and debt unchanged', async () => {
    const res = await callTool(registerIncomeTools, 'add_income', {
      ...HOUSE,
      wallet_id: CARD,
      amount: 500,
      income_date: '2026-10-05',
    });

    expect(res.isError).toBe(true);
    expect(res.body).toEqual({
      error: 'No se puede registrar ingreso en una tarjeta.',
      code: 'VALIDATION',
      hint: 'Para pagar la tarjeta usa add_card_payment.',
    });
    expect(wallet(CARD).amount).toBe(2000);
    expect(tables().income).toHaveLength(0);
  });
});

describe('add_income goal wallet', () => {
  // update_income rejects goal wallets, so add_income must too: an income it
  // accepted could never be edited afterwards.
  it('goal wallet → VALIDATION, nothing written and balance unchanged', async () => {
    const res = await callTool(registerIncomeTools, 'add_income', {
      ...HOUSE,
      wallet_id: GOAL,
      amount: 500,
      income_date: '2026-10-05',
    });

    expect(res.isError).toBe(true);
    expect(res.body).toMatchObject({
      error: 'No se puede registrar ingreso en una meta.',
      code: 'VALIDATION',
    });
    expect(wallet(GOAL).amount).toBe(400);
    expect(tables().income).toHaveLength(0);
  });
});

describe('update_income', () => {
  const seedIncome = (row: Row) => {
    const full: Row = {
      id: 88,
      fortnight_id: 500,
      amount: 1000,
      source: 'Venta',
      received_at: new Date('2026-10-05T12:00:00.000Z'),
      wallet_id: CASH,
      wallet_credited: true,
      ...HOUSE_FILTER,
      ...row,
    };
    tables().income.push(full);
    return full;
  };

  it('amount edit on the same wallet applies only the difference', async () => {
    wallet(CASH).amount = 2000; // 1000 base + the 1000 income already credited
    seedIncome({});

    const res = await callTool(registerIncomeTools, 'update_income', {
      ...HOUSE,
      income_id: 88,
      amount: 1500,
    });

    expect(res.isError).toBeFalsy();
    expect(wallet(CASH).amount).toBe(2500);
    expect(income(88)).toMatchObject({ amount: 1500, wallet_id: CASH, wallet_credited: true });
    expect(res.body).toEqual({
      income_id: 88,
      amount: 1500,
      received_at: '2026-10-05',
      wallet_id: CASH,
      wallet_name: 'Efectivo',
      new_balance: 2500,
    });
  });

  it('moving to another wallet debits the old one and credits the new one', async () => {
    wallet(CASH).amount = 2000;
    seedIncome({});

    const res = await callTool(registerIncomeTools, 'update_income', {
      ...HOUSE,
      income_id: 88,
      amount: 1000,
      wallet_name: 'Ahorro',
    });

    expect(res.isError).toBeFalsy();
    expect(wallet(CASH).amount).toBe(1000);
    expect(wallet(OTHER_DEBIT).amount).toBe(1300);
    expect(income(88).wallet_id).toBe(OTHER_DEBIT);
  });

  it('an income never credited gets the full amount credited once', async () => {
    seedIncome({ wallet_credited: false });

    await callTool(registerIncomeTools, 'update_income', {
      ...HOUSE,
      income_id: 88,
      amount: 1000,
    });

    expect(wallet(CASH).amount).toBe(2000);
    expect(income(88).wallet_credited).toBe(true);
  });

  it('moving to a credit wallet → VALIDATION, balances unchanged', async () => {
    wallet(CASH).amount = 2000;
    seedIncome({});

    const res = await callTool(registerIncomeTools, 'update_income', {
      ...HOUSE,
      income_id: 88,
      amount: 1000,
      wallet_id: CARD,
    });

    expect(res.isError).toBe(true);
    expect(res.body).toEqual({
      error: 'La billetera debe ser de efectivo o débito.',
      code: 'VALIDATION',
    });
    expect(wallet(CASH).amount).toBe(2000);
    expect(wallet(CARD).amount).toBe(2000);
    expect(income(88).wallet_id).toBe(CASH);
  });
});
