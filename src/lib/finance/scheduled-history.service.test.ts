import { describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;

/** Equality-only `where`, enough for the queries under test. */
const matches = (row: Row, where: Row): boolean =>
  Object.entries(where).every(([key, value]) => row[key] === value);

const fortnight = (year: number, month: number, period: 'FIRST' | 'SECOND') => ({
  year,
  month,
  period,
  end_date: new Date(
    Date.UTC(year, month - 1, period === 'FIRST' ? 14 : 27, 18),
  ),
});

const periodRank = (p: unknown) => (p === 'SECOND' ? 1 : 0);

const newestFirst = (a: Row, b: Row): number => {
  const fa = a.fortnight as ReturnType<typeof fortnight>;
  const fb = b.fortnight as ReturnType<typeof fortnight>;
  return (
    fb.year - fa.year ||
    fb.month - fa.month ||
    periodRank(fb.period) - periodRank(fa.period) ||
    (b.id as number) - (a.id as number)
  );
};

const HOUSE_A = { user_id: null, house_id: 7 };
const USER_B = { user_id: 3, house_id: null };

const expenseTemplates: Row[] = [
  { id: 11, ...HOUSE_A },
  { id: 21, ...USER_B },
];
const incomeTemplates: Row[] = [{ id: 31, ...HOUSE_A }];

const expenses: Row[] = [
  { id: 1, expense_template_id: 11, ...HOUSE_A, amount: 300, is_paid: true, due_day: 5, fortnight: fortnight(2026, 9, 'FIRST') },
  { id: 2, expense_template_id: 11, ...HOUSE_A, amount: 300, is_paid: true, due_day: 5, fortnight: fortnight(2026, 10, 'FIRST') },
  { id: 3, expense_template_id: 11, ...HOUSE_A, amount: 310, is_paid: false, due_day: 5, fortnight: fortnight(2026, 11, 'FIRST') },
  { id: 4, expense_template_id: 11, ...HOUSE_A, amount: 290, is_paid: true, due_day: 5, fortnight: fortnight(2026, 8, 'FIRST') },
  // Another owner's record pointing at the same template id must never leak.
  { id: 5, expense_template_id: 11, ...USER_B, amount: 999, is_paid: false, due_day: 20, fortnight: fortnight(2026, 12, 'SECOND') },
  { id: 6, expense_template_id: 21, ...USER_B, amount: 450, is_paid: false, due_day: 20, fortnight: fortnight(2026, 11, 'SECOND') },
];
const incomes: Row[] = [
  { id: 41, income_template_id: 31, ...HOUSE_A, amount: 1000, wallet_credited: true, fortnight: fortnight(2026, 10, 'SECOND') },
  { id: 42, income_template_id: 31, ...HOUSE_A, amount: 1000, wallet_credited: false, fortnight: fortnight(2026, 11, 'FIRST') },
  { id: 43, income_template_id: 31, ...USER_B, amount: 5000, wallet_credited: true, fortnight: fortnight(2026, 12, 'FIRST') },
];

const table = (rows: Row[]) => ({
  findFirst: vi.fn(async ({ where }: { where: Row }) => rows.find((r) => matches(r, where)) ?? null),
  findMany: vi.fn(async ({ where, take }: { where: Row; take: number }) =>
    rows.filter((r) => matches(r, where)).sort(newestFirst).slice(0, take),
  ),
});

// Filled below; the service reads it only when called.
const prismaMock = vi.hoisted(() => ({}) as Record<string, unknown>);
vi.mock('@/lib/prisma', () => ({ default: prismaMock }));
Object.assign(prismaMock, {
  expenseTemplate: table(expenseTemplates),
  incomeTemplate: table(incomeTemplates),
  expense: table(expenses),
  income: table(incomes),
});

import {
  expenseDueYmd,
  expenseHistoryStatus,
  incomeHistoryStatus,
  listScheduledHistoryForOwner,
} from './scheduled-history.service';

// 2026-11-12 midday in Mexico City.
const NOW = new Date('2026-11-12T18:00:00.000Z');

describe('listScheduledHistoryForOwner', () => {
  it('returns the last three of the owner, newest quincena first, with status', async () => {
    const result = await listScheduledHistoryForOwner(HOUSE_A, 'expense', 11, NOW);
    expect(result).toEqual([
      { id: 3, period: 'FIRST', month: 11, year: 2026, amount: 310, status: 'overdue' },
      { id: 2, period: 'FIRST', month: 10, year: 2026, amount: 300, status: 'paid' },
      { id: 1, period: 'FIRST', month: 9, year: 2026, amount: 300, status: 'paid' },
    ]);
  });

  it('never returns a second owner’s records, even on the same item id', async () => {
    const result = await listScheduledHistoryForOwner(HOUSE_A, 'expense', 11, NOW);
    expect(result?.map((e) => e.id)).not.toContain(5);
    expect(result?.every((e) => e.amount !== 999)).toBe(true);

    const incomesA = await listScheduledHistoryForOwner(HOUSE_A, 'income', 31, NOW);
    expect(incomesA?.map((e) => e.id)).toEqual([42, 41]);
  });

  it('answers null for an item that belongs to another owner', async () => {
    await expect(listScheduledHistoryForOwner(USER_B, 'expense', 11, NOW)).resolves.toBeNull();
    await expect(listScheduledHistoryForOwner(HOUSE_A, 'expense', 21, NOW)).resolves.toBeNull();
    await expect(listScheduledHistoryForOwner(USER_B, 'income', 31, NOW)).resolves.toBeNull();
  });

  it('maps income status from wallet_credited', async () => {
    const result = await listScheduledHistoryForOwner(HOUSE_A, 'income', 31, NOW);
    expect(result?.map((e) => e.status)).toEqual(['expected', 'received']);
  });

  it('returns an empty list for an owned item with no records', async () => {
    expenseTemplates.push({ id: 12, ...HOUSE_A });
    await expect(listScheduledHistoryForOwner(HOUSE_A, 'expense', 12, NOW)).resolves.toEqual([]);
  });
});

describe('status rules', () => {
  it('Pagado wins over the date', () => {
    expect(expenseHistoryStatus(true, '2026-01-01', '2026-11-12')).toBe('paid');
  });

  it('Vencido only after the due day, Pendiente on and before it', () => {
    expect(expenseHistoryStatus(false, '2026-11-11', '2026-11-12')).toBe('overdue');
    expect(expenseHistoryStatus(false, '2026-11-12', '2026-11-12')).toBe('pending');
    expect(expenseHistoryStatus(false, '2026-11-20', '2026-11-12')).toBe('pending');
  });

  it('due day clamps to the month and falls back to the quincena end', () => {
    expect(expenseDueYmd(30, fortnight(2026, 2, 'SECOND'))).toBe('2026-02-28');
    expect(expenseDueYmd(null, fortnight(2026, 11, 'FIRST'))).toBe('2026-11-14');
  });

  it('income: Recibido once credited', () => {
    expect(incomeHistoryStatus(true)).toBe('received');
    expect(incomeHistoryStatus(false)).toBe('expected');
  });
});
