import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = {
  id: number;
  amount: number;
  wallet_id: number | null;
  category_id: number | null;
};

const dataset: Row[] = [
  { id: 1, amount: 100, wallet_id: 4, category_id: 10 },
  { id: 2, amount: 250, wallet_id: 4, category_id: 11 },
  { id: 3, amount: 80, wallet_id: 9, category_id: 10 },
  { id: 4, amount: 40, wallet_id: null, category_id: 10 },
  { id: 5, amount: 15, wallet_id: 9, category_id: null },
];

const walletNames: Record<number, string> = { 4: 'Efectivo', 9: 'Visa' };
const categoryNames: Record<number, string> = { 10: 'Comida', 11: 'Renta' };

const db = vi.hoisted(() => ({
  count: vi.fn(),
  findMany: vi.fn(),
  groupBy: vi.fn(),
  walletFindMany: vi.fn(),
  categoryFindMany: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    expense: { count: db.count, findMany: db.findMany, groupBy: db.groupBy },
    wallet: { findMany: db.walletFindMany },
    category: { findMany: db.categoryFindMany },
  },
}));

import { listExpensesWithTotals } from '@/lib/finance/expense-list.service';

const OWNER = { user_id: null, house_id: 42 };
const RANGE = { from: '2026-08-01', to: '2026-08-31' };

beforeEach(() => {
  vi.clearAllMocks();
  db.count.mockResolvedValue(dataset.length);
  db.findMany.mockImplementation(async ({ skip, take }: { skip: number; take: number }) =>
    dataset.slice(skip, skip + take).map((row) => ({
      ...row,
      wallet: row.wallet_id == null ? null : { name: walletNames[row.wallet_id] },
      category: row.category_id == null ? null : { name: categoryNames[row.category_id] },
    })),
  );
  db.groupBy.mockImplementation(async () => {
    const groups = new Map<string, { wallet_id: number | null; category_id: number | null; sum: number }>();
    for (const row of dataset) {
      const key = `${row.wallet_id}:${row.category_id}`;
      const group = groups.get(key) ?? { wallet_id: row.wallet_id, category_id: row.category_id, sum: 0 };
      group.sum += row.amount;
      groups.set(key, group);
    }
    return [...groups.values()].map((g) => ({
      wallet_id: g.wallet_id,
      category_id: g.category_id,
      _sum: { amount: g.sum },
    }));
  });
  db.walletFindMany.mockImplementation(async ({ where }: { where: { id: { in: number[] } } }) =>
    where.id.in.map((id) => ({ id, name: walletNames[id] })),
  );
  db.categoryFindMany.mockImplementation(async ({ where }: { where: { id: { in: number[] } } }) =>
    where.id.in.map((id) => ({ id, name: categoryNames[id] })),
  );
});

describe('listExpensesWithTotals', () => {
  it('computes range totals with one groupBy and never reloads every row', async () => {
    const result = await listExpensesWithTotals(OWNER, RANGE, { limit: 2, offset: 0 });

    expect(db.groupBy).toHaveBeenCalledTimes(1);
    expect(db.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ by: ['wallet_id', 'category_id'], _sum: { amount: true } }),
    );
    // Only the page query reads expense rows.
    expect(db.findMany).toHaveBeenCalledTimes(1);
    expect(db.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 2 }));

    expect(result.totalCount).toBe(5);
    expect(result.expenses).toHaveLength(2);
    expect(result.totals).toEqual({
      by_wallet: { Efectivo: 350, Visa: 95, 'Sin billetera': 40 },
      by_category: { Comida: 220, Renta: 250, 'Sin categoría': 15 },
    });
  });

  it('range totals equal the sum of totals_in_page over every page', async () => {
    const pageTotals = { by_wallet: {} as Record<string, number>, by_category: {} as Record<string, number> };
    let totals;
    for (let offset = 0; offset < dataset.length; offset += 2) {
      const page = await listExpensesWithTotals(OWNER, RANGE, { limit: 2, offset });
      totals = page.totals;
      for (const [key, value] of Object.entries(page.totalsInPage.by_wallet)) {
        pageTotals.by_wallet[key] = (pageTotals.by_wallet[key] ?? 0) + value;
      }
      for (const [key, value] of Object.entries(page.totalsInPage.by_category)) {
        pageTotals.by_category[key] = (pageTotals.by_category[key] ?? 0) + value;
      }
    }

    expect(totals).toEqual(pageTotals);
  });

  it('scopes every query to the owner, the civil range and the filters', async () => {
    await listExpensesWithTotals(OWNER, { ...RANGE, walletId: 4, categoryId: 10 }, { limit: 50, offset: 0 });

    const where = db.groupBy.mock.lastCall?.[0].where;
    expect(where).toMatchObject({ house_id: 42, user_id: null, wallet_id: 4, category_id: 10 });
    expect(where.OR[0].payment_date.gte).toBeInstanceOf(Date);
    expect(db.count).toHaveBeenCalledWith({ where });
    expect(db.findMany.mock.lastCall?.[0].where).toBe(where);
  });
});
