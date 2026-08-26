import { beforeEach, describe, expect, it } from 'vitest';
import {
  ensureDefaultCategoriesForOwner,
  ensureDefaultIncomeCategoriesForOwner,
  seedDefaultCategoriesForOwner,
  type CategoryOwnerRef,
} from '@/lib/finance/category-seed.service';
import {
  DEFAULT_CATEGORY_CATALOG,
  DEFAULT_INCOME_CATEGORY_CATALOG,
  countDefaultCatalogCategories,
  countDefaultIncomeCatalogCategories,
} from '@/lib/finance/default-category-catalog';

type Row = {
  id: number;
  name: string;
  icon: string | null;
  active: boolean;
  sort_order: number;
  parent_id: number | null;
  user_id: number | null;
  house_id: number | null;
  kind: 'EXPENSE' | 'INCOME';
};

function createMemoryTx(initial: Row[] = []) {
  let rows = [...initial];
  let nextId = Math.max(0, ...rows.map((r) => r.id)) + 1;

  const matchesOwner = (
    row: Row,
    where: {
      user_id?: number | null;
      house_id?: number | null;
      parent_id?: number | null;
      name?: string;
      kind?: 'EXPENSE' | 'INCOME';
    },
  ) => {
    if ('user_id' in where && row.user_id !== where.user_id) return false;
    if ('house_id' in where && row.house_id !== where.house_id) return false;
    if ('parent_id' in where && row.parent_id !== where.parent_id) return false;
    if ('kind' in where && where.kind != null && row.kind !== where.kind)
      return false;
    if ('name' in where && where.name != null && row.name !== where.name)
      return false;
    return true;
  };

  return {
    category: {
      async count({ where }: { where: Record<string, unknown> }) {
        return rows.filter((r) =>
          matchesOwner(r, where as Parameters<typeof matchesOwner>[1]),
        ).length;
      },
      async findMany({
        where,
        select,
      }: {
        where: Record<string, unknown>;
        select?: Record<string, boolean>;
      }) {
        const filtered = rows.filter((r) =>
          matchesOwner(r, where as Parameters<typeof matchesOwner>[1]),
        );
        if (!select) return filtered;
        return filtered.map((r) => {
          const out: Record<string, unknown> = {};
          for (const key of Object.keys(select)) {
            if (select[key]) out[key] = r[key as keyof Row];
          }
          return out;
        });
      },
      async create({ data }: { data: Partial<Row> }) {
        const row: Row = {
          id: nextId++,
          name: data.name!,
          icon: data.icon ?? null,
          active: data.active ?? true,
          sort_order: data.sort_order ?? 0,
          parent_id: data.parent_id ?? null,
          user_id: data.user_id ?? null,
          house_id: data.house_id ?? null,
          kind: data.kind ?? 'EXPENSE',
        };
        rows.push(row);
        return row;
      },
      async update({
        where,
        data,
      }: {
        where: { id: number };
        data: Partial<Row>;
      }) {
        const idx = rows.findIndex((r) => r.id === where.id);
        if (idx < 0) throw new Error('not found');
        rows[idx] = { ...rows[idx], ...data };
        return rows[idx];
      },
    },
    getRows: () => rows,
  };
}

const owner: CategoryOwnerRef = { userId: 1 };

const fullCatalogCount =
  countDefaultCatalogCategories() + countDefaultIncomeCatalogCategories();

describe('seedDefaultCategoriesForOwner', () => {
  it('clones expense + income catalogs for an empty owner', async () => {
    const tx = createMemoryTx();
    const result = await seedDefaultCategoriesForOwner(tx as never, owner);
    expect(result.skipped).toBe(false);
    expect(result.created).toBe(fullCatalogCount);
    expect(tx.getRows()).toHaveLength(fullCatalogCount);
    expect(tx.getRows().filter((r) => r.kind === 'INCOME')).toHaveLength(
      countDefaultIncomeCatalogCategories(),
    );
  });

  it('seeds only missing kind when the other already exists', async () => {
    const tx = createMemoryTx([
      {
        id: 1,
        name: 'Custom',
        icon: null,
        active: true,
        sort_order: 0,
        parent_id: null,
        user_id: 1,
        house_id: null,
        kind: 'EXPENSE',
      },
    ]);
    const result = await seedDefaultCategoriesForOwner(tx as never, owner);
    expect(result.created).toBe(countDefaultIncomeCatalogCategories());
    expect(result.skipped).toBe(false);
    expect(tx.getRows().filter((r) => r.kind === 'INCOME')).toHaveLength(
      countDefaultIncomeCatalogCategories(),
    );
  });
});

describe('ensureDefaultCategoriesForOwner', () => {
  beforeEach(() => {
    expect(DEFAULT_CATEGORY_CATALOG.some((r) => r.name === 'Comida')).toBe(
      true,
    );
  });

  it('full-seeds an empty owner (expense only)', async () => {
    const tx = createMemoryTx();
    const result = await ensureDefaultCategoriesForOwner(tx as never, owner);
    expect(result.created).toBe(countDefaultCatalogCategories());
    expect(result.reusedRoots).toBe(0);
    expect(result.skipped).toBe(false);
    expect(tx.getRows().every((r) => r.kind === 'EXPENSE')).toBe(true);
  });

  it('reuses an existing root as father and creates missing children', async () => {
    const tx = createMemoryTx([
      {
        id: 10,
        name: 'Comida',
        icon: 'UTENSILS',
        active: true,
        sort_order: 0,
        parent_id: null,
        user_id: 1,
        house_id: null,
        kind: 'EXPENSE',
      },
    ]);

    const result = await ensureDefaultCategoriesForOwner(tx as never, owner);
    const rows = tx.getRows();
    const comida = rows.find((r) => r.name === 'Comida')!;
    const children = rows.filter((r) => r.parent_id === comida.id);

    expect(comida.id).toBe(10);
    expect(result.reusedRoots).toBeGreaterThanOrEqual(1);
    expect(children.map((c) => c.name).sort()).toEqual(
      [...DEFAULT_CATEGORY_CATALOG.find((r) => r.name === 'Comida')!.children]
        .map((c) => c.name)
        .sort(),
    );
    expect(result.created).toBeGreaterThan(0);
    expect(rows.filter((r) => r.name === 'Comida')).toHaveLength(1);
  });

  it('skips catalog child when that name already exists as a root', async () => {
    const tx = createMemoryTx([
      {
        id: 10,
        name: 'Comida',
        icon: 'UTENSILS',
        active: true,
        sort_order: 0,
        parent_id: null,
        user_id: 1,
        house_id: null,
        kind: 'EXPENSE',
      },
      {
        id: 11,
        name: 'Supermercado',
        icon: 'SHOPPING_CART',
        active: true,
        sort_order: 1,
        parent_id: null,
        user_id: 1,
        house_id: null,
        kind: 'EXPENSE',
      },
    ]);

    await ensureDefaultCategoriesForOwner(tx as never, owner);
    const rows = tx.getRows();
    const supermercado = rows.filter((r) => r.name === 'Supermercado');
    expect(supermercado).toHaveLength(1);
    expect(supermercado[0].id).toBe(11);
    expect(supermercado[0].parent_id).toBeNull();
  });

  it('dry-run reports creates without writing', async () => {
    const tx = createMemoryTx([
      {
        id: 10,
        name: 'Comida',
        icon: 'UTENSILS',
        active: true,
        sort_order: 0,
        parent_id: null,
        user_id: 1,
        house_id: null,
        kind: 'EXPENSE',
      },
    ]);
    const before = tx.getRows().length;
    const result = await ensureDefaultCategoriesForOwner(tx as never, owner, {
      dryRun: true,
    });
    expect(tx.getRows()).toHaveLength(before);
    expect(result.created).toBeGreaterThan(0);
    expect(result.reusedRoots).toBeGreaterThanOrEqual(1);
  });

  it('promotes a matched root that had a parent_id to father', async () => {
    const tx = createMemoryTx([
      {
        id: 1,
        name: 'Other',
        icon: null,
        active: true,
        sort_order: 0,
        parent_id: null,
        user_id: 1,
        house_id: null,
        kind: 'EXPENSE',
      },
      {
        id: 10,
        name: 'Comida',
        icon: 'UTENSILS',
        active: true,
        sort_order: 0,
        parent_id: 1,
        user_id: 1,
        house_id: null,
        kind: 'EXPENSE',
      },
    ]);

    await ensureDefaultCategoriesForOwner(tx as never, owner);
    const comida = tx.getRows().find((r) => r.name === 'Comida')!;
    expect(comida.parent_id).toBeNull();
  });
});

describe('ensureDefaultIncomeCategoriesForOwner', () => {
  it('seeds the five income roots', async () => {
    const tx = createMemoryTx();
    const result = await ensureDefaultIncomeCategoriesForOwner(
      tx as never,
      owner,
    );
    expect(result.created).toBe(countDefaultIncomeCatalogCategories());
    expect(
      tx
        .getRows()
        .filter((r) => r.kind === 'INCOME')
        .map((r) => r.name),
    ).toEqual(DEFAULT_INCOME_CATEGORY_CATALOG.map((r) => r.name));
  });
});
