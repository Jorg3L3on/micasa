import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { DEFAULT_CATEGORY_CATALOG } from '@/lib/finance/default-category-catalog';

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

/**
 * Clone the default category catalog for an owner when they have zero categories.
 * Idempotent: no-op if the owner already has any category rows.
 */
export async function seedDefaultCategoriesForOwner(
  tx: Tx,
  owner: CategoryOwnerRef,
): Promise<{ created: number; skipped: boolean }> {
  const existing = await tx.category.count({
    where: ownerWhere(owner),
  });
  if (existing > 0) {
    return { created: 0, skipped: true };
  }

  let created = 0;
  let rootOrder = 0;

  for (const root of DEFAULT_CATEGORY_CATALOG) {
    const parent = await tx.category.create({
      data: {
        name: root.name,
        icon: root.icon,
        active: true,
        sort_order: rootOrder,
        parent_id: null,
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
          ...ownerCreateData(owner),
        },
      });
      created += 1;
      childOrder += 1;
    }
  }

  return { created, skipped: false };
}

type ExistingCategoryRow = {
  id: number;
  name: string;
  parent_id: number | null;
  sort_order: number;
};

/**
 * Ensure the default catalog exists for an owner without deleting anything.
 * - Empty owner: full catalog clone.
 * - Existing owner: reuse matching names as roots (fathers); create only missing roots/children.
 *   If a catalog child name already exists anywhere for the owner, skip (do not reparent).
 */
export async function ensureDefaultCategoriesForOwner(
  tx: Tx,
  owner: CategoryOwnerRef,
  options: EnsureCategoriesOptions = {},
): Promise<EnsureCategoriesResult> {
  const dryRun = options.dryRun === true;
  const where = ownerWhere(owner);

  const existingRows = (await tx.category.findMany({
    where,
    select: { id: true, name: true, parent_id: true, sort_order: true },
  })) as ExistingCategoryRow[];

  if (existingRows.length === 0) {
    if (dryRun) {
      let wouldCreate = 0;
      for (const root of DEFAULT_CATEGORY_CATALOG) {
        wouldCreate += 1 + root.children.length;
      }
      return {
        created: wouldCreate,
        skippedExisting: 0,
        reusedRoots: 0,
        skipped: false,
      };
    }
    const seeded = await seedDefaultCategoriesForOwner(tx, owner);
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

  // Track names added during this run so later catalog entries see them.
  const knownNames = new Set(byName.keys());
  // Synthetic ids for dry-run parent references.
  let syntheticId = -1;
  const rootIdByCatalogName = new Map<string, number>();

  for (const root of DEFAULT_CATEGORY_CATALOG) {
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
      // Created earlier in this pass (shouldn't happen for unique catalog names).
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
