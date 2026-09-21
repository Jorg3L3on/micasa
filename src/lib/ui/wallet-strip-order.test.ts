import { describe, expect, it } from 'vitest';
import {
  applyWalletStripOrder,
  defaultWalletStripOrder,
  isPointerNearWalletStrip,
  isWalletStripTouchPointer,
  moveWalletStripId,
  parseWalletStripOrder,
  walletStripAutoScrollDelta,
  walletStripHoldShouldCancel,
  walletStripInsertIndexAtPointerX,
  walletStripMouseShouldActivate,
  walletStripOrderStorageKey,
  walletStripPointerDistance,
} from './wallet-strip-order';

const wallet = (
  id: number,
  name: string,
  type: string,
  amount = 0,
  credit_limit: number | null = null,
) => ({ id, name, type, amount, credit_limit });

describe('defaultWalletStripOrder', () => {
  it('orders cash, debit, then credit by name', () => {
    const ordered = defaultWalletStripOrder([
      wallet(3, 'Sears', 'CREDIT_CARD', 100, 1000),
      wallet(1, 'Efectivo', 'CASH', 50),
      wallet(2, 'Banamex', 'DEBIT_CARD', 200),
      wallet(4, 'BBVA Jorge', 'DEBIT_CARD', 10),
    ]);
    expect(ordered.map((item) => item.id)).toEqual([1, 2, 4, 3]);
  });

  it('sorts credit cards by percent used ascending', () => {
    const ordered = defaultWalletStripOrder([
      wallet(1, 'High', 'CREDIT_CARD', 900, 1000),
      wallet(2, 'Low', 'CREDIT_CARD', 100, 1000),
    ]);
    expect(ordered.map((item) => item.id)).toEqual([2, 1]);
  });
});

describe('applyWalletStripOrder', () => {
  const wallets = [
    wallet(1, 'A', 'CASH'),
    wallet(2, 'B', 'CASH'),
    wallet(3, 'C', 'CASH'),
  ];

  it('returns the given list when there is no saved order', () => {
    expect(applyWalletStripOrder(wallets, null).map((item) => item.id)).toEqual([
      1, 2, 3,
    ]);
  });

  it('reorders known ids and appends new wallets', () => {
    expect(
      applyWalletStripOrder(wallets, [3, 1, 99]).map((item) => item.id),
    ).toEqual([3, 1, 2]);
  });

  it('drops duplicate saved ids', () => {
    expect(
      applyWalletStripOrder(wallets, [2, 2, 1]).map((item) => item.id),
    ).toEqual([2, 1, 3]);
  });
});

describe('moveWalletStripId', () => {
  it('moves an id earlier and later', () => {
    expect(moveWalletStripId([1, 2, 3, 4], 4, 0)).toEqual([4, 1, 2, 3]);
    expect(moveWalletStripId([1, 2, 3, 4], 1, 4)).toEqual([2, 3, 4, 1]);
  });

  it('no-ops when the slot does not change', () => {
    expect(moveWalletStripId([1, 2, 3], 2, 1)).toEqual([1, 2, 3]);
  });

  it('moves one slot right when dropping past the next card midpoint', () => {
    expect(moveWalletStripId([1, 2, 3, 4], 1, 2)).toEqual([2, 1, 3, 4]);
  });
});

describe('parseWalletStripOrder', () => {
  it('accepts integer id arrays', () => {
    expect(parseWalletStripOrder('[4,2,9]')).toEqual([4, 2, 9]);
  });

  it('rejects invalid payloads', () => {
    expect(parseWalletStripOrder(null)).toBeNull();
    expect(parseWalletStripOrder('[]')).toBeNull();
    expect(parseWalletStripOrder('{"a":1}')).toBeNull();
    expect(parseWalletStripOrder('[1,"x"]')).toBeNull();
  });
});

describe('walletStripOrderStorageKey', () => {
  it('scopes the key by owner', () => {
    expect(walletStripOrderStorageKey('house', 5)).toBe(
      'micasa.planificacion.walletStripOrder:house:5',
    );
  });
});

describe('walletStripAutoScrollDelta', () => {
  it('scrolls left in the left edge zone and right in the right zone', () => {
    expect(walletStripAutoScrollDelta(10, 0, 200, 50, 20)).toBeLessThan(0);
    expect(walletStripAutoScrollDelta(190, 0, 200, 50, 20)).toBeGreaterThan(0);
  });

  it('does not scroll in the middle', () => {
    expect(walletStripAutoScrollDelta(100, 0, 200, 50, 20)).toBe(0);
  });

  it('uses the full step when the pointer is past the edge', () => {
    expect(walletStripAutoScrollDelta(-20, 0, 200, 50, 20)).toBe(-20);
    expect(walletStripAutoScrollDelta(240, 0, 200, 50, 20)).toBe(20);
  });
});

describe('isPointerNearWalletStrip', () => {
  it('allows a vertical slack around the strip', () => {
    expect(isPointerNearWalletStrip(40, 100, 160, 50)).toBe(false);
    expect(isPointerNearWalletStrip(60, 100, 160, 50)).toBe(true);
    expect(isPointerNearWalletStrip(200, 100, 160, 50)).toBe(true);
    expect(isPointerNearWalletStrip(220, 100, 160, 50)).toBe(false);
  });
});

describe('wallet strip pointer reorder helpers', () => {
  it('measures pointer travel', () => {
    expect(walletStripPointerDistance(3, 4)).toBe(5);
  });

  it('cancels a long-press after enough travel so the strip can scroll', () => {
    expect(walletStripHoldShouldCancel(10)).toBe(false);
    expect(walletStripHoldShouldCancel(11)).toBe(true);
  });

  it('activates mouse drag after a short travel', () => {
    expect(walletStripMouseShouldActivate(6)).toBe(false);
    expect(walletStripMouseShouldActivate(7)).toBe(true);
  });

  it('treats touch and pen as press-and-hold pointers', () => {
    expect(isWalletStripTouchPointer('touch')).toBe(true);
    expect(isWalletStripTouchPointer('pen')).toBe(true);
    expect(isWalletStripTouchPointer('mouse')).toBe(false);
  });

  it('picks the insert slot before the first center to the right of the pointer', () => {
    expect(walletStripInsertIndexAtPointerX(10, [0, 100, 200])).toBe(1);
    expect(walletStripInsertIndexAtPointerX(-10, [0, 100, 200])).toBe(0);
    expect(walletStripInsertIndexAtPointerX(80, [0, 100, 200])).toBe(1);
    expect(walletStripInsertIndexAtPointerX(150, [0, 100, 200])).toBe(2);
    expect(walletStripInsertIndexAtPointerX(250, [0, 100, 200])).toBe(3);
    expect(walletStripInsertIndexAtPointerX(0, [])).toBe(0);
  });
});
