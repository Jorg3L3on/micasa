import type { CategoryKind, Prisma, PrismaClient } from '@/generated/prisma/client';
import {
  DEFAULT_CATEGORY_CATALOG,
  DEFAULT_INCOME_CATEGORY_CATALOG,
  type DefaultCategoryRoot,
} from '@/lib/finance/default-category-catalog';

export type CategoryOwnerRef =
  | { userId: number; houseId?: never }
  | { houseId: number; userId?: never };

type Tx = Prisma.TransactionClient | PrismaClient;

export type EnsureCategoriesResult = {
  created: number;
  skippedExisting: number;
  reusedRoots: number;
  /** True only when empty-owner seed was skipped because rows already existed (legacy helper). */
  skipped: boolean;
};

export type EnsureCategoriesOptions = {
  dryRun?: boolean;
};

const ownerWhere = (owner: CategoryOwnerRef) =>
  'userId' in owner && owner.userId != null
    ? { user_id: owner.userId, house_id: null as number | null }
    : { user_id: null as number | null, house_id: owner.houseId };

const ownerCreateData = (owner: CategoryOwnerRef) =>
  'userId' in owner && owner.userId != null
    ? { user_id: owner.userId, house_id: null as number | null }
    : { user_id: null as number | null, house_id: owner.houseId };

async function seedCatalogForOwner(
  tx: Tx,
  owner: CategoryOwnerRef,
  catalog: readonly DefaultCategoryRoot[],
  kind: CategoryKind,
): Promise<{ created: number; skipped: boolean }> {
  const existing = await tx.category.count({
    where: { ...ownerWhere(owner), kind },
  });
  if (existing > 0) {
    return { created: 0, skipped: true };
  }

  let created = 0;
  let rootOrder = 0;

  for (const root of catalog) {
    const parent = await tx.category.create({
      data: {
        name: root.name,
        icon: root.icon,
        active: true,
        sort_order: rootOrder,
        parent_id: null,
        kind,
        ...ownerCreateData(owner),
      },
    });
    created += 1;
    rootOrder += 1;

    let childOrder = 0;
    for (const child of root.children) {
      await tx.category.create({
        data: {
          name: child.name,
          icon: child.icon,
          active: true,
          sort_order: childOrder,
          parent_id: parent.id,
          kind,
          ...ownerCreateData(owner),
        },
      });
      created += 1;
      childOrder += 1;
    }
  }

  return { created, skipped: false };
}

/** Seed only expense defaults when the owner has zero expense categories. */
export async function seedDefaultExpenseCategoriesForOwner(
  tx: Tx,
  owner: CategoryOwnerRef,
): Promise<{ created: number; skipped: boolean }> {
  return seedCatalogForOwner(tx, owner, DEFAULT_CATEGORY_CATALOG, 'EXPENSE');
}

/** Seed only income defaults when the owner has zero income categories. */
export async function seedDefaultIncomeCategoriesForOwner(
  tx: Tx,
  owner: CategoryOwnerRef,
): Promise<{ created: number; skipped: boolean }> {
  return seedCatalogForOwner(
    tx,
    owner,
    DEFAULT_INCOME_CATEGORY_CATALOG,
    'INCOME',
  );
}

/**
 * Clone the default expense + income catalogs for an owner when each kind is empty.
 * Idempotent per kind. Used by onboarding / house create.
 */
export async function seedDefaultCategoriesForOwner(
  tx: Tx,
  owner: CategoryOwnerRef,
): Promise<{ created: number; skipped: boolean }> {
  const expense = await seedDefaultExpenseCategoriesForOwner(tx, owner);
  const income = await seedDefaultIncomeCategoriesForOwner(tx, owner);
  return {
    created: expense.created + income.created,
    skipped: expense.skipped && income.skipped,
  };
}

type ExistingCategoryRow = {
  id: number;
  name: string;
  parent_id: number | null;
  sort_order: number;
};

async function ensureCatalogForOwner(
  tx: Tx,
  owner: CategoryOwnerRef,
  catalog: readonly DefaultCategoryRoot[],
  kind: CategoryKind,
  options: EnsureCategoriesOptions = {},
): Promise<EnsureCategoriesResult> {
  const dryRun = options.dryRun === true;
  const where = { ...ownerWhere(owner), kind };

  const existingRows = (await tx.category.findMany({
    where,
    select: { id: true, name: true, parent_id: true, sort_order: true },
  })) as ExistingCategoryRow[];

  if (existingRows.length === 0) {
    if (dryRun) {
      let wouldCreate = 0;
      for (const root of catalog) {
        wouldCreate += 1 + root.children.length;
      }
      return {
        created: wouldCreate,
        skippedExisting: 0,
        reusedRoots: 0,
        skipped: false,
      };
    }
    const seeded = await seedCatalogForOwner(tx, owner, catalog, kind);
    return {
      created: seeded.created,
      skippedExisting: 0,
      reusedRoots: 0,
      skipped: seeded.skipped,
    };
  }

  const byName = new Map<string, ExistingCategoryRow>();
  for (const row of existingRows) {
    if (!byName.has(row.name)) byName.set(row.name, row);
  }

  let created = 0;
  let skippedExisting = 0;
  let reusedRoots = 0;
  let nextRootOrder =
    Math.max(
      -1,
      ...existingRows
        .filter((r) => r.parent_id == null)
        .map((r) => r.sort_order),
    ) + 1;

  const knownNames = new Set(byName.keys());
  let syntheticId = -1;
  const rootIdByCatalogName = new Map<string, number>();

  for (const root of catalog) {
    const existingRoot = byName.get(root.name);
    let parentId: number;

    if (existingRoot) {
      reusedRoots += 1;
      skippedExisting += 1;
      parentId = existingRoot.id;
      rootIdByCatalogName.set(root.name, parentId);
      if (!dryRun && existingRoot.parent_id != null) {
        await tx.category.update({
          where: { id: existingRoot.id },
          data: { parent_id: null },
        });
      }
    } else if (knownNames.has(root.name)) {
      skippedExisting += 1;
      parentId = rootIdByCatalogName.get(root.name)!;
    } else {
      if (dryRun) {
        parentId = syntheticId--;
      } else {
        const parent = await tx.category.create({
          data: {
            name: root.name,
            icon: root.icon,
            active: true,
            sort_order: nextRootOrder,
            parent_id: null,
            kind,
            ...ownerCreateData(owner),
          },
        });
        parentId = parent.id;
      }
      nextRootOrder += 1;
      created += 1;
      knownNames.add(root.name);
      rootIdByCatalogName.set(root.name, parentId);
    }

    let childOrder = 0;
    if (!dryRun) {
      childOrder = await tx.category.count({
        where: { ...where, parent_id: parentId },
      });
    }

    for (const child of root.children) {
      if (knownNames.has(child.name)) {
        skippedExisting += 1;
        continue;
      }

      if (dryRun) {
        created += 1;
        knownNames.add(child.name);
        continue;
      }

      await tx.category.create({
        data: {
          name: child.name,
          icon: child.icon,
          active: true,
          sort_order: childOrder,
          parent_id: parentId,
          kind,
          ...ownerCreateData(owner),
        },
      });
      childOrder += 1;
      created += 1;
      knownNames.add(child.name);
    }
  }

  return {
    created,
    skippedExisting,
    reusedRoots,
    skipped: false,
  };
}

/**
 * Ensure the default expense catalog exists for an owner without deleting anything.
 */
export async function ensureDefaultCategoriesForOwner(
  tx: Tx,
  owner: CategoryOwnerRef,
  options: EnsureCategoriesOptions = {},
): Promise<EnsureCategoriesResult> {
  return ensureCatalogForOwner(
    tx,
    owner,
    DEFAULT_CATEGORY_CATALOG,
    'EXPENSE',
    options,
  );
}

/**
 * Ensure the default income catalog exists for an owner without deleting anything.
 */
export async function ensureDefaultIncomeCategoriesForOwner(
  tx: Tx,
  owner: CategoryOwnerRef,
  options: EnsureCategoriesOptions = {},
): Promise<EnsureCategoriesResult> {
  return ensureCatalogForOwner(
    tx,
    owner,
    DEFAULT_INCOME_CATEGORY_CATALOG,
    'INCOME',
    options,
  );
}
