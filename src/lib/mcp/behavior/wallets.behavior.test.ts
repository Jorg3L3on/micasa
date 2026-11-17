import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Behavior tests for the wallet write tools: the real tool code and the real
 * finance services run against an in-memory Prisma double, and each test
 * asserts the rows / balances that end up written.
 */

type Row = Record<string, unknown> & { id: number };

const { db, prismaMock, walletMock } = vi.hoisted(() => {
  const db = {
    wallets: new Map<number, Row>(),
    walletTransfers: [] as Row[],
    transfers: new Map<number, Row>(),
    expenses: [] as Row[],
    incomes: [] as Row[],
    fortnights: new Map<number, Row>(),
    users: new Map<number, Row>(),
    houses: new Map<number, Row>(),
    membership: null as unknown,
    allowedContexts: [] as unknown[],
    seq: 1000,
  };

  const matchValue = (actual: unknown, expected: unknown): boolean => {
    if (expected !== null && typeof expected === 'object' && !(expected instanceof Date)) {
      const cond = expected as Record<string, unknown>;
      if ('in' in cond) return (cond.in as unknown[]).includes(actual);
      if ('equals' in cond) {
        return cond.mode === 'insensitive'
          ? String(actual).toLowerCase() === String(cond.equals).toLowerCase()
          : actual === cond.equals;
      }
      throw new Error(`Unsupported where condition: ${JSON.stringify(cond)}`);
    }
    return (actual ?? null) === expected;
  };
  const matches = (row: Row, where: Record<string, unknown> = {}) =>
    Object.entries(where).every(([key, value]) => matchValue(row[key], value));

  const withAssignee = (row: Row) => ({ ...row, assignee: null });

  const applyData = (row: Row, data: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(data)) {
      if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
        const op = value as { increment?: number; decrement?: number };
        if (op.increment != null) row[key] = Number(row[key]) + op.increment;
        else if (op.decrement != null) row[key] = Number(row[key]) - op.decrement;
        else throw new Error(`Unsupported update op on ${key}`);
      } else if (value !== undefined) {
        row[key] = value;
      }
    }
  };

  const nextId = () => ++db.seq;

  const wallet = {
    findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
      const row = [...db.wallets.values()].find((w) => matches(w, where));
      return row ? withAssignee(row) : null;
    }),
    findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
      [...db.wallets.values()].filter((w) => matches(w, where)).map(withAssignee),
    ),
    findUnique: vi.fn(async ({ where }: { where: { id: number } }) => {
      const row = db.wallets.get(where.id);
      return row ? withAssignee(row) : null;
    }),
    findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: number } }) => {
      const row = db.wallets.get(where.id);
      if (!row) throw new Error(`wallet ${where.id} not found`);
      return withAssignee(row);
    }),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const row: Row = { ...data, id: nextId(), created_at: new Date() };
      db.wallets.set(row.id, row);
      return withAssignee(row);
    }),
    update: vi.fn(
      async ({ where, data }: { where: { id: number }; data: Record<string, unknown> }) => {
        const row = db.wallets.get(where.id);
        if (!row) throw new Error(`wallet ${where.id} not found`);
        applyData(row, data);
        return withAssignee(row);
      },
    ),
  };

  const prismaMock: Record<string, unknown> = {
    houseMember: { findFirst: vi.fn(async () => db.membership) },
    agentConnectionAllowedContext: { findMany: vi.fn(async () => db.allowedContexts) },
    wallet,
    expense: {
      aggregate: vi.fn(async () => ({ _sum: { amount: null } })),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row: Row = { ...data, id: nextId() };
        db.expenses.push(row);
        return row;
      }),
    },
    income: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row: Row = { ...data, id: nextId() };
        db.incomes.push(row);
        return row;
      }),
    },
    walletTransfer: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const { from_wallet, to_wallet, user, house, ...rest } = data as Record<
          string,
          { connect: { id: number } } | unknown
        >;
        const row: Row = {
          ...rest,
          id: nextId(),
          from_wallet_id: (from_wallet as { connect: { id: number } }).connect.id,
          to_wallet_id: (to_wallet as { connect: { id: number } }).connect.id,
          user_id: user ? (user as { connect: { id: number } }).connect.id : null,
          house_id: house ? (house as { connect: { id: number } }).connect.id : null,
        };
        db.walletTransfers.push(row);
        return row;
      }),
    },
    transfer: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row: Row = { ...data, id: nextId(), created_at: new Date('2026-10-20T18:00:00Z') };
        db.transfers.set(row.id, row);
        return row;
      }),
      update: vi.fn(
        async ({ where, data }: { where: { id: number }; data: Record<string, unknown> }) => {
          const row = db.transfers.get(where.id)!;
          applyData(row, data);
          return {
            ...row,
            user_expense: db.expenses.find((e) => e.id === row.user_expense_id) ?? null,
            house_income: db.incomes.find((i) => i.id === row.house_income_id) ?? null,
          };
        },
      ),
    },
    fortnight: {
      findUnique: vi.fn(async ({ where }: { where: { id: number } }) =>
        db.fortnights.get(where.id) ?? null,
      ),
    },
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id: number } }) =>
        db.users.get(where.id) ?? null,
      ),
    },
    house: {
      findUnique: vi.fn(async ({ where }: { where: { id: number } }) =>
        db.houses.get(where.id) ?? null,
      ),
    },
  };
  prismaMock.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(prismaMock));

  return { db, prismaMock, walletMock: wallet };
});

vi.mock('@/lib/prisma', () => ({ default: prismaMock }));

import { registerWalletTools } from '@/lib/mcp/tools/wallets';
import { registerTransferTools } from '@/lib/mcp/tools/transfers';
import { registerHouseTools } from '@/lib/mcp/tools/houses';
import {
  HOUSE,
  HOUSE_ID,
  USER_ID,
  authPrismaMocks,
  callTool,
} from '@/lib/mcp/behavior/harness';

const baseWallet = (overrides: Partial<Row> & { id: number }): Row => ({
  name: 'Billetera',
  type: 'CASH',
  amount: 0,
  credit_limit: null,
  temporary_credit_limit: null,
  temporary_credit_limit_as_of: null,
  provider_icon_key: null,
  active: true,
  include_in_liquidity: true,
  cutoff_day: null,
  due_day: null,
  minimum_payment: null,
  apr_annual: null,
  cat_annual: null,
  goal_amount: null,
  goal_due_date: null,
  assignee_user_id: null,
  user_id: null,
  house_id: HOUSE_ID,
  created_at: new Date('2026-01-01T18:00:00Z'),
  ...overrides,
});

const seed = (...rows: Row[]) => rows.forEach((row) => db.wallets.set(row.id, row));

beforeEach(() => {
  vi.clearAllMocks();
  db.wallets.clear();
  db.walletTransfers.length = 0;
  db.transfers.clear();
  db.expenses.length = 0;
  db.incomes.length = 0;
  db.fortnights.clear();
  db.users.clear();
  db.houses.clear();
  db.seq = 1000;
  db.membership = authPrismaMocks.membership;
  db.allowedContexts = authPrismaMocks.allowedContexts;
});

describe('create_wallet', () => {
  it('CASH escribe una billetera de la casa 42 con el saldo inicial', async () => {
    const { isError, body } = await callTool(registerWalletTools, 'create_wallet', {
      ...HOUSE,
      name: 'Efectivo casa',
      type: 'CASH',
      amount: 1500,
    });

    expect(isError).toBeFalsy();
    expect(db.wallets.size).toBe(1);
    const row = [...db.wallets.values()][0]!;
    expect(row).toMatchObject({
      name: 'Efectivo casa',
      type: 'CASH',
      amount: 1500,
      house_id: HOUSE_ID,
      user_id: null,
      include_in_liquidity: true,
      credit_limit: null,
      cutoff_day: null,
      due_day: null,
      goal_amount: null,
    });
    expect(body).toEqual({
      id: row.id,
      name: 'Efectivo casa',
      type: 'CASH',
      amount: 1500,
      active: true,
      include_in_liquidity: true,
    });
  });

  it('CREDIT_CARD escribe deuda inicial, línea de crédito, corte y pago', async () => {
    const { isError, body } = await callTool(registerWalletTools, 'create_wallet', {
      ...HOUSE,
      name: 'Nu',
      type: 'CREDIT_CARD',
      amount: 2000,
      credit_limit: 10000,
      cutoff_day: 5,
      due_day: 25,
    });

    expect(isError).toBeFalsy();
    const row = [...db.wallets.values()][0]!;
    expect(row).toMatchObject({
      type: 'CREDIT_CARD',
      amount: 2000,
      credit_limit: 10000,
      cutoff_day: 5,
      due_day: 25,
      house_id: HOUSE_ID,
      user_id: null,
      include_in_liquidity: true,
    });
    expect(body).toMatchObject({
      id: row.id,
      amount: 2000,
      credit_limit: 10000,
      available_credit: 8000,
      cutoff_day: 5,
      due_day: 25,
    });
  });

  it('rechaza credit_limit en una billetera CASH sin escribir', async () => {
    const { isError, body } = await callTool(registerWalletTools, 'create_wallet', {
      ...HOUSE,
      name: 'Efectivo',
      type: 'CASH',
      credit_limit: 5000,
    });

    expect(isError).toBe(true);
    expect(body.code).toBe('VALIDATION');
    expect(db.wallets.size).toBe(0);
  });
});

describe('update_wallet', () => {
  it('cambia solo los campos enviados de una billetera de efectivo', async () => {
    seed(baseWallet({ id: 7, name: 'Efectivo', amount: 300, include_in_liquidity: true }));

    const { isError, body } = await callTool(registerWalletTools, 'update_wallet', {
      ...HOUSE,
      wallet_id: 7,
      name: 'Caja chica',
    });

    expect(isError).toBeFalsy();
    const row = db.wallets.get(7)!;
    expect(row).toMatchObject({
      name: 'Caja chica',
      amount: 300,
      include_in_liquidity: true,
      active: true,
    });
    const updateData = walletMock.update.mock.calls[0]![0].data;
    expect(Object.keys(updateData)).toEqual(['name']);
    expect(body).toMatchObject({ id: 7, name: 'Caja chica', amount: 300 });
  });

  it('en tarjeta actualiza límite y corte sin tocar la deuda', async () => {
    seed(
      baseWallet({
        id: 8,
        name: 'Nu',
        type: 'CREDIT_CARD',
        amount: 1200,
        credit_limit: 10000,
        cutoff_day: 5,
        due_day: 25,
      }),
    );

    const { isError, body } = await callTool(registerWalletTools, 'update_wallet', {
      ...HOUSE,
      wallet_name: 'nu',
      credit_limit: 15000,
      cutoff_day: 10,
    });

    expect(isError).toBeFalsy();
    expect(db.wallets.get(8)).toMatchObject({
      name: 'Nu',
      amount: 1200,
      credit_limit: 15000,
      cutoff_day: 10,
      due_day: 25,
    });
    expect(body).toMatchObject({ amount: 1200, credit_limit: 15000, available_credit: 13800 });
  });

  it('no encuentra una billetera de otro contexto', async () => {
    seed(baseWallet({ id: 9, name: 'Personal', user_id: USER_ID, house_id: null }));

    const { isError, body } = await callTool(registerWalletTools, 'update_wallet', {
      ...HOUSE,
      wallet_id: 9,
      name: 'Hackeada',
    });

    expect(isError).toBe(true);
    expect(body.code).toBe('NOT_FOUND');
    expect(db.wallets.get(9)!.name).toBe('Personal');
  });
});

describe('adjust_balance', () => {
  it('sin confirm no escribe nada', async () => {
    seed(baseWallet({ id: 7, amount: 300 }));

    const { isError, body } = await callTool(registerWalletTools, 'adjust_balance', {
      ...HOUSE,
      wallet_id: 7,
      new_balance: 999,
    });

    expect(isError).toBe(true);
    expect(body.code).toBe('CONFIRM_REQUIRED');
    expect(db.wallets.get(7)!.amount).toBe(300);
    expect(walletMock.update).not.toHaveBeenCalled();
  });

  it('fija el saldo de una billetera de débito', async () => {
    seed(baseWallet({ id: 7, name: 'BBVA', type: 'DEBIT_CARD', amount: 300 }));

    const { isError, body } = await callTool(registerWalletTools, 'adjust_balance', {
      ...HOUSE,
      wallet_id: 7,
      new_balance: 4250.5,
      confirm: true,
    });

    expect(isError).toBeFalsy();
    expect(db.wallets.get(7)!.amount).toBe(4250.5);
    expect(body).toEqual({
      wallet_id: 7,
      wallet_name: 'BBVA',
      wallet_type: 'DEBIT_CARD',
      new_balance: 4250.5,
    });
  });

  it('en tarjeta fija la deuda y recalcula el crédito disponible', async () => {
    seed(
      baseWallet({
        id: 8,
        name: 'Nu',
        type: 'CREDIT_CARD',
        amount: 1200,
        credit_limit: 10000,
        cutoff_day: 5,
        due_day: 25,
      }),
    );

    const { isError, body } = await callTool(registerWalletTools, 'adjust_balance', {
      ...HOUSE,
      wallet_name: 'Nu',
      new_balance: 3000,
      confirm: true,
    });

    expect(isError).toBeFalsy();
    expect(db.wallets.get(8)).toMatchObject({ amount: 3000, credit_limit: 10000 });
    expect(body).toMatchObject({ wallet_id: 8, new_balance: 3000, available_credit: 7000 });
  });
});

describe('transfer', () => {
  it('mueve dinero: baja el origen, sube el destino y crea el walletTransfer', async () => {
    seed(
      baseWallet({ id: 1, name: 'Efectivo', amount: 1000 }),
      baseWallet({ id: 2, name: 'BBVA', type: 'DEBIT_CARD', amount: 50 }),
    );

    const { isError, body } = await callTool(registerTransferTools, 'transfer', {
      ...HOUSE,
      from_wallet_name: 'Efectivo',
      to_wallet_id: 2,
      amount: 400,
      transfer_date: '2026-10-15',
    });

    expect(isError).toBeFalsy();
    expect(db.wallets.get(1)!.amount).toBe(600);
    expect(db.wallets.get(2)!.amount).toBe(450);
    expect(db.walletTransfers).toHaveLength(1);
    expect(db.walletTransfers[0]).toMatchObject({
      amount: 400,
      fee_amount: 0,
      from_wallet_id: 1,
      to_wallet_id: 2,
      house_id: HOUSE_ID,
      user_id: null,
      note: null,
      exclude_from_report: true,
    });
    expect(body).toEqual({
      transfer_id: db.walletTransfers[0]!.id,
      amount: 400,
      from_wallet_id: 1,
      to_wallet_id: 2,
      from_balance: 600,
      to_balance: 450,
      transferred_at: '2026-10-15',
    });
  });

  it("a una meta guarda la nota 'Aporte a meta'", async () => {
    seed(
      baseWallet({ id: 1, name: 'Efectivo', amount: 1000 }),
      baseWallet({
        id: 3,
        name: 'Vacaciones',
        type: 'GOAL',
        amount: 0,
        include_in_liquidity: false,
        goal_amount: 20000,
        goal_due_date: new Date('2027-06-01T18:00:00Z'),
      }),
    );

    const { isError } = await callTool(registerTransferTools, 'transfer', {
      ...HOUSE,
      from_wallet_id: 1,
      to_wallet_id: 3,
      amount: 250,
    });

    expect(isError).toBeFalsy();
    expect(db.walletTransfers[0]!.note).toBe('Aporte a meta');
    expect(db.wallets.get(1)!.amount).toBe(750);
    expect(db.wallets.get(3)!.amount).toBe(250);
  });

  it('no deja retirar de una meta más de lo ahorrado y no escribe', async () => {
    seed(
      baseWallet({ id: 1, name: 'Efectivo', amount: 1000 }),
      baseWallet({ id: 3, name: 'Vacaciones', type: 'GOAL', amount: 100, goal_amount: 20000 }),
    );

    const { isError, body } = await callTool(registerTransferTools, 'transfer', {
      ...HOUSE,
      from_wallet_id: 3,
      to_wallet_id: 1,
      amount: 500,
    });

    expect(isError).toBe(true);
    expect(body.code).toBe('VALIDATION');
    expect(db.walletTransfers).toHaveLength(0);
    expect(db.wallets.get(3)!.amount).toBe(100);
    expect(db.wallets.get(1)!.amount).toBe(1000);
  });

  it('rechaza una tarjeta como destino sin mover saldos', async () => {
    seed(
      baseWallet({ id: 1, name: 'Efectivo', amount: 1000 }),
      baseWallet({ id: 8, name: 'Nu', type: 'CREDIT_CARD', amount: 0, credit_limit: 5000 }),
    );

    const { isError, body } = await callTool(registerTransferTools, 'transfer', {
      ...HOUSE,
      from_wallet_id: 1,
      to_wallet_id: 8,
      amount: 100,
    });

    expect(isError).toBe(true);
    expect(body.code).toBe('VALIDATION');
    expect(db.walletTransfers).toHaveLength(0);
    expect(db.wallets.get(1)!.amount).toBe(1000);
  });
});

describe('transfer_to_house', () => {
  const seedTransferWorld = () => {
    db.users.set(USER_ID, { id: USER_ID, active: true });
    db.houses.set(HOUSE_ID, { id: HOUSE_ID });
    db.fortnights.set(11, { id: 11, user_id: USER_ID, house_id: null });
    db.fortnights.set(21, { id: 21, user_id: null, house_id: HOUSE_ID });
    seed(
      baseWallet({ id: 5, name: 'Nómina', type: 'DEBIT_CARD', amount: 5000, user_id: USER_ID, house_id: null }),
      baseWallet({ id: 6, name: 'Cuenta casa', type: 'DEBIT_CARD', amount: 100 }),
    );
  };

  it('crea transferencia, gasto personal e ingreso de la casa y mueve ambos saldos', async () => {
    seedTransferWorld();

    const { isError, body } = await callTool(registerHouseTools, 'transfer_to_house', {
      ...HOUSE,
      house_id: HOUSE_ID,
      amount: 1200,
      user_wallet_name: 'Nómina',
      house_wallet_id: 6,
      user_fortnight_id: 11,
      house_fortnight_id: 21,
      note: 'Renta octubre',
    });

    expect(isError).toBeFalsy();
    expect(db.transfers.size).toBe(1);
    const transfer = [...db.transfers.values()][0]!;
    expect(transfer).toMatchObject({
      amount: 1200,
      type: 'USER_TO_HOUSE',
      user_id: USER_ID,
      house_id: HOUSE_ID,
      note: 'Renta octubre',
    });

    expect(db.expenses).toHaveLength(1);
    expect(db.expenses[0]).toMatchObject({
      description: 'Renta octubre',
      amount: '1200',
      is_paid: true,
      user_id: USER_ID,
      house_id: null,
      fortnight_id: 11,
      wallet_id: 5,
    });
    expect(db.incomes).toHaveLength(1);
    expect(db.incomes[0]).toMatchObject({
      amount: '1200',
      source: 'Renta octubre',
      user_id: null,
      house_id: HOUSE_ID,
      fortnight_id: 21,
      wallet_id: 6,
    });
    expect(transfer.user_expense_id).toBe(db.expenses[0]!.id);
    expect(transfer.house_income_id).toBe(db.incomes[0]!.id);

    expect(db.wallets.get(5)!.amount).toBe(3800);
    expect(db.wallets.get(6)!.amount).toBe(1300);

    expect(body).toMatchObject({
      transfer_id: transfer.id,
      amount: 1200,
      user_id: USER_ID,
      house_id: HOUSE_ID,
      user_expense_id: db.expenses[0]!.id,
      house_income_id: db.incomes[0]!.id,
      created_at: '2026-10-20',
    });
  });

  it('rechaza a quien no es miembro de la casa (FORBIDDEN) sin escribir', async () => {
    seedTransferWorld();
    // Personal context: the owner-context check skips membership, so the
    // service's own house-membership check is the one that answers.
    db.membership = null;

    const { isError, body } = await callTool(registerHouseTools, 'transfer_to_house', {
      owner_type: 'user',
      owner_id: USER_ID,
      house_id: HOUSE_ID,
      amount: 1200,
      user_wallet_id: 5,
      house_wallet_id: 6,
      user_fortnight_id: 11,
      house_fortnight_id: 21,
    });

    expect(isError).toBe(true);
    expect(body).toMatchObject({ code: 'FORBIDDEN', error: 'No eres miembro de esta casa' });
    expect(db.transfers.size).toBe(0);
    expect(db.expenses).toHaveLength(0);
    expect(db.incomes).toHaveLength(0);
    expect(db.wallets.get(5)!.amount).toBe(5000);
    expect(db.wallets.get(6)!.amount).toBe(100);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('rechaza una quincena de la casa que pertenece a otra casa sin escribir', async () => {
    seedTransferWorld();
    db.fortnights.set(31, { id: 31, user_id: null, house_id: 99 });

    const { isError, body } = await callTool(registerHouseTools, 'transfer_to_house', {
      ...HOUSE,
      house_id: HOUSE_ID,
      amount: 1200,
      user_fortnight_id: 11,
      house_fortnight_id: 31,
    });

    expect(isError).toBe(true);
    expect(body.code).toBe('VALIDATION');
    expect(db.transfers.size).toBe(0);
    expect(db.expenses).toHaveLength(0);
  });
});
