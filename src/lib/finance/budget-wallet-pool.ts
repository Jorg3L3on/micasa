import type { BudgetAllocationItem } from '@/types/catalog';
import { formatCurrency } from '@/lib/utils';

export type WalletPool = {
  wallet_id: number;
  wallet_name: string;
  allocated: number;
  spent: number;
  remaining: number;
  isShared: boolean;
  allocations: BudgetAllocationItem[];
};

export type WalletAllocationGroup =
  | { kind: 'solo'; allocation: BudgetAllocationItem; globalIndex: number }
  | {
      kind: 'shared';
      pool: WalletPool;
      items: Array<{ allocation: BudgetAllocationItem; globalIndex: number }>;
    };

function buildWalletPool(
  wallet_id: number,
  wallet_name: string,
  allocations: BudgetAllocationItem[],
): WalletPool {
  const allocated = allocations.reduce((sum, a) => sum + a.amount, 0);
  const spent = allocations.reduce(
    (sum, a) => sum + (a.spent_amount ?? 0),
    0,
  );

  return {
    wallet_id,
    wallet_name,
    allocated,
    spent,
    remaining: allocated - spent,
    isShared: allocations.length > 1,
    allocations,
  };
}

/** Group period allocations by wallet; shared wallets (2+ categories) become pooled groups. */
export function groupAllocationsByWallet(
  allocations: BudgetAllocationItem[],
): WalletAllocationGroup[] {
  const byWallet = new Map<number, BudgetAllocationItem[]>();
  const walletNames = new Map<number, string>();

  for (const allocation of allocations) {
    const list = byWallet.get(allocation.wallet_id) ?? [];
    list.push(allocation);
    byWallet.set(allocation.wallet_id, list);
    walletNames.set(allocation.wallet_id, allocation.wallet_name);
  }

  const groups: WalletAllocationGroup[] = [];
  let globalIndex = 0;

  for (const [wallet_id, walletAllocations] of byWallet) {
    const items = walletAllocations.map((allocation) => ({
      allocation,
      globalIndex: globalIndex++,
    }));

    if (walletAllocations.length === 1) {
      groups.push({
        kind: 'solo',
        allocation: walletAllocations[0],
        globalIndex: items[0].globalIndex,
      });
    } else {
      groups.push({
        kind: 'shared',
        pool: buildWalletPool(
          wallet_id,
          walletNames.get(wallet_id) ?? '',
          walletAllocations,
        ),
        items,
      });
    }
  }

  return groups;
}

function categoryRemaining(allocation: BudgetAllocationItem): number {
  return allocation.amount - (allocation.spent_amount ?? 0);
}

/**
 * Wallet-realistic disponible per category when allocations share a wallet.
 * Overspent categories keep their category debt; under-cap categories share
 * the wallet pool proportionally to their headroom.
 */
export function computeSharedWalletAvailableByAllocation(
  pool: WalletPool,
): Map<number, number> {
  const rows = pool.allocations.map((allocation) => ({
    id: allocation.id,
    remaining: categoryRemaining(allocation),
  }));

  const totalPositiveHeadroom = rows.reduce(
    (sum, row) => sum + Math.max(0, row.remaining),
    0,
  );
  const walletRemaining = pool.remaining;
  const result = new Map<number, number>();

  for (const row of rows) {
    if (row.remaining <= 0) {
      result.set(row.id, row.remaining);
      continue;
    }

    if (walletRemaining <= 0 || totalPositiveHeadroom <= 0) {
      result.set(row.id, 0);
      continue;
    }

    result.set(
      row.id,
      row.remaining * (walletRemaining / totalPositiveHeadroom),
    );
  }

  return result;
}

export type SharedWalletCategoryDisplay = {
  categoryHeadroom: number;
  effectiveAvailable: number;
  /** Amount absorbed from this category's headroom due to sibling overspend. */
  walletAdjustment: number;
  overspentSiblingCategories: string[];
  walletName: string;
};

export function computeSharedWalletCategoryDisplays(
  pool: WalletPool,
): Map<number, SharedWalletCategoryDisplay> {
  const effectiveAvailable = computeSharedWalletAvailableByAllocation(pool);
  const overspentSiblings = pool.allocations
    .map((allocation) => ({
      id: allocation.id,
      name: allocation.category_name,
      overspend: Math.min(0, categoryRemaining(allocation)),
    }))
    .filter((row) => row.overspend < 0);

  const overspentSiblingNames = overspentSiblings.map((row) => row.name);
  const result = new Map<number, SharedWalletCategoryDisplay>();

  for (const allocation of pool.allocations) {
    const categoryHeadroom = categoryRemaining(allocation);
    const effective = effectiveAvailable.get(allocation.id) ?? categoryHeadroom;
    const walletAdjustment =
      categoryHeadroom > 0 ? Math.max(0, categoryHeadroom - effective) : 0;

    result.set(allocation.id, {
      categoryHeadroom,
      effectiveAvailable: effective,
      walletAdjustment,
      overspentSiblingCategories: overspentSiblings
        .filter((row) => row.id !== allocation.id)
        .map((row) => row.name),
      walletName: pool.wallet_name,
    });
  }

  return result;
}

export function formatWalletAdjustmentNote(
  display: SharedWalletCategoryDisplay,
): string | null {
  if (display.walletAdjustment <= 0) return null;

  const amount = formatCurrency(display.walletAdjustment);
  const siblings = display.overspentSiblingCategories;

  if (siblings.length === 1) {
    return `−${amount} por exceso en ${siblings[0]} (misma billetera)`;
  }

  if (siblings.length > 1) {
    return `−${amount} por exceso en ${siblings.join(', ')} (${display.walletName})`;
  }

  return `−${amount} por otras categorías de ${display.walletName}`;
}
