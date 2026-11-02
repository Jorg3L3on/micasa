import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Behavior tests for the loan write tools and `delete`: the real tool code and
 * the real finance services run against an in-memory Prisma double (rows per
 * model, where / include / increment semantics). Assertions read the rows the
 * services left behind, not the arguments they forwarded.
 */

type Row = Record<string, unknown>;

const db = vi.hoisted(() => {
  type R = Record<string, unknown>;
  type W = Record<string, unknown>;
  type Rel =
    | { kind: 'one'; table: string; key: string }
    | { kind: 'many'; table: string; fk: string; orderBy?: string }
    | { kind: 'back'; table: string; fk: string };

  const TABLES = [
    'wallet',
    'loan',
    'loanPayment',
    'lender',
    'lenderPayment',
    'expense',
    'fortnight',
    'category',
    'income',
    'incomeTemplate',
    'expenseTemplate',
    'budget',
    'budgetPeriod',
    'budgetAllocation',
    'creditCardPayment',
    'creditCardScheduledPayment',
    'transfer',
  ] as const;

  const RELATIONS: Record<string, Record<string, Rel>> = {
    loan: {
      payments: { kind: 'many', table: 'loanPayment', fk: 'loan_id', orderBy: 'sequence' },
      source_wallet: { kind: 'one', table: 'wallet', key: 'source_wallet_id' },
      linked_wallet: { kind: 'one', table: 'wallet', key: 'linked_wallet_id' },
      income_template: { kind: 'one', table: 'incomeTemplate', key: 'income_template_id' },
    },
    loanPayment: {
      loan: { kind: 'one', table: 'loan', key: 'loan_id' },
      source_wallet: { kind: 'one', table: 'wallet', key: 'source_wallet_id' },
      linked_expense: { kind: 'back', table: 'expense', fk: 'loan_payment_id' },
    },
    expense: {
      wallet: { kind: 'one', table: 'wallet', key: 'wallet_id' },
      category: { kind: 'one', table: 'category', key: 'category_id' },
      loan_payment: { kind: 'one', table: 'loanPayment', key: 'loan_payment_id' },
      transferAsUser: { kind: 'back', table: 'transfer', fk: 'expense_as_user_id' },
    },
    lenderPayment: {
      source_wallet: { kind: 'one', table: 'wallet', key: 'source_wallet_id' },
      loan_payments: { kind: 'many', table: 'loanPayment', fk: 'lender_payment_id' },
    },
    budgetAllocation: { budget: { kind: 'one', table: 'budget', key: 'budget_id' } },
  };

  const DECIMALS = new Set(['amount', 'principal_amount', 'payment_amount']);

  const DEFAULTS: Record<string, () => R> = {
    loan: () => ({ status: 'ACTIVE', notes: null, created_at: new Date() }),
    loanPayment: () => ({
      status: 'SCHEDULED',
      paid_at: null,
      note: null,
      source_wallet_id: null,
      lender_payment_id: null,
    }),
    lenderPayment: () => ({ expense_id: null, allocation: null }),
    expense: () => ({ created_at: new Date(), loan_payment_id: null }),
    category: () => ({ parent_id: null, active: true }),
  };

  const rows: Record<string, R[]> = {};
  const nextId: Record<string, number> = {};
  const writes: Array<{ table: string; op: string }> = [];

  const reset = () => {
    for (const table of TABLES) {
      rows[table] = [];
      nextId[table] = 1000;
    }
    writes.length = 0;
  };
  reset();

  const isPlainObject = (value: unknown): value is R =>
    value != null && typeof value === 'object' && !(value instanceof Date) && !Array.isArray(value);

  const norm = (value: unknown) => (value instanceof Date ? value.getTime() : value);

  const matchValue = (actual: unknown, cond: unknown): boolean => {
    if (cond === null) return actual == null;
    if (!isPlainObject(cond)) return norm(actual) === norm(cond);
    for (const [op, expected] of Object.entries(cond)) {
      if (op === 'mode') continue;
      const a = norm(actual) as number;
      const e = norm(expected) as number;
      if (op === 'in' && !(expected as unknown[]).includes(actual)) return false;
      if (op === 'notIn' && (expected as unknown[]).includes(actual)) return false;
      if (op === 'not' && matchValue(actual, expected)) return false;
      if (op === 'gt' && !(a > e)) return false;
      if (op === 'gte' && !(a >= e)) return false;
      if (op === 'lt' && !(a < e)) return false;
      if (op === 'lte' && !(a <= e)) return false;
      if (op === 'equals') {
        const insensitive = cond.mode === 'insensitive';
        const left = insensitive ? String(actual).toLowerCase() : actual;
        const right = insensitive ? String(expected).toLowerCase() : expected;
        if (left !== right) return false;
      }
    }
    return true;
  };

  const related = (table: string, row: R, name: string): R | R[] | null => {
    const rel = RELATIONS[table]?.[name];
    if (!rel) return null;
    if (rel.kind === 'one') {
      return rows[rel.table]!.find((other) => other.id === row[rel.key]) ?? null;
    }
    if (rel.kind === 'back') {
      return rows[rel.table]!.find((other) => other[rel.fk] === row.id) ?? null;
    }
    const list = rows[rel.table]!.filter((other) => other[rel.fk] === row.id);
    return rel.orderBy
      ? [...list].sort((a, b) => Number(a[rel.orderBy!]) - Number(b[rel.orderBy!]))
      : list;
  };

  const matches = (table: string, row: R, where: W | undefined): boolean => {
    for (const [key, cond] of Object.entries(where ?? {})) {
      if (key === 'OR') {
        if (!(cond as W[]).some((sub) => matches(table, row, sub))) return false;
        continue;
      }
      if (key === 'AND') {
        if (!(cond as W[]).every((sub) => matches(table, row, sub))) return false;
        continue;
      }
      const rel = RELATIONS[table]?.[key];
      if (rel && rel.kind !== 'many') {
        const target = related(table, row, key) as R | null;
        if (cond === null ? target != null : !target || !matches(rel.table, target, cond as W)) {
          return false;
        }
        continue;
      }
      if (!matchValue(row[key], cond)) return false;
    }
    return true;
  };

  const shape = (table: string, row: R, spec?: { include?: R; select?: R }): R => {
    const out: R = { ...row };
    const fields = { ...(spec?.include ?? {}), ...(spec?.select ?? {}) };
    for (const [name, nested] of Object.entries(fields)) {
      const rel = RELATIONS[table]?.[name];
      if (!rel || !nested) continue;
      const nestedSpec = nested === true ? undefined : (nested as { include?: R; select?: R; where?: W });
      const value = related(table, row, name);
      if (Array.isArray(value)) {
        out[name] = value
          .filter((child) => matches(rel.table, child, nestedSpec?.where))
          .map((child) => shape(rel.table, child, nestedSpec));
      } else {
        out[name] = value ? shape(rel.table, value, nestedSpec) : null;
      }
    }
    return out;
  };

  const applyData = (row: R, data: R) => {
    for (const [key, value] of Object.entries(data)) {
      if (isPlainObject(value) && ('increment' in value || 'decrement' in value)) {
        const delta = Number(value.increment ?? 0) - Number(value.decrement ?? 0);
        row[key] = Math.round((Number(row[key] ?? 0) + delta) * 100) / 100;
      } else if (value === undefined) {
        continue;
      } else if (DECIMALS.has(key) && typeof value === 'string') {
        row[key] = Number(value);
      } else {
        row[key] = value;
      }
    }
  };

  const insert = (table: string, data: R): R => {
    const row: R = { ...(DEFAULTS[table]?.() ?? {}) };
    const nestedCreates: Array<[Rel & { kind: 'many' }, R[]]> = [];
    const plain: R = {};
    for (const [key, value] of Object.entries(data)) {
      const rel = RELATIONS[table]?.[key];
      if (rel?.kind === 'many' && isPlainObject(value) && 'create' in value) {
        nestedCreates.push([rel, value.create as R[]]);
      } else {
        plain[key] = value;
      }
    }
    applyData(row, plain);
    row.id ??= nextId[table]!++;
    rows[table]!.push(row);
    writes.push({ table, op: 'create' });
    for (const [rel, children] of nestedCreates) {
      for (const child of children) insert(rel.table, { ...child, [rel.fk]: row.id });
    }
    return row;
  };

  const remove = (table: string, row: R) => {
    rows[table] = rows[table]!.filter((other) => other !== row);
    if (table === 'loan') {
      rows.loanPayment = rows.loanPayment!.filter((payment) => payment.loan_id !== row.id);
    }
  };

  const mustFind = (table: string, where: W) => {
    const row = rows[table]!.find((candidate) => matches(table, candidate, where));
    if (!row) throw new Error(`fake prisma: ${table} not found for ${JSON.stringify(where)}`);
    return row;
  };

  type Args = { where?: W; data?: R; include?: R; select?: R; _max?: R };

  const model = (table: string) => ({
    findFirst: async (args: Args = {}) => {
      const row = rows[table]!.find((candidate) => matches(table, candidate, args.where));
      return row ? shape(table, row, args) : null;
    },
    findUnique: async (args: Args = {}) => {
      const row = rows[table]!.find((candidate) => matches(table, candidate, args.where));
      return row ? shape(table, row, args) : null;
    },
    findMany: async (args: Args = {}) =>
      rows[table]!
        .filter((candidate) => matches(table, candidate, args.where))
        .map((row) => shape(table, row, args)),
    count: async (args: Args = {}) =>
      rows[table]!.filter((candidate) => matches(table, candidate, args.where)).length,
    aggregate: async (args: Args = {}) => {
      const list = rows[table]!.filter((candidate) => matches(table, candidate, args.where));
      const max: R = {};
      for (const key of Object.keys(args._max ?? {})) {
        max[key] = list.length ? Math.max(...list.map((row) => Number(row[key]))) : null;
      }
      return { _max: max };
    },
    create: async (args: Args) => shape(table, insert(table, args.data ?? {}), args),
    createMany: async (args: { data: R[] }) => {
      for (const data of args.data) insert(table, data);
      return { count: args.data.length };
    },
    update: async (args: Args) => {
      const row = mustFind(table, args.where ?? {});
      applyData(row, args.data ?? {});
      writes.push({ table, op: 'update' });
      return shape(table, row, args);
    },
    updateMany: async (args: Args) => {
      const list = rows[table]!.filter((candidate) => matches(table, candidate, args.where));
      for (const row of list) applyData(row, args.data ?? {});
      writes.push({ table, op: 'updateMany' });
      return { count: list.length };
    },
    delete: async (args: Args) => {
      const row = mustFind(table, args.where ?? {});
      remove(table, row);
      writes.push({ table, op: 'delete' });
      return row;
    },
    deleteMany: async (args: Args = {}) => {
      const list = rows[table]!.filter((candidate) => matches(table, candidate, args.where));
      for (const row of list) remove(table, row);
      writes.push({ table, op: 'deleteMany' });
      return { count: list.length };
    },
  });

  const auth = {
    houseMemberFindFirst: (() => {
      let impl: () => Promise<unknown> = async () => null;
      const fn = (() => impl()) as (() => Promise<unknown>) & { set: (v: unknown) => void };
      fn.set = (value) => {
        impl = async () => value;
      };
      return fn;
    })(),
    allowedContextsFindMany: (() => {
      let impl: () => Promise<unknown> = async () => [];
      const fn = (() => impl()) as (() => Promise<unknown>) & { set: (v: unknown) => void };
      fn.set = (value) => {
        impl = async () => value;
      };
      return fn;
    })(),
  };

  const client: R = {
    houseMember: { findFirst: auth.houseMemberFindFirst },
    agentConnectionAllowedContext: { findMany: auth.allowedContextsFindMany },
  };
  for (const table of TABLES) client[table] = model(table);
  client.$transaction = async (fn: (tx: R) => Promise<unknown>) => fn(client);

  return { rows, writes, reset, insert, client, auth };
});

vi.mock('@/lib/prisma', () => ({ default: db.client }));

import { registerLoanTools } from '@/lib/mcp/tools/loans';
import { registerDeleteTools } from '@/lib/mcp/tools/delete';
import {
  HOUSE,
  HOUSE_FILTER,
  HOUSE_ID,
  authPrismaMocks,
  callTool,
} from '@/lib/mcp/behavior/harness';

const loanTool = (name: string, args: Record<string, unknown>) =>
  callTool(registerLoanTools, name, { ...HOUSE, ...args });
const deleteTool = (kind: string, id: number) =>
  callTool(registerDeleteTools, 'delete', { ...HOUSE, kind, id, confirm: true });

const table = (name: string): Row[] => db.rows[name]!;
const byId = (name: string, id: number): Row | undefined =>
  table(name).find((row) => row.id === id);
const seed = (name: string, data: Row): Row => db.insert(name, data);
const ymd = (value: unknown) => (value as Date).toISOString().slice(0, 10);

const CASH_WALLET_ID = 7;
const seedCashWallet = (amount: number, extra: Row = {}) =>
  seed('wallet', {
    id: CASH_WALLET_ID,
    ...HOUSE_FILTER,
    name: 'Efectivo',
    type: 'CASH',
    amount,
    credit_limit: null,
    temporary_credit_limit: null,
    ...extra,
  });

/** Wallet-paid personal loan with `payments` installments of 1000. */
const seedWalletLoan = (input: {
  id: number;
  dues: string[];
  statuses?: string[];
  lenderId?: number;
}) => {
  seed('loan', {
    id: input.id,
    ...HOUSE_FILTER,
    name: 'Préstamo auto',
    lender: 'Banco Azteca',
    lender_id: input.lenderId ?? null,
    type: 'PERSONAL',
    status: 'ACTIVE',
    principal_amount: 1000 * input.dues.length,
    payment_amount: 1000,
    payment_count: input.dues.length,
    frequency: 'MONTHLY',
    start_date: new Date(`${input.dues[0]}T12:00:00.000Z`),
    payment_source: 'WALLET',
    source_wallet_id: CASH_WALLET_ID,
    linked_wallet_id: null,
    income_template_id: null,
  });
  input.dues.forEach((due, index) =>
    seed('loanPayment', {
      id: input.id * 10 + index + 1,
      loan_id: input.id,
      sequence: index + 1,
      due_date: new Date(`${due}T00:00:00.000Z`),
      amount: 1000,
      status: input.statuses?.[index] ?? 'SCHEDULED',
      paid_at: null,
      source_wallet_id: CASH_WALLET_ID,
    }),
  );
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-03-10T18:00:00.000Z'));
  db.reset();
  db.auth.houseMemberFindFirst.set(authPrismaMocks.membership);
  db.auth.allowedContextsFindMany.set(authPrismaMocks.allowedContexts);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('create_loan', () => {
  it('writes the loan, its schedule and marks paid_payments_count installments PAID without moving the wallet', async () => {
    seedCashWallet(5000);

    const result = await loanTool('create_loan', {
      name: 'Préstamo moto',
      lender: 'Banco Azteca',
      payment_amount: 1000,
      payment_count: 4,
      start_date: '2026-01-15',
      frequency: 'MONTHLY',
      payment_source: 'WALLET',
      source_wallet_id: CASH_WALLET_ID,
      paid_payments_count: 2,
    });

    expect(result.isError).toBeFalsy();
    const [loan] = table('loan');
    expect(loan).toMatchObject({
      ...HOUSE_FILTER,
      name: 'Préstamo moto',
      lender: 'Banco Azteca',
      type: 'PERSONAL',
      principal_amount: 4000,
      payment_amount: 1000,
      payment_count: 4,
      payment_source: 'WALLET',
      source_wallet_id: CASH_WALLET_ID,
    });
    expect(table('lender')).toEqual([
      expect.objectContaining({ ...HOUSE_FILTER, name: 'Banco Azteca', id: loan!.lender_id }),
    ]);

    const payments = table('loanPayment')
      .filter((row) => row.loan_id === loan!.id)
      .sort((a, b) => Number(a.sequence) - Number(b.sequence));
    expect(payments.map((row) => [row.sequence, ymd(row.due_date), row.amount, row.status])).toEqual([
      [1, '2026-01-15', 1000, 'PAID'],
      [2, '2026-02-15', 1000, 'PAID'],
      [3, '2026-03-15', 1000, 'SCHEDULED'],
      [4, '2026-04-15', 1000, 'SCHEDULED'],
    ]);
    expect(ymd(payments[0]!.paid_at)).toBe('2026-01-15');
    expect(payments[0]!.source_wallet_id).toBeNull();
    expect(byId('wallet', CASH_WALLET_ID)!.amount).toBe(5000);
    expect(table('expense')).toHaveLength(0);
    expect(loan!.status).toBe('ACTIVE');
    expect(result.body).toEqual({ loan_id: loan!.id, name: 'Préstamo moto', paid_payments: 2 });
  });

  it('defaults to a payroll loan with no wallet and an all-scheduled calendar', async () => {
    const result = await loanTool('create_loan', {
      name: 'Nómina',
      payment_amount: 500,
      payment_count: 2,
      start_date: '2026-04-01',
    });

    expect(result.isError).toBeFalsy();
    const [loan] = table('loan');
    expect(loan).toMatchObject({
      type: 'PAYROLL',
      payment_source: 'PAYROLL_DEDUCTION',
      source_wallet_id: null,
      lender: 'Prestamista',
    });
    expect(table('loanPayment').map((row) => row.status)).toEqual(['SCHEDULED', 'SCHEDULED']);
    expect(result.body).toMatchObject({ paid_payments: 0 });
  });
});

describe('update_loan', () => {
  const seedHalfPaidLoan = () => {
    seedCashWallet(5000);
    seedWalletLoan({
      id: 5,
      dues: ['2026-02-15', '2026-03-15', '2026-04-15', '2026-05-15'],
      statuses: ['PAID', 'SCHEDULED', 'SCHEDULED', 'SCHEDULED'],
    });
  };
  const scheduleOf = (loanId: number) =>
    table('loanPayment')
      .filter((row) => row.loan_id === loanId)
      .sort((a, b) => Number(a.sequence) - Number(b.sequence))
      .map((row) => [row.sequence, ymd(row.due_date), row.amount, row.status]);

  it('renames the loan and regenerates only the scheduled installments from next_payment_date', async () => {
    seedHalfPaidLoan();

    const result = await loanTool('update_loan', {
      loan_id: 5,
      name: 'Préstamo coche',
      payment_amount: 1500,
      payment_count: 5,
      next_payment_date: '2026-03-20',
    });

    expect(result.isError).toBeFalsy();
    expect(byId('loan', 5)).toMatchObject({
      name: 'Préstamo coche',
      payment_amount: 1500,
      payment_count: 5,
    });
    expect(scheduleOf(5)).toEqual([
      [1, '2026-02-15', 1000, 'PAID'],
      [2, '2026-03-20', 1500, 'SCHEDULED'],
      [3, '2026-04-20', 1500, 'SCHEDULED'],
      [4, '2026-05-20', 1500, 'SCHEDULED'],
      [5, '2026-06-20', 1500, 'SCHEDULED'],
    ]);
    const payments = table('loanPayment').filter((row) => row.loan_id === 5);
    expect(payments.some((row) => row.id === 51)).toBe(true);
    expect(payments.every((row) => row.source_wallet_id === CASH_WALLET_ID)).toBe(true);
    expect(result.body).toEqual({
      loan_id: 5,
      name: 'Préstamo coche',
      paid_payments: 1,
      remaining_payments: 4,
    });
  });

  it('without next_payment_date rewrites amounts and count of the scheduled tail', async () => {
    seedHalfPaidLoan();

    const result = await loanTool('update_loan', { loan_id: 5, payment_amount: 1500, payment_count: 5 });

    expect(result.isError).toBeFalsy();
    expect(scheduleOf(5).map(([sequence, , amount, status]) => [sequence, amount, status])).toEqual([
      [1, 1000, 'PAID'],
      [2, 1500, 'SCHEDULED'],
      [3, 1500, 'SCHEDULED'],
      [4, 1500, 'SCHEDULED'],
      [5, 1500, 'SCHEDULED'],
    ]);
  });

  // Regression: the first SCHEDULED due_date is a @db.Date (00:00 UTC); it used to
  // shift every regenerated due date one day earlier (2026-03-15 → 2026-03-14).
  it('without next_payment_date keeps the due days of the scheduled installments', async () => {
    seedHalfPaidLoan();

    await loanTool('update_loan', { loan_id: 5, payment_amount: 1500, payment_count: 5 });

    expect(scheduleOf(5).map(([, due]) => due)).toEqual([
      '2026-02-15',
      '2026-03-15',
      '2026-04-15',
      '2026-05-15',
      '2026-06-15',
    ]);
  });

  it('rejects a payment_count below the paid installments and keeps the schedule', async () => {
    seedCashWallet(5000);
    seedWalletLoan({
      id: 5,
      dues: ['2026-01-15', '2026-02-15', '2026-03-15'],
      statuses: ['PAID', 'PAID', 'SCHEDULED'],
    });
    const before = structuredClone(table('loanPayment'));

    const result = await loanTool('update_loan', { loan_id: 5, payment_count: 1 });

    expect(result.isError).toBe(true);
    expect(result.body).toMatchObject({ code: 'VALIDATION' });
    expect(table('loanPayment')).toEqual(before);
    expect(byId('loan', 5)!.payment_count).toBe(3);
  });

  // Regression: the metadata update used to be committed before the schedule check.
  it('a rejected schedule change does not persist the rename sent with it', async () => {
    seedCashWallet(5000);
    seedWalletLoan({
      id: 5,
      dues: ['2026-01-15', '2026-02-15', '2026-03-15'],
      statuses: ['PAID', 'PAID', 'SCHEDULED'],
    });

    const result = await loanTool('update_loan', { loan_id: 5, name: 'Renombrado', payment_count: 1 });

    expect(result.body).toMatchObject({ code: 'VALIDATION' });
    expect(byId('loan', 5)!.name).toBe('Préstamo auto');
  });

  it('answers NOT_FOUND for a loan of another owner', async () => {
    seedWalletLoan({ id: 5, dues: ['2026-03-15'] });
    byId('loan', 5)!.house_id = 99;

    const result = await loanTool('update_loan', { loan_id: 5, name: 'Ajeno' });

    expect(result.body).toMatchObject({ code: 'NOT_FOUND' });
    expect(byId('loan', 5)!.name).toBe('Préstamo auto');
  });
});

describe('add_loan_payment', () => {
  it('MARK_PAID with a source wallet lowers its balance, marks the payment PAID and books the expense', async () => {
    seedCashWallet(5000);
    seedWalletLoan({ id: 5, dues: ['2026-03-15', '2026-04-15'] });

    const result = await loanTool('add_loan_payment', {
      payment_id: 51,
      action: 'MARK_PAID',
      source_wallet_id: CASH_WALLET_ID,
      paid_at: '2026-03-12',
    });

    expect(result.isError).toBeFalsy();
    expect(byId('wallet', CASH_WALLET_ID)!.amount).toBe(4000);
    expect(byId('loanPayment', 51)).toMatchObject({
      status: 'PAID',
      source_wallet_id: CASH_WALLET_ID,
    });
    expect(ymd(byId('loanPayment', 51)!.paid_at)).toBe('2026-03-12');
    expect(byId('loanPayment', 52)!.status).toBe('SCHEDULED');

    const [expense] = table('expense');
    expect(expense).toMatchObject({
      ...HOUSE_FILTER,
      amount: 1000,
      is_paid: true,
      wallet_id: CASH_WALLET_ID,
      loan_payment_id: 51,
      description: 'Pago préstamo: Préstamo auto (Banco Azteca)',
    });
    const [fortnight] = table('fortnight');
    expect(fortnight).toMatchObject({ house_id: HOUSE_ID, year: 2026, month: 3, period: 'FIRST' });
    expect(expense!.fortnight_id).toBe(fortnight!.id);
    expect(byId('category', Number(expense!.category_id))).toMatchObject({
      ...HOUSE_FILTER,
      name: 'Préstamos',
      kind: 'EXPENSE',
    });
    expect(byId('loan', 5)!.status).toBe('ACTIVE');
    expect(result.body).toEqual({ payment_id: 51, loan_id: 5, status: 'PAID', action: 'MARK_PAID' });
  });

  it('MARK_PAID on the last open installment pays the loan off', async () => {
    seedCashWallet(5000);
    seedWalletLoan({
      id: 5,
      dues: ['2026-02-15', '2026-03-15'],
      statuses: ['PAID', 'SCHEDULED'],
    });

    await loanTool('add_loan_payment', {
      payment_id: 52,
      action: 'MARK_PAID',
      source_wallet_name: 'efectivo',
    });

    expect(byId('wallet', CASH_WALLET_ID)!.amount).toBe(4000);
    expect(byId('loanPayment', 52)!.status).toBe('PAID');
    expect(byId('loan', 5)!.status).toBe('PAID_OFF');
  });

  it('MARK_PAID without a wallet answers VALIDATION and writes nothing', async () => {
    seedCashWallet(5000);
    seedWalletLoan({ id: 5, dues: ['2026-03-15'] });
    db.writes.length = 0;

    const result = await loanTool('add_loan_payment', { payment_id: 51, action: 'MARK_PAID' });

    expect(result.isError).toBe(true);
    expect(result.body).toEqual({
      error: 'MARK_PAID requiere source_wallet_id o source_wallet_name',
      code: 'VALIDATION',
    });
    expect(db.writes).toEqual([]);
    expect(byId('loanPayment', 51)!.status).toBe('SCHEDULED');
    expect(byId('wallet', CASH_WALLET_ID)!.amount).toBe(5000);
  });

  it('MARK_PAID with an insufficient balance answers VALIDATION and leaves the payment scheduled', async () => {
    seedCashWallet(300);
    seedWalletLoan({ id: 5, dues: ['2026-03-15'] });

    const result = await loanTool('add_loan_payment', {
      payment_id: 51,
      action: 'MARK_PAID',
      source_wallet_id: CASH_WALLET_ID,
    });

    expect(result.body).toMatchObject({ code: 'VALIDATION' });
    expect(byId('wallet', CASH_WALLET_ID)!.amount).toBe(300);
    expect(byId('loanPayment', 51)!.status).toBe('SCHEDULED');
    expect(table('expense')).toHaveLength(0);
  });

  it('batch MARK_PAID_EXTERNAL marks every payment PAID and leaves wallets alone', async () => {
    seedCashWallet(5000);
    seedWalletLoan({ id: 5, dues: ['2026-03-15', '2026-04-15', '2026-05-15'] });

    const result = await loanTool('add_loan_payment', {
      payment_ids: [51, 52],
      action: 'MARK_PAID_EXTERNAL',
    });

    expect(result.body).toMatchObject({ batch: true, count: 2 });
    expect([51, 52, 53].map((id) => byId('loanPayment', id)!.status)).toEqual([
      'PAID',
      'PAID',
      'SCHEDULED',
    ]);
    expect(byId('wallet', CASH_WALLET_ID)!.amount).toBe(5000);
    expect(table('expense')).toHaveLength(0);
  });
});

describe('pay_lender', () => {
  it('pays the lender window from a wallet: lender payment + expense written, installment PAID, balance down', async () => {
    seedCashWallet(5000);
    seed('lender', { id: 3, ...HOUSE_FILTER, name: 'Banco Azteca', provider_icon_key: null, notes: null, active: true });
    seedWalletLoan({ id: 5, lenderId: 3, dues: ['2026-03-15', '2026-04-15', '2026-05-15'] });

    const result = await loanTool('pay_lender', {
      lender_id: 3,
      source_wallet_id: CASH_WALLET_ID,
      paid_at: '2026-03-10',
    });

    expect(result.isError).toBeFalsy();
    const [lenderPayment] = table('lenderPayment');
    expect(lenderPayment).toMatchObject({
      ...HOUSE_FILTER,
      lender_id: 3,
      amount: 1000,
      mode: 'WALLET',
      source_wallet_id: CASH_WALLET_ID,
    });
    expect(lenderPayment!.allocation).toMatchObject({ fullPaymentIds: [51], splits: [], reductions: [] });

    const [expense] = table('expense');
    expect(expense).toMatchObject({
      ...HOUSE_FILTER,
      amount: 1000,
      is_paid: true,
      wallet_id: CASH_WALLET_ID,
      description: 'Pago a Banco Azteca',
    });
    expect(lenderPayment!.expense_id).toBe(expense!.id);
    expect(byId('wallet', CASH_WALLET_ID)!.amount).toBe(4000);

    expect(byId('loanPayment', 51)).toMatchObject({
      status: 'PAID',
      lender_payment_id: lenderPayment!.id,
      source_wallet_id: CASH_WALLET_ID,
    });
    expect([52, 53].map((id) => byId('loanPayment', id)!.status)).toEqual(['SCHEDULED', 'SCHEDULED']);
    expect(result.body).toEqual({
      lender_id: 3,
      payment_id: lenderPayment!.id,
      amount: 1000,
      mode: 'WALLET',
      installment_count: 1,
    });
  });

  it('a partial EXTERNAL amount splits the installment and moves no wallet', async () => {
    seedCashWallet(5000);
    seed('lender', { id: 3, ...HOUSE_FILTER, name: 'Banco Azteca', provider_icon_key: null, notes: null, active: true });
    seedWalletLoan({ id: 5, lenderId: 3, dues: ['2026-03-15', '2026-04-15'] });

    const result = await loanTool('pay_lender', { lender_id: 3, mode: 'EXTERNAL', amount: 400 });

    expect(result.isError).toBeFalsy();
    expect(byId('wallet', CASH_WALLET_ID)!.amount).toBe(5000);
    expect(table('expense')).toHaveLength(0);
    expect(byId('loanPayment', 51)).toMatchObject({ status: 'SCHEDULED', amount: 600 });
    const paidSlice = table('loanPayment').find((row) => row.loan_id === 5 && row.sequence === 3);
    expect(paidSlice).toMatchObject({ status: 'PAID', amount: 400, source_wallet_id: null });
    expect(byId('loan', 5)!.payment_count).toBe(3);
    expect(result.body).toMatchObject({ amount: 400, mode: 'EXTERNAL', installment_count: 1 });
  });
});

describe('delete', () => {
  it('expense: reverts the paid amount into the wallet and removes the row', async () => {
    seedCashWallet(800);
    seed('expense', {
      id: 50,
      ...HOUSE_FILTER,
      amount: 200,
      is_paid: true,
      wallet_id: CASH_WALLET_ID,
      description: 'Súper',
    });

    const result = await deleteTool('expense', 50);

    expect(result.body).toEqual({ deleted: true, kind: 'expense', id: 50 });
    expect(byId('expense', 50)).toBeUndefined();
    expect(byId('wallet', CASH_WALLET_ID)!.amount).toBe(1000);
  });

  it('expense: an expense generated by a loan payment is locked and stays', async () => {
    seedCashWallet(800);
    seedWalletLoan({ id: 5, dues: ['2026-03-15'], statuses: ['PAID'] });
    seed('expense', {
      id: 50,
      ...HOUSE_FILTER,
      amount: 1000,
      is_paid: true,
      wallet_id: CASH_WALLET_ID,
      loan_payment_id: 51,
    });

    const result = await deleteTool('expense', 50);

    expect(result.body).toMatchObject({ code: 'VALIDATION' });
    expect(byId('expense', 50)).toBeDefined();
    expect(byId('wallet', CASH_WALLET_ID)!.amount).toBe(800);
  });

  it('income: takes the credited amount back out of the wallet and removes the row', async () => {
    seedCashWallet(5000);
    seed('income', {
      id: 60,
      ...HOUSE_FILTER,
      amount: 3000,
      wallet_id: CASH_WALLET_ID,
      wallet_credited: true,
      source: 'Nómina',
    });

    const result = await deleteTool('income', 60);

    expect(result.body).toEqual({ deleted: true, kind: 'income', id: 60 });
    expect(byId('income', 60)).toBeUndefined();
    expect(byId('wallet', CASH_WALLET_ID)!.amount).toBe(2000);
  });

  it('category: an unused category is deleted', async () => {
    seed('category', { id: 70, ...HOUSE_FILTER, name: 'Mascotas', kind: 'EXPENSE' });

    const result = await deleteTool('category', 70);

    expect(result.body).toEqual({ deleted: true, kind: 'category', id: 70 });
    expect(byId('category', 70)).toBeUndefined();
  });

  it('category: one with subcategories answers an error and is kept', async () => {
    seed('category', { id: 70, ...HOUSE_FILTER, name: 'Hogar', kind: 'EXPENSE' });
    seed('category', { id: 71, ...HOUSE_FILTER, name: 'Luz', kind: 'EXPENSE', parent_id: 70 });

    const result = await deleteTool('category', 70);

    expect(result.isError).toBe(true);
    expect(result.body).toEqual({
      error: 'Elimina primero las subcategorías de esta categoría',
      code: 'VALIDATION',
    });
    expect(byId('category', 70)).toBeDefined();
    expect(byId('category', 71)).toBeDefined();
  });

  it('category: one with expenses answers an error and is kept', async () => {
    seed('category', { id: 70, ...HOUSE_FILTER, name: 'Hogar', kind: 'EXPENSE' });
    seed('expense', { id: 50, ...HOUSE_FILTER, amount: 10, is_paid: false, category_id: 70 });

    const result = await deleteTool('category', 70);

    expect(result.body).toMatchObject({ code: 'VALIDATION' });
    expect(byId('category', 70)).toBeDefined();
  });

  it('budget: is deactivated and its future periods are dropped (current one kept)', async () => {
    seed('budget', { id: 80, ...HOUSE_FILTER, name: 'Súper', active: true });
    seed('budgetPeriod', { id: 801, budget_id: 80, start_date: new Date('2026-02-28T06:00:00.000Z') });
    seed('budgetPeriod', { id: 802, budget_id: 80, start_date: new Date('2026-03-15T06:00:00.000Z') });

    const result = await deleteTool('budget', 80);

    expect(result.body).toEqual({ deleted: true, kind: 'budget', id: 80 });
    expect(byId('budget', 80)!.active).toBe(false);
    expect(table('budgetPeriod').map((row) => row.id)).toEqual([801]);
  });

  it('expense_template: detaches its expenses and removes the template', async () => {
    seed('expenseTemplate', { id: 90, ...HOUSE_FILTER, name: 'Renta' });
    seed('expense', { id: 50, ...HOUSE_FILTER, amount: 10, is_paid: false, expense_template_id: 90 });
    seed('expense', { id: 51, ...HOUSE_FILTER, amount: 10, is_paid: false, expense_template_id: 90 });
    seed('expense', { id: 52, ...HOUSE_FILTER, amount: 10, is_paid: false, expense_template_id: 91 });

    const result = await deleteTool('expense_template', 90);

    expect(result.body).toEqual({
      deleted: true,
      kind: 'expense_template',
      id: 90,
      detached_expense_count: 2,
    });
    expect(byId('expenseTemplate', 90)).toBeUndefined();
    expect([50, 51, 52].map((id) => byId('expense', id)!.expense_template_id)).toEqual([
      null,
      null,
      91,
    ]);
  });

  it('income_template: an unused template is deleted', async () => {
    seed('incomeTemplate', { id: 95, ...HOUSE_FILTER, name: 'Nómina' });

    const result = await deleteTool('income_template', 95);

    expect(result.body).toEqual({ deleted: true, kind: 'income_template', id: 95 });
    expect(byId('incomeTemplate', 95)).toBeUndefined();
  });

  it('income_template: one in use answers an error and is kept', async () => {
    seed('incomeTemplate', { id: 95, ...HOUSE_FILTER, name: 'Nómina' });
    seed('income', { id: 60, ...HOUSE_FILTER, amount: 100, income_template_id: 95 });

    const result = await deleteTool('income_template', 95);

    expect(result.isError).toBe(true);
    expect(result.body).toEqual({
      error: 'La plantilla de ingresos está en uso y no puede eliminarse',
      code: 'VALIDATION',
    });
    expect(byId('incomeTemplate', 95)).toBeDefined();
  });

  it('loan: reverts wallet movements, deletes generated expenses, the loan and its payments', async () => {
    seedCashWallet(3000);
    seedWalletLoan({
      id: 5,
      dues: ['2026-01-15', '2026-02-15', '2026-03-15'],
      statuses: ['PAID', 'PAID', 'SCHEDULED'],
    });
    // Installment 1 was paid through a linked expense; installment 2 debited the wallet directly.
    seed('expense', {
      id: 50,
      ...HOUSE_FILTER,
      amount: 1000,
      is_paid: true,
      wallet_id: CASH_WALLET_ID,
      loan_payment_id: 51,
    });
    seed('expense', { id: 99, ...HOUSE_FILTER, amount: 5, is_paid: false });

    const result = await deleteTool('loan', 5);

    expect(result.body).toEqual({
      deleted: true,
      kind: 'loan',
      id: 5,
      loan_id: 5,
      deleted_payments: 3,
      deleted_generated_expenses: 1,
      reversed_wallet_movements: 2,
    });
    expect(byId('loan', 5)).toBeUndefined();
    expect(table('loanPayment')).toHaveLength(0);
    expect(table('expense').map((row) => row.id)).toEqual([99]);
    expect(byId('wallet', CASH_WALLET_ID)!.amount).toBe(5000);
  });

  it('loan: a loan of another owner answers NOT_FOUND and nothing is deleted', async () => {
    seedWalletLoan({ id: 5, dues: ['2026-03-15'] });
    byId('loan', 5)!.house_id = 99;

    const result = await deleteTool('loan', 5);

    expect(result.body).toMatchObject({ code: 'NOT_FOUND' });
    expect(byId('loan', 5)).toBeDefined();
    expect(table('loanPayment')).toHaveLength(1);
  });

  it('scheduled_payment: a pending one is deleted', async () => {
    seed('creditCardScheduledPayment', {
      id: 110,
      ...HOUSE_FILTER,
      credit_card_wallet_id: 8,
      status: 'PENDING',
      amount: 500,
    });

    const result = await deleteTool('scheduled_payment', 110);

    expect(result.body).toEqual({ deleted: true, kind: 'scheduled_payment', id: 110 });
    expect(byId('creditCardScheduledPayment', 110)).toBeUndefined();
  });

  it('scheduled_payment: a covered one answers an error and is kept', async () => {
    seed('creditCardScheduledPayment', {
      id: 110,
      ...HOUSE_FILTER,
      credit_card_wallet_id: 8,
      status: 'PAID',
      amount: 500,
    });

    const result = await deleteTool('scheduled_payment', 110);

    expect(result.body).toEqual({
      error: 'No se puede eliminar una cuota ya cubierta',
      code: 'VALIDATION',
    });
    expect(byId('creditCardScheduledPayment', 110)).toBeDefined();
  });

  it('without confirm: true nothing is deleted', async () => {
    seedCashWallet(800);
    seed('expense', { id: 50, ...HOUSE_FILTER, amount: 200, is_paid: true, wallet_id: CASH_WALLET_ID });

    const result = await callTool(registerDeleteTools, 'delete', { ...HOUSE, kind: 'expense', id: 50 });

    expect(result.body).toMatchObject({ code: 'CONFIRM_REQUIRED' });
    expect(byId('expense', 50)).toBeDefined();
    expect(byId('wallet', CASH_WALLET_ID)!.amount).toBe(800);
  });
});

