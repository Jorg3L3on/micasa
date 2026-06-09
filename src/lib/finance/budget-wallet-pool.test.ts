import { describe, expect, it } from 'vitest';
import {
  computeSharedWalletAvailableByAllocation,
  computeSharedWalletCategoryDisplays,
  formatWalletAdjustmentNote,
  groupAllocationsByWallet,
} from '@/lib/finance/budget-wallet-pool';
import type { BudgetAllocationItem } from '@/types/catalog';

function alloc(
  overrides: Partial<BudgetAllocationItem> & Pick<BudgetAllocationItem, 'id' | 'wallet_id' | 'category_name'>,
): BudgetAllocationItem {
  return {
    wallet_name: 'Wallet',
    category_id: overrides.id,
    amount: 500,
    ...overrides,
  };
}

describe('groupAllocationsByWallet', () => {
  it('returns solo groups for single-allocation wallets', () => {
    const groups = groupAllocationsByWallet([
      alloc({ id: 1, wallet_id: 10, wallet_name: 'BANAMEX', category_name: 'Comida' }),
      alloc({ id: 2, wallet_id: 11, wallet_name: 'Efectivo', category_name: 'Comida' }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.kind === 'solo')).toBe(true);
  });

  it('pools shared wallet allocations across categories', () => {
    const groups = groupAllocationsByWallet([
      alloc({ id: 1, wallet_id: 20, wallet_name: 'Banorte', category_name: 'Comida', amount: 500, spent_amount: 600 }),
      alloc({ id: 2, wallet_id: 20, wallet_name: 'Banorte', category_name: 'Despensa', amount: 250, spent_amount: 0 }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe('shared');
    if (groups[0].kind === 'shared') {
      expect(groups[0].pool.remaining).toBe(150);
      expect(groups[0].items).toHaveLength(2);
    }
  });
});

describe('computeSharedWalletAvailableByAllocation', () => {
  it('absorbs sibling overspend into under-cap category disponible', () => {
    const groups = groupAllocationsByWallet([
      alloc({ id: 1, wallet_id: 30, wallet_name: 'BANAMEX', category_name: 'Comida', amount: 2800, spent_amount: 1400 }),
      alloc({ id: 2, wallet_id: 30, wallet_name: 'BANAMEX', category_name: 'Transporte', amount: 1200, spent_amount: 1600 }),
    ]);

    expect(groups[0].kind).toBe('shared');
    if (groups[0].kind !== 'shared') return;

    const effective = computeSharedWalletAvailableByAllocation(groups[0].pool);
    expect(effective.get(1)).toBe(1000);
    expect(effective.get(2)).toBe(-400);
  });

  it('distributes wallet pool across multiple under-cap categories', () => {
    const groups = groupAllocationsByWallet([
      alloc({ id: 1, wallet_id: 20, wallet_name: 'Banorte', category_name: 'Comida', amount: 500, spent_amount: 600 }),
      alloc({ id: 2, wallet_id: 20, wallet_name: 'Banorte', category_name: 'Despensa', amount: 250, spent_amount: 0 }),
    ]);

    if (groups[0].kind !== 'shared') return;

    const effective = computeSharedWalletAvailableByAllocation(groups[0].pool);
    expect(effective.get(1)).toBe(-100);
    expect(effective.get(2)).toBe(150);
  });
});

describe('computeSharedWalletCategoryDisplays', () => {
  it('explains wallet adjustment for under-cap category with overspent sibling', () => {
    const groups = groupAllocationsByWallet([
      alloc({ id: 1, wallet_id: 30, wallet_name: 'BANAMEX', category_name: 'Comida', amount: 2800, spent_amount: 1400 }),
      alloc({ id: 2, wallet_id: 30, wallet_name: 'BANAMEX', category_name: 'Transporte', amount: 1200, spent_amount: 1600 }),
    ]);

    if (groups[0].kind !== 'shared') return;

    const displays = computeSharedWalletCategoryDisplays(groups[0].pool);
    const comida = displays.get(1)!;

    expect(comida.categoryHeadroom).toBe(1400);
    expect(comida.effectiveAvailable).toBe(1000);
    expect(comida.walletAdjustment).toBe(400);
    expect(formatWalletAdjustmentNote(comida)).toBe(
      '−$400.00 por exceso en Transporte (misma billetera)',
    );
  });
});
