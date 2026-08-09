export type CategoryHierarchyRow = {
  id: number;
  parent_id: number | null;
  active: boolean;
};

/**
 * Category ids that roll up under a parent for spend/reporting:
 * the parent itself plus all direct children.
 */
export const categoryIdsForRollup = (
  parentId: number,
  rows: readonly CategoryHierarchyRow[],
): number[] => {
  const ids = [parentId];
  for (const row of rows) {
    if (row.parent_id === parentId) ids.push(row.id);
  }
  return ids;
};

/** Map each category id → rollup root id (self if root, else parent). */
export const rollupRootByCategoryId = (
  rows: readonly CategoryHierarchyRow[],
): Map<number, number> => {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const result = new Map<number, number>();
  for (const row of rows) {
    if (row.parent_id == null) {
      result.set(row.id, row.id);
    } else {
      const parent = byId.get(row.parent_id);
      result.set(row.id, parent?.parent_id == null ? row.parent_id : row.id);
    }
  }
  return result;
};

/**
 * Whether a category should appear in expense/budget pickers.
 * Inactive roots hide the whole group; inactive children are hidden;
 * children of inactive roots are hidden even if still active in DB
 * (after cascade deactivate they should already be inactive).
 */
export const isSelectableInPicker = (
  category: CategoryHierarchyRow,
  rows: readonly CategoryHierarchyRow[],
): boolean => {
  if (!category.active) return false;
  if (category.parent_id == null) return true;
  const parent = rows.find((r) => r.id === category.parent_id);
  return parent?.active === true;
};
