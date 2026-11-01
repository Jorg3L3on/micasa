import { describe, expect, it } from 'vitest';
import type { WalletListItem } from '@/types/catalog';
import {
  buildAttentionItems,
  availableWalletSegments,
  clampFlowIndex,
  filterWalletsBySegment,
  coverFlowSlot,
  daysUntilDueDay,
  groupWalletsBySection,
  rubberBandPosition,
  settleFlowIndex,
  summarizeWallets,
} from './wallet-cover-flow';

const wallet = (overrides: Partial<WalletListItem>): WalletListItem => ({
  id: 1,
  name: 'W',
  provider_icon_key: null,
  amount: 0,
  type: 'DEBIT_CARD',
  active: true,
  include_in_liquidity: true,
  cutoff_day: null,
  due_day: null,
  spent_amount: 0,
  remaining_amount: 0,
  assignee_user_id: null,
  assignee: null,
  ...overrides,
});

describe('clampFlowIndex', () => {
  it('keeps the index inside the list', () => {
    expect(clampFlowIndex(-2, 4)).toBe(0);
    expect(clampFlowIndex(9, 4)).toBe(3);
    expect(clampFlowIndex(2, 4)).toBe(2);
    expect(clampFlowIndex(3, 0)).toBe(0);
  });
});

describe('coverFlowSlot', () => {
  it('centers the active card flat and full size', () => {
    expect(coverFlowSlot(0)).toMatchObject({ shift: 0, rotateY: 0, scale: 1 });
  });
  it('tilts neighbors toward the center, mirrored per side', () => {
    const left = coverFlowSlot(-1);
    const right = coverFlowSlot(1);
    expect(left.shift).toBe(-right.shift);
    expect(left.rotateY).toBe(-right.rotateY);
    expect(left.scale).toBeLessThan(1);
  });
  it('hides cards beyond the side reach', () => {
    expect(coverFlowSlot(3).opacity).toBe(0);
  });
});

describe('coverFlowSlot (continuous)', () => {
  it('interpolates between rest positions', () => {
    const half = coverFlowSlot(0.5);
    expect(half.rotateY).toBeLessThan(0);
    expect(half.rotateY).toBeGreaterThan(coverFlowSlot(1).rotateY);
    expect(half.scale).toBeGreaterThan(coverFlowSlot(1).scale);
    expect(half.scale).toBeLessThan(1);
  });
  it('fades out smoothly past the side reach', () => {
    expect(coverFlowSlot(2.5).opacity).toBeGreaterThan(0);
    expect(coverFlowSlot(2.5).opacity).toBeLessThan(coverFlowSlot(2).opacity);
    expect(coverFlowSlot(3).opacity).toBe(0);
  });
});

describe('settleFlowIndex', () => {
  it('lands on the nearest card when released slowly', () => {
    expect(settleFlowIndex(2.2, 0.1, 6)).toBe(2);
    expect(settleFlowIndex(2.6, 0, 6)).toBe(3);
  });
  it('carries momentum to a farther card', () => {
    expect(settleFlowIndex(2.1, 8, 10)).toBe(4);
    expect(settleFlowIndex(2.1, -8, 10)).toBe(1);
  });
  it('moves at least one card on a quick flick', () => {
    expect(settleFlowIndex(2.05, 0.9, 6)).toBe(3);
    expect(settleFlowIndex(2.05, -0.9, 6)).toBe(1);
  });
  it('never leaves the list', () => {
    expect(settleFlowIndex(0.1, -9, 4)).toBe(0);
    expect(settleFlowIndex(2.9, 9, 4)).toBe(3);
  });
});

describe('rubberBandPosition', () => {
  it('passes through inside the list and damps past the ends', () => {
    expect(rubberBandPosition(1.5, 4)).toBe(1.5);
    expect(rubberBandPosition(-1, 4)).toBeCloseTo(-0.35);
    expect(rubberBandPosition(4, 4)).toBeCloseTo(3.35);
  });
});

describe('groupWalletsBySection', () => {
  it('splits funding wallets from credit cards', () => {
    const sections = groupWalletsBySection([
      wallet({ id: 1, type: 'CASH' }),
      wallet({ id: 2, type: 'CREDIT_CARD' }),
      wallet({ id: 3, type: 'DEPARTMENT_STORE_CARD' }),
    ]);
    expect(sections.funding.map((w) => w.id)).toEqual([1]);
    expect(sections.credit.map((w) => w.id)).toEqual([2, 3]);
  });
});

describe('summarizeWallets', () => {
  it('totals liquidity, card debt and available credit over active wallets', () => {
    const totals = summarizeWallets([
      wallet({ amount: 1000, type: 'CASH' }),
      wallet({ amount: 500, include_in_liquidity: false }),
      wallet({ amount: 700, active: false }),
      wallet({ amount: 400, type: 'CREDIT_CARD', credit_limit: 1000 }),
      wallet({ amount: 100, type: 'CREDIT_CARD', credit_limit: 300 }),
    ]);
    expect(totals).toEqual({
      liquidity: 1000,
      cardDebt: 500,
      availableCredit: 800,
    });
  });
});

describe('daysUntilDueDay', () => {
  const today = { day: 25, daysInMonth: 30 };
  it('counts within the month', () => {
    expect(daysUntilDueDay(28, today)).toBe(3);
    expect(daysUntilDueDay(25, today)).toBe(0);
  });
  it('wraps to next month', () => {
    expect(daysUntilDueDay(2, today)).toBe(7);
  });
});

describe('buildAttentionItems', () => {
  const today = { day: 25, daysInMonth: 30 };
  it('flags cards due soon, over limit and negative funding wallets', () => {
    const items = buildAttentionItems(
      [
        wallet({ id: 1, type: 'CREDIT_CARD', amount: 200, due_day: 28 }),
        wallet({ id: 2, type: 'CREDIT_CARD', amount: 200, due_day: 15 }),
        wallet({ id: 3, type: 'CREDIT_CARD', amount: 2000, credit_limit: 1000 }),
        wallet({ id: 4, type: 'CASH', amount: -5 }),
        wallet({ id: 5, type: 'CREDIT_CARD', amount: 0, due_day: 26 }),
      ],
      today,
    );
    expect(items.map((i) => [i.wallet.id, i.reason])).toEqual([
      [3, 'over-limit'],
      [4, 'negative-balance'],
      [1, 'due-soon'],
    ]);
  });
});

describe('wallet type segments', () => {
  const all = [
    wallet({ id: 1, type: 'CASH' }),
    wallet({ id: 2, type: 'CREDIT_CARD' }),
    wallet({ id: 3, type: 'CREDIT_CARD' }),
  ];
  it('filters by type and keeps everything for "all"', () => {
    expect(filterWalletsBySegment(all, 'all')).toHaveLength(3);
    expect(filterWalletsBySegment(all, 'CREDIT_CARD').map((w) => w.id)).toEqual([2, 3]);
    expect(filterWalletsBySegment(all, 'DEBIT_CARD')).toEqual([]);
  });
  it('offers only types that have wallets, after "Todas"', () => {
    expect(availableWalletSegments(all).map((s) => s.value)).toEqual([
      'all',
      'CASH',
      'CREDIT_CARD',
    ]);
  });
});
