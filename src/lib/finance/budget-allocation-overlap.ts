export type AllocationOverlapInput = {
  wallet_id: number | null;
  category_id: number;
};

/**
 * Rejects category overlaps inside one presupuesto.
 * A null wallet is "Cualquier cartera" and already rolls direct children
 * into the parent on every wallet.
 */
export function allocationOverlapMessage(
  allocations: AllocationOverlapInput[],
  parentIdByCategoryId: ReadonlyMap<number, number | null> = new Map(),
): string | null {
  const complete = allocations.filter(
    (row) =>
      row.category_id > 0 && (row.wallet_id === null || row.wallet_id > 0),
  );

  const byCategory = new Map<number, { any: number; wallets: Set<number> }>();
  for (const row of complete) {
    const entry = byCategory.get(row.category_id) ?? {
      any: 0,
      wallets: new Set<number>(),
    };
    if (row.wallet_id == null) entry.any += 1;
    else entry.wallets.add(row.wallet_id);
    byCategory.set(row.category_id, entry);
  }

  for (const entry of byCategory.values()) {
    if (entry.any > 1) {
      return 'La misma categoría no puede aparecer dos veces en Cualquier cartera.';
    }
    if (entry.any === 1 && entry.wallets.size > 0) {
      return 'La misma categoría no puede ser Cualquier cartera y una cartera específica a la vez.';
    }
  }

  const nullWalletCategories = new Set(
    complete
      .filter((row) => row.wallet_id == null)
      .map((row) => row.category_id),
  );

  for (const row of complete) {
    const parentId = parentIdByCategoryId.get(row.category_id);
    if (parentId == null) continue;
    const parentIsAllocated = complete.some(
      (other) => other.category_id === parentId,
    );
    if (!parentIsAllocated) continue;
    const parentIsAny = nullWalletCategories.has(parentId);
    const childIsAny = row.wallet_id == null;
    if (parentIsAny || childIsAny) {
      return 'Cualquier cartera en una categoría padre ya incluye sus subcategorías. Quita la subcategoría o elige una cartera en ambas.';
    }
  }

  return null;
}
