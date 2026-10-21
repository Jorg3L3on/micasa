import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Behavior tests for the card write tools: the real tool code and the real
 * finance services run against an in-memory Prisma double, and the tests
 * assert what ends up stored (payments, card debt, wallet balance, plan rows).
 */

type Row = Record<string, unknown>;
type Where = Record<string, unknown>;

const db = vi.hoisted(() => {
  const tables: Record<string, Row[]> = {};
  const nextIds: Record<string, number> = {};

  const table = (name: string): Row[] => (tables[name] ??= []);
  const insert = (name: string, data: Row): Row => {
    nextIds[name] = (nextIds[name] ?? 100) + 1;
    const row = { id: nextIds[name], ...data };
    table(name).push(row);
    return row;
  };

  const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    value != null && typeof value === 'object' && !(value instanceof Date) && !Array.isArray(value);

  const toComparable = (value: unknown): unknown =>
    value instanceof Date ? value.getTime() : value;

  /** Supports equality, `in`, `gte`/`lte`, `equals` + `mode: insensitive`. */
  const matches = (row: Row, where: Where | undefined): boolean => {
    if (!where) return true;
    return Object.entries(where).every(([key, cond]) => {
      const value = row[key];
      if (!isPlainObject(cond)) return toComparable(value) === toComparable(cond);
      if ('in' in cond) return (cond.in as unknown[]).includes(value);
      if ('equals' in cond) {
        return cond.mode === 'insensitive'
          ? String(value).toLowerCase() === String(cond.equals).toLowerCase()
          : value === cond.equals;
      }
      if ('gte' in cond || 'lte' in cond) {
        const v = toComparable(value) as number;
        if (cond.gte != null && v < (toComparable(cond.gte) as number)) return false;
        if (cond.lte != null && v > (toComparable(cond.lte) as number)) return false;
        return true;
      }
      throw new Error(`Unsupported where on ${key}: ${JSON.stringify(cond)}`);
    });
  };

  const applyData = (row: Row, data: Row) => {
    for (const [key, value] of Object.entries(data)) {
      if (isPlainObject(value) && 'increment' in value) {
        row[key] = Number(row[key]) + Number(value.increment);
      } else if (isPlainObject(value) && 'decrement' in value) {
        row[key] = Number(row[key]) - Number(value.decrement);
      } else {
        row[key] = value;
      }
    }
  };

  const bySequence = (a: Row, b: Row) => Number(a.sequence) - Number(b.sequence);
  const planPayments = (planId: unknown) =>
    table('installmentPayment').filter((p) => p.plan_id === planId).sort(bySequence);
  const withPayments = (plan: Row) => ({ ...plan, payments: planPayments(plan.id) });

  /** Splits `payments: { create: [...] }` off a plan write and inserts the rows. */
  const writePlan = (data: Row, existing?: Row): Row => {
    const { payments, ...fields } = data as Row & { payments?: { create: Row[] } };
    const plan = existing ?? insert('installmentPlan', {});
    applyData(plan, fields);
    for (const payment of payments?.create ?? []) {
      insert('installmentPayment', { plan_id: plan.id, paid_at: null, credit_card_payment_id: null, ...payment });
    }
    return withPayments(plan);
  };

  const wallet = {
    findFirst: vi.fn(async ({ where }: { where: Where }) => {
      const row = table('wallet').find((w) => matches(w, where));
      return row ? { ...row } : null;
    }),
    findMany: vi.fn(async ({ where }: { where: Where }) =>
      table('wallet').filter((w) => matches(w, where)).map((w) => ({ ...w })),
    ),
    update: vi.fn(async ({ where, data }: { where: { id: number }; data: Row }) => {
      const row = table('wallet').find((w) => w.id === where.id);
      if (!row) throw new Error(`wallet ${where.id} not found`);
      applyData(row, data);
      return { ...row };
    }),
  };

  const client = {
    houseMember: { findFirst: vi.fn() },
    agentConnectionAllowedContext: { findMany: vi.fn() },
    wallet,
    category: {
      findFirst: vi.fn(async ({ where }: { where: Where }) =>
        table('category').find((c) => matches(c, where)) ?? null,
      ),
      findMany: vi.fn(async () => []),
    },
    fortnight: {
      findFirst: vi.fn(async ({ where }: { where: Where }) =>
        table('fortnight').find((f) => matches(f, where)) ?? null,
      ),
    },
    expense: {
      create: vi.fn(async ({ data }: { data: Row }) => insert('expense', data)),
    },
    creditCardPayment: {
      create: vi.fn(async ({ data }: { data: Row }) => {
        const row = insert('cardPayment', { expense_id: null, ...data });
        const find = (id: unknown) => table('wallet').find((w) => w.id === id) ?? null;
        return {
          ...row,
          source_wallet: find(row.source_wallet_id),
          credit_card_wallet: find(row.credit_card_wallet_id),
        };
      }),
      update: vi.fn(async ({ where, data }: { where: { id: number }; data: Row }) => {
        const row = table('cardPayment').find((p) => p.id === where.id)!;
        applyData(row, data);
        return row;
      }),
    },
    creditCardScheduledPayment: {
      create: vi.fn(async ({ data }: { data: Row }) =>
        insert('scheduledPayment', { status: 'SCHEDULED', paid_at: null, ...data }),
      ),
      findMany: vi.fn(async ({ where }: { where: Where }) =>
        table('scheduledPayment').filter((r) => matches(r, where)),
      ),
      findUnique: vi.fn(async ({ where }: { where: { id: number } }) =>
        table('scheduledPayment').find((r) => r.id === where.id) ?? null,
      ),
      update: vi.fn(async ({ where, data }: { where: { id: number }; data: Row }) => {
        const row = table('scheduledPayment').find((r) => r.id === where.id)!;
        applyData(row, data);
        return row;
      }),
    },
    creditCardInstallmentPlan: {
      create: vi.fn(async ({ data }: { data: Row }) => writePlan(data)),
      findFirst: vi.fn(async ({ where }: { where: Where }) => {
        const plan = table('installmentPlan').find((p) => matches(p, where));
        return plan ? withPayments(plan) : null;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: number }; data: Row }) => {
        const plan = table('installmentPlan').find((p) => p.id === where.id)!;
        return writePlan(data, plan);
      }),
    },
    creditCardInstallmentPlanPayment: {
      deleteMany: vi.fn(async ({ where }: { where: Where }) => {
        const keep = table('installmentPayment').filter((p) => !matches(p, where));
        const count = table('installmentPayment').length - keep.length;
        tables.installmentPayment = keep;
        return { count };
      }),
      findMany: vi.fn(async ({ where }: { where: Where & { plan?: Where } }) => {
        const { plan: planWhere, ...own } = where;
        return table('installmentPayment').filter((p) => {
          if (!matches(p, own)) return false;
          const plan = table('installmentPlan').find((pl) => pl.id === p.plan_id);
          return plan != null && matches(plan, planWhere);
        });
      }),
    },
    creditCardPaymentPlan: {
      upsert: vi.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: { credit_card_wallet_id_fortnight_id: Where };
          create: Row;
          update: Row;
        }) => {
          const existing = table('paymentPlan').find((p) =>
            matches(p, where.credit_card_wallet_id_fortnight_id),
          );
          if (existing) {
            applyData(existing, update);
            return existing;
          }
          return insert('paymentPlan', create);
        },
      ),
    },
    $transaction: vi.fn(async (arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (tx: unknown) => Promise<unknown>)(client)
        : Promise.all(arg as Promise<unknown>[]),
    ),
  };

  const reset = () => {
    for (const key of Object.keys(tables)) delete tables[key];
    for (const key of Object.keys(nextIds)) delete nextIds[key];
  };

  return { client, table, insert, reset };
});

vi.mock('@/lib/prisma', () => ({ default: db.client }));

import { registerCreditCardTools } from '@/lib/mcp/tools/credit-cards';
import { authPrismaMocks, callTool, HOUSE, HOUSE_ID } from '@/lib/mcp/behavior/harness';

const CARD_ID = 7;
const CASH_ID = 4;

const call = (name: string, args: Record<string, unknown>) =>
  callTool(registerCreditCardTools, name, { ...HOUSE, ...args });

const wallet = (id: number) => db.table('wallet').find((w) => w.id === id)!;
const ymd = (value: unknown) => (value as Date).toISOString().slice(0, 10);

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
  db.client.houseMember.findFirst.mockResolvedValue(authPrismaMocks.membership);
  db.client.agentConnectionAllowedContext.findMany.mockResolvedValue(
    authPrismaMocks.allowedContexts,
  );

  db.table('wallet').push(
    {
      id: CARD_ID,
      name: 'Visa Oro',
      type: 'CREDIT_CARD',
      amount: 5000,
      credit_limit: 20000,
      cutoff_day: 20,
      due_day: 5,
      active: true,
      provider_icon_key: null,
      user_id: null,
      house_id: HOUSE_ID,
    },
    {
      id: CASH_ID,
      name: 'Efectivo',
      type: 'CASH',
      amount: 3000,
      credit_limit: null,
      cutoff_day: null,
      due_day: null,
      active: true,
      provider_icon_key: null,
      user_id: null,
      house_id: HOUSE_ID,
    },
  );
  db.table('fortnight').push({
    id: 31,
    year: 2026,
    month: 10,
    period: 'FIRST',
    user_id: null,
    house_id: HOUSE_ID,
  });
  db.table('category').push({
    id: 12,
    name: 'Pago tarjeta',
    kind: 'EXPENSE',
    active: true,
    user_id: null,
    house_id: HOUSE_ID,
  });
});

describe('add_card_payment', () => {
  it('mode external lowers the card debt, records the payment and leaves wallets alone', async () => {
    const { isError, body } = await call('add_card_payment', {
      card_id: CARD_ID,
      mode: 'external',
      amount: 1200,
      paid_at: '2026-10-10',
      note: 'Pago app banco',
    });

    expect(isError).toBeFalsy();
    expect(body).toMatchObject({
      mode: 'external',
      amount: 1200,
      paid_at: '2026-10-10',
      adjusts_debt: true,
    });

    expect(wallet(CARD_ID).amount).toBe(3800);
    expect(wallet(CASH_ID).amount).toBe(3000);
    const payments = db.table('cardPayment');
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({
      id: body.payment_id,
      amount: 1200,
      credit_card_wallet_id: CARD_ID,
      source_wallet_id: null,
      adjusts_debt: true,
      note: 'Pago app banco',
      user_id: null,
      house_id: HOUSE_ID,
      expense_id: null,
    });
    expect(ymd(payments[0]!.paid_at)).toBe('2026-10-10');
    expect(db.table('expense')).toHaveLength(0);
  });

  it('mode external with adjusts_debt false records the payment without touching the debt', async () => {
    const { isError, body } = await call('add_card_payment', {
      card_id: CARD_ID,
      amount: 9000,
      paid_at: '2026-10-10',
      adjusts_debt: false,
    });

    expect(isError).toBeFalsy();
    expect(body).toMatchObject({ mode: 'external', adjusts_debt: false });
    expect(wallet(CARD_ID).amount).toBe(5000);
    expect(db.table('cardPayment')[0]).toMatchObject({ amount: 9000, adjusts_debt: false });
  });

  it('mode external above the debt is rejected and writes nothing', async () => {
    const { isError, body } = await call('add_card_payment', {
      card_id: CARD_ID,
      amount: 5000.01,
      paid_at: '2026-10-10',
    });

    expect(isError).toBe(true);
    expect(body.code).toBe('VALIDATION');
    expect(wallet(CARD_ID).amount).toBe(5000);
    expect(db.table('cardPayment')).toHaveLength(0);
  });

  it('mode wallet moves money from the wallet to the card, books the fortnight expense and covers the scheduled cuota', async () => {
    db.insert('scheduledPayment', {
      credit_card_wallet_id: CARD_ID,
      due_date: new Date('2026-10-12T12:00:00.000Z'),
      amount: 1500,
      label: 'Cuota octubre',
      status: 'SCHEDULED',
      paid_at: null,
      user_id: null,
      house_id: HOUSE_ID,
    });

    const { isError, body } = await call('add_card_payment', {
      card_id: CARD_ID,
      mode: 'wallet',
      amount: 1500,
      paid_at: '2026-10-10',
      source_wallet_name: 'efectivo',
      create_fortnight_expense: true,
      fortnight_id: 31,
      category_id: 12,
      expense_description: 'Pago Visa octubre',
    });

    expect(isError).toBeFalsy();
    expect(body).toMatchObject({
      mode: 'wallet',
      amount: 1500,
      source_wallet_id: CASH_ID,
      source_wallet_name: 'Efectivo',
    });

    expect(wallet(CASH_ID).amount).toBe(1500);
    expect(wallet(CARD_ID).amount).toBe(3500);

    const expenses = db.table('expense');
    expect(expenses).toHaveLength(1);
    expect(expenses[0]).toMatchObject({
      fortnight_id: 31,
      wallet_id: CASH_ID,
      category_id: 12,
      description: 'Pago Visa octubre',
      amount: 1500,
      is_paid: true,
      user_id: null,
      house_id: HOUSE_ID,
    });
    expect(body.expense_id).toBe(expenses[0]!.id);

    const [payment] = db.table('cardPayment');
    expect(payment).toMatchObject({
      id: body.payment_id,
      source_wallet_id: CASH_ID,
      credit_card_wallet_id: CARD_ID,
      adjusts_debt: true,
      expense_id: expenses[0]!.id,
    });

    expect(db.table('scheduledPayment')[0]).toMatchObject({
      status: 'PAID',
      credit_card_payment_id: body.payment_id,
    });
  });

  it('mode wallet without enough balance is rejected and writes nothing', async () => {
    const { isError, body } = await call('add_card_payment', {
      card_id: CARD_ID,
      mode: 'wallet',
      amount: 3500,
      paid_at: '2026-10-10',
      source_wallet_id: CASH_ID,
    });

    expect(isError).toBe(true);
    expect(body.code).toBe('VALIDATION');
    expect(wallet(CASH_ID).amount).toBe(3000);
    expect(wallet(CARD_ID).amount).toBe(5000);
    expect(db.table('cardPayment')).toHaveLength(0);
  });
});

describe('upsert_installment_plan', () => {
  it('without plan_id creates the plan with its cuotas and raises the debt by the unpaid ones', async () => {
    const { isError, body } = await call('upsert_installment_plan', {
      card_id: CARD_ID,
      name: 'Laptop 6 MSI',
      installment_amount: 1000,
      total_installments: 6,
      paid_installments: 2,
      next_due_date: '2026-11-05',
    });

    expect(isError).toBeFalsy();
    expect(body).toMatchObject({
      credit_card_wallet_id: CARD_ID,
      name: 'Laptop 6 MSI',
      total_installments: 6,
      paid_installments: 2,
      remaining_installments: 4,
      remaining_balance: 4000,
      status: 'ACTIVE',
      next_due_date: '2026-11-05',
    });

    expect(wallet(CARD_ID).amount).toBe(9000);
    const [plan] = db.table('installmentPlan');
    expect(plan).toMatchObject({
      credit_card_wallet_id: CARD_ID,
      installment_amount: 1000,
      already_in_card_balance: false,
      user_id: null,
      house_id: HOUSE_ID,
    });
    const payments = db.table('installmentPayment');
    expect(payments.map((p) => [p.sequence, p.status, ymd(p.due_date), p.amount])).toEqual([
      [1, 'PAID', '2026-09-05', 1000],
      [2, 'PAID', '2026-10-05', 1000],
      [3, 'SCHEDULED', '2026-11-05', 1000],
      [4, 'SCHEDULED', '2026-12-05', 1000],
      [5, 'SCHEDULED', '2027-01-05', 1000],
      [6, 'SCHEDULED', '2027-02-05', 1000],
    ]);
  });

  it('already_in_balance creates the plan without changing the debt', async () => {
    const { isError } = await call('upsert_installment_plan', {
      card_id: CARD_ID,
      name: 'Tele 3 MSI',
      installment_amount: 500,
      total_installments: 3,
      next_due_date: '2026-11-05',
      already_in_balance: true,
    });

    expect(isError).toBeFalsy();
    expect(wallet(CARD_ID).amount).toBe(5000);
    expect(db.table('installmentPlan')[0]).toMatchObject({ already_in_card_balance: true });
    expect(db.table('installmentPayment')).toHaveLength(3);
  });

  it('with plan_id regenerates the cuotas and adjusts the debt by the difference', async () => {
    const created = await call('upsert_installment_plan', {
      card_id: CARD_ID,
      name: 'Laptop 6 MSI',
      installment_amount: 1000,
      total_installments: 6,
      paid_installments: 2,
      next_due_date: '2026-11-05',
    });
    expect(wallet(CARD_ID).amount).toBe(9000);

    const { isError, body } = await call('upsert_installment_plan', {
      card_id: CARD_ID,
      plan_id: created.body.id,
      name: 'Laptop 6 MSI (ajustado)',
      installment_amount: 1000,
      total_installments: 6,
      paid_installments: 3,
      next_due_date: '2026-12-05',
    });

    expect(isError).toBeFalsy();
    expect(body).toMatchObject({
      id: created.body.id,
      name: 'Laptop 6 MSI (ajustado)',
      paid_installments: 3,
      remaining_installments: 3,
      remaining_balance: 3000,
    });

    // One cuota fewer outstanding: the debt drops by 1000.
    expect(wallet(CARD_ID).amount).toBe(8000);
    expect(db.table('installmentPlan')).toHaveLength(1);
    expect(db.table('installmentPlan')[0]).toMatchObject({
      name: 'Laptop 6 MSI (ajustado)',
      paid_installments: 3,
    });
    const payments = db.table('installmentPayment');
    expect(payments).toHaveLength(6);
    expect(payments.filter((p) => p.status === 'PAID')).toHaveLength(3);
    expect(
      payments.filter((p) => p.status === 'SCHEDULED').map((p) => ymd(p.due_date)),
    ).toEqual(['2026-12-05', '2027-01-05', '2027-02-05']);
  });

  it('with plan_id but no paid_installments returns VALIDATION and writes nothing', async () => {
    const created = await call('upsert_installment_plan', {
      card_id: CARD_ID,
      name: 'Laptop 6 MSI',
      installment_amount: 1000,
      total_installments: 6,
      next_due_date: '2026-11-05',
    });
    expect(wallet(CARD_ID).amount).toBe(11000);
    const paymentsBefore = db.table('installmentPayment').map((p) => ({ ...p }));
    vi.clearAllMocks();
    db.client.houseMember.findFirst.mockResolvedValue(authPrismaMocks.membership);
    db.client.agentConnectionAllowedContext.findMany.mockResolvedValue(
      authPrismaMocks.allowedContexts,
    );

    const { isError, body } = await call('upsert_installment_plan', {
      card_id: CARD_ID,
      plan_id: created.body.id,
      name: 'Laptop renombrada',
      installment_amount: 2000,
      total_installments: 6,
    });

    expect(isError).toBe(true);
    expect(body).toMatchObject({
      code: 'VALIDATION',
      error: 'paid_installments es obligatorio al actualizar un plan',
    });
    expect(wallet(CARD_ID).amount).toBe(11000);
    expect(db.table('installmentPlan')[0]).toMatchObject({ name: 'Laptop 6 MSI' });
    expect(db.table('installmentPayment')).toEqual(paymentsBefore);
    expect(db.client.creditCardInstallmentPlan.update).not.toHaveBeenCalled();
    expect(db.client.creditCardInstallmentPlanPayment.deleteMany).not.toHaveBeenCalled();
    expect(db.client.wallet.update).not.toHaveBeenCalled();
  });
});

describe('create_scheduled_payment', () => {
  it('stores a SCHEDULED cuota on the card for the house, without moving the debt', async () => {
    const { isError, body } = await call('create_scheduled_payment', {
      card_id: CARD_ID,
      due_date: '2026-11-05',
      amount: 750.5,
      label: 'Cuota seguro',
    });

    expect(isError).toBeFalsy();
    expect(body).toMatchObject({
      credit_card_wallet_id: CARD_ID,
      due_date: '2026-11-05',
      amount: 750.5,
      label: 'Cuota seguro',
      status: 'SCHEDULED',
      paid_at: null,
    });

    const rows = db.table('scheduledPayment');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: body.id,
      credit_card_wallet_id: CARD_ID,
      amount: 750.5,
      label: 'Cuota seguro',
      status: 'SCHEDULED',
      user_id: null,
      house_id: HOUSE_ID,
    });
    expect(ymd(rows[0]!.due_date)).toBe('2026-11-05');
    expect(wallet(CARD_ID).amount).toBe(5000);
  });

  it('on a non-credit wallet returns NOT_FOUND and stores nothing', async () => {
    const { isError, body } = await call('create_scheduled_payment', {
      card_id: CASH_ID,
      due_date: '2026-11-05',
      amount: 100,
    });

    expect(isError).toBe(true);
    expect(body.code).toBe('NOT_FOUND');
    expect(db.table('scheduledPayment')).toHaveLength(0);
  });
});

describe('upsert_card_payment_plan', () => {
  it('creates the plan row for the fortnight and overwrites it on a second call', async () => {
    const first = await call('upsert_card_payment_plan', {
      card_id: CARD_ID,
      fortnight_id: 31,
      planned_amount: 2000,
      scope: 'n_cycles',
      cycle_count: 3,
    });

    expect(first.isError).toBeFalsy();
    expect(first.body).toEqual({
      card_id: CARD_ID,
      fortnight_id: 31,
      planned_amount: 2000,
      scope: 'n_cycles',
      cycle_count: 3,
      valid_until: null,
    });

    const rows = db.table('paymentPlan');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      credit_card_wallet_id: CARD_ID,
      fortnight_id: 31,
      planned_amount: 2000,
      declared_zero: false,
      scope: 'N_CYCLES',
      cycle_count: 3,
      valid_until: null,
      user_id: null,
      house_id: HOUSE_ID,
    });
    expect(rows[0]!.anchor_statement_end).toBeInstanceOf(Date);

    const second = await call('upsert_card_payment_plan', {
      card_id: CARD_ID,
      fortnight_id: 31,
      planned_amount: 1500,
    });

    expect(second.isError).toBeFalsy();
    expect(second.body).toMatchObject({ planned_amount: 1500, scope: 'this_cycle' });
    expect(db.table('paymentPlan')).toHaveLength(1);
    expect(db.table('paymentPlan')[0]).toMatchObject({
      planned_amount: 1500,
      scope: 'THIS_CYCLE',
      cycle_count: null,
    });
    // Planning a payment does not move money.
    expect(wallet(CARD_ID).amount).toBe(5000);
  });

  it('above the card debt is rejected and stores nothing', async () => {
    const { isError, body } = await call('upsert_card_payment_plan', {
      card_id: CARD_ID,
      fortnight_id: 31,
      planned_amount: 6000,
    });

    expect(isError).toBe(true);
    expect(body.code).toBe('VALIDATION');
    expect(db.table('paymentPlan')).toHaveLength(0);
  });
});
