import { beforeEach, describe, expect, it, vi } from 'vitest';
import { statementChargeDedupeWhere } from '@/lib/finance/card-bank-charge';

/**
 * In-memory stand-in for the payment transaction. Wallet deltas are real
 * (`applyWalletAmountDelta`), so the card balance is the thing under test.
 */
type Row = Record<string, unknown>;
type Where = Record<string, unknown>;

const db = vi.hoisted(() => {
  const tables: Record<string, Row[]> = {};
  const nextIds: Record<string, number> = {};
  const cardAmounts: number[] = [];

  const table = (name: string): Row[] => (tables[name] ??= []);
  const insert = (name: string, data: Row): Row => {
    nextIds[name] = (nextIds[name] ?? 100) + 1;
    const row = { id: nextIds[name], ...data };
    table(name).push(row);
    return row;
  };

  const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    value != null &&
    typeof value === 'object' &&
    !(value instanceof Date) &&
    !Array.isArray(value);

  const toComparable = (value: unknown): unknown =>
    value instanceof Date ? value.getTime() : value;

  const matches = (row: Row, where: Where | undefined): boolean => {
    if (!where) return true;
    return Object.entries(where).every(([key, cond]) => {
      const value = row[key];
      if (!isPlainObject(cond)) return toComparable(value) === toComparable(cond);
      if ('equals' in cond) {
        return cond.mode === 'insensitive'
          ? String(value).toLowerCase() === String(cond.equals).toLowerCase()
          : value === cond.equals;
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

  const presentPayment = (row: Row) => {
    const charge = table('expense').find((expense) => expense.id === row.bank_charge_expense_id);
    const walletOf = (id: unknown) => table('wallet').find((wallet) => wallet.id === id) ?? null;
    return {
      ...row,
      bank_charge_expense: charge ? { id: charge.id, amount: charge.amount } : null,
      source_wallet: walletOf(row.source_wallet_id),
      credit_card_wallet: walletOf(row.credit_card_wallet_id),
    };
  };

  const client = {
    wallet: {
      findFirst: vi.fn(async ({ where }: { where: Where }) => {
        const row = table('wallet').find((wallet) => matches(wallet, where));
        return row ? { ...row } : null;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: number }; data: Row }) => {
        const row = table('wallet').find((wallet) => wallet.id === where.id);
        if (!row) throw new Error(`wallet ${where.id} not found`);
        applyData(row, data);
        if (row.type === 'CREDIT_CARD' || row.type === 'DEPARTMENT_STORE_CARD') {
          cardAmounts.push(Number(row.amount));
        }
        return { ...row };
      }),
    },
    category: {
      findFirst: vi.fn(async ({ where }: { where: Where }) =>
        table('category').find((category) => matches(category, where)) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: Row }) => insert('category', data)),
    },
    fortnight: {
      findFirst: vi.fn(async ({ where }: { where: Where }) =>
        table('fortnight').find((fortnight) => matches(fortnight, where)) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: Row }) => insert('fortnight', data)),
      update: vi.fn(async ({ where, data }: { where: { id: number }; data: Row }) => {
        const row = table('fortnight').find((fortnight) => fortnight.id === where.id);
        if (!row) throw new Error(`fortnight ${where.id} not found`);
        applyData(row, data);
        return { ...row };
      }),
    },
    expense: {
      create: vi.fn(async ({ data }: { data: Row }) => insert('expense', data)),
      delete: vi.fn(async ({ where }: { where: { id: number } }) => {
        const keep = table('expense').filter((expense) => expense.id !== where.id);
        tables.expense = keep;
        return { id: where.id };
      }),
    },
    creditCardPayment: {
      create: vi.fn(async ({ data }: { data: Row }) => {
        const row = insert('cardPayment', { expense_id: null, bank_charge_expense_id: null, ...data });
        return presentPayment(row);
      }),
      findFirst: vi.fn(async ({ where }: { where: Where }) => {
        const row = table('cardPayment').find((payment) => matches(payment, where));
        return row ? presentPayment(row) : null;
      }),
      update: vi.fn(async () => {
        throw new Error('payment update is unused');
      }),
      delete: vi.fn(async ({ where }: { where: { id: number } }) => {
        tables.cardPayment = table('cardPayment').filter((payment) => payment.id !== where.id);
        return { id: where.id };
      }),
    },
    creditCardScheduledPayment: {
      findMany: vi.fn(async () => []),
    },
    creditCardInstallmentPlanPayment: {
      findMany: vi.fn(async () => []),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(client)),
  };

  const reset = () => {
    for (const key of Object.keys(tables)) delete tables[key];
    for (const key of Object.keys(nextIds)) delete nextIds[key];
    cardAmounts.length = 0;
  };

  return { client, table, insert, reset, cardAmounts };
});

vi.mock('@/lib/prisma', () => ({ default: db.client }));

import {
  createCreditCardPayment,
  reverseCreditCardPayment,
} from '@/lib/finance/credit-card.service';

const userOwner = { user_id: 1, house_id: null } as const;
const houseOwner = { user_id: null, house_id: 9 } as const;

const CARD_ID = 7;
const CASH_ID = 4;
const HOUSE_CARD_ID = 8;

const seedWallets = () => {
  db.insert('wallet', {
    id: CARD_ID,
    name: 'Tarjeta prueba',
    type: 'CREDIT_CARD',
    amount: 150,
    user_id: 1,
    house_id: null,
    provider_icon_key: null,
  });
  db.insert('wallet', {
    id: CASH_ID,
    name: 'Efectivo',
    type: 'CASH',
    amount: 500,
    user_id: 1,
    house_id: null,
    provider_icon_key: null,
  });
};

const wallet = (id: number) => db.table('wallet').find((row) => row.id === id)!;

const payWithCharge = (
  cardId: number,
  owner: typeof userOwner | typeof houseOwner,
  amount: number,
  reason: 'INTEREST' | 'LATE_FEE' | 'OTHER',
  sourceWalletId?: number,
) =>
  createCreditCardPayment(cardId, owner, sourceWalletId == null
    ? {
        mode: 'external',
        amount,
        paid_at: '2026-10-05',
        note: null,
        adjusts_debt: true,
        bank_charge: { reason },
      }
    : {
        mode: 'wallet',
        amount,
        paid_at: '2026-10-05',
        note: null,
        source_wallet_id: sourceWalletId,
        bank_charge: { reason },
      });

describe('declared bank charge on a card payment', () => {
  beforeEach(() => {
    db.reset();
    seedWallets();
  });

  it('pays debt 150.00 plus a declared charge and leaves the card at 0', async () => {
    const payment = await payWithCharge(CARD_ID, userOwner, 200, 'INTEREST', CASH_ID);

    expect(wallet(CARD_ID).amount).toBe(0);
    expect(wallet(CASH_ID).amount).toBe(300);
    expect(db.cardAmounts.every((amount) => amount >= 0)).toBe(true);

    const [charge] = db.table('expense');
    expect(charge).toMatchObject({
      wallet_id: CARD_ID,
      amount: 50,
      description: 'Intereses',
      is_paid: true,
      user_id: 1,
      house_id: null,
    });
    expect(payment.bank_charge_expense_id).toBe(charge!.id);
    expect(db.table('cardPayment')[0]).toMatchObject({
      amount: 200,
      bank_charge_expense_id: charge!.id,
      source_wallet_id: CASH_ID,
    });
    expect(db.table('category')).toMatchObject([
      { name: 'Intereses y comisiones', kind: 'EXPENSE', user_id: 1, house_id: null },
    ]);
  });

  it('deletes the payment, removes the charge, and restores the prior balance', async () => {
    const payment = await payWithCharge(CARD_ID, userOwner, 200, 'LATE_FEE', CASH_ID);
    db.cardAmounts.length = 0;

    const reversed = await reverseCreditCardPayment(CARD_ID, payment.id, userOwner);

    expect(reversed).toMatchObject({
      id: payment.id,
      amount: 200,
      bank_charge_expense_id: payment.bank_charge_expense_id,
    });
    expect(wallet(CARD_ID).amount).toBe(150);
    expect(wallet(CASH_ID).amount).toBe(500);
    expect(db.table('expense')).toHaveLength(0);
    expect(db.table('cardPayment')).toHaveLength(0);
    expect(db.cardAmounts.every((amount) => amount >= 0)).toBe(true);
    expect(db.table('category')).toHaveLength(1);
  });

  it('does not book a charge when the payment equals the recorded debt', async () => {
    const payment = await payWithCharge(CARD_ID, userOwner, 150, 'INTEREST', CASH_ID);

    expect(wallet(CARD_ID).amount).toBe(0);
    expect(wallet(CASH_ID).amount).toBe(350);
    expect(payment.bank_charge_expense_id).toBeNull();
    expect(db.table('expense')).toHaveLength(0);
    expect(db.table('category')).toHaveLength(0);
    expect(db.cardAmounts.every((amount) => amount >= 0)).toBe(true);
  });

  it('blocks a payment above the debt when bank_charge is missing', async () => {
    await expect(
      createCreditCardPayment(CARD_ID, userOwner, {
        mode: 'wallet',
        amount: 200,
        paid_at: '2026-10-05',
        note: null,
        source_wallet_id: CASH_ID,
      }),
    ).rejects.toMatchObject({
      code: 'BANK_CHARGE_REQUIRED',
    });

    expect(wallet(CARD_ID).amount).toBe(150);
    expect(wallet(CASH_ID).amount).toBe(500);
    expect(db.table('expense')).toHaveLength(0);
    expect(db.table('cardPayment')).toHaveLength(0);
    expect(db.table('category')).toHaveLength(0);
  });

  it('reuses Intereses y comisiones for the same owner and not for another', async () => {
    db.insert('category', {
      name: 'intereses y comisiones',
      kind: 'EXPENSE',
      user_id: 1,
      house_id: null,
      icon: 'LANDMARK',
    });

    await payWithCharge(CARD_ID, userOwner, 200, 'OTHER', CASH_ID);

    const userCategories = db
      .table('category')
      .filter((row) => row.user_id === 1 && row.house_id == null);
    expect(userCategories).toHaveLength(1);
    expect(db.table('expense')[0]).toMatchObject({
      category_id: userCategories[0]!.id,
      description: 'Cargo bancario',
      amount: 50,
    });

    db.insert('wallet', {
      id: HOUSE_CARD_ID,
      name: 'Tarjeta casa',
      type: 'CREDIT_CARD',
      amount: 150,
      user_id: null,
      house_id: 9,
      provider_icon_key: null,
    });

    await payWithCharge(HOUSE_CARD_ID, houseOwner, 200, 'INTEREST');

    const named = db
      .table('category')
      .filter((row) => String(row.name).toLocaleLowerCase('es-MX') === 'intereses y comisiones');
    expect(named).toHaveLength(2);
    expect(named.map((row) => row.house_id)).toEqual(expect.arrayContaining([null, 9]));
    expect(wallet(HOUSE_CARD_ID).amount).toBe(0);
  });
});

describe('statement import dedupe', () => {
  const start = new Date('2026-10-05T00:00:00.000Z');
  const end = new Date('2026-10-05T23:59:59.999Z');

  const where = statementChargeDedupeWhere({
    walletId: 7,
    amount: 50,
    description: 'Intereses',
    start,
    end,
    excludeStatementImportId: 3,
  });

  const isDuplicateCandidate = (row: {
    wallet_id: number;
    amount: number;
    description: string;
    statement_import_id: number | null;
    bankCharge: boolean;
  }) => {
    if (row.wallet_id !== where.wallet_id) return false;
    if (row.amount !== where.amount) return false;
    if (row.description !== where.description) return false;
    if (where.bank_charge_payment != null && 'is' in where.bank_charge_payment) {
      if (where.bank_charge_payment.is === null && row.bankCharge) return false;
    }
    const excluded =
      where.NOT != null &&
      typeof where.NOT === 'object' &&
      'statement_import_id' in where.NOT
        ? where.NOT.statement_import_id
        : undefined;
    if (excluded != null && row.statement_import_id === excluded) return false;
    return true;
  };

  it('ignores a bank_charge expense and still matches a real statement line', () => {
    expect(where.bank_charge_payment).toEqual({ is: null });

    const bankCharge = {
      wallet_id: 7,
      amount: 50,
      description: 'Intereses',
      statement_import_id: null,
      bankCharge: true,
    };
    const statementLine = {
      wallet_id: 7,
      amount: 50,
      description: 'Intereses',
      statement_import_id: null,
      bankCharge: false,
    };
    const sameFile = { ...statementLine, statement_import_id: 3 };

    expect(isDuplicateCandidate(bankCharge)).toBe(false);
    expect(isDuplicateCandidate(statementLine)).toBe(true);
    expect(isDuplicateCandidate(sameFile)).toBe(false);
  });
});
