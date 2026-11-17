import { describe, expect, it } from 'vitest';
import {
  carouselIndexFromScroll,
  carouselTypeRange,
  clampCarouselIndex,
  firstCarouselIndexOfType,
  getWalletCarouselActionPlan,
  getWalletCreditSummary,
  groupWalletsByCarouselType,
  orderWalletsForCarousel,
  resolveStoredCarouselIndex,
} from './wallet-carousel';

describe('getWalletCarouselActionPlan', () => {
  it('maps cash and debit to balance / expense / income dialogs', () => {
    for (const type of ['CASH', 'DEBIT_CARD']) {
      expect(getWalletCarouselActionPlan(type)).toMatchObject({
        topUp: 'balance',
        addExpense: 'expense',
        request: 'income',
        balanceVariant: 'funding',
      });
    }
  });

  it('maps credit and store to balance / purchase / payment dialogs', () => {
    for (const type of ['CREDIT_CARD', 'DEPARTMENT_STORE_CARD']) {
      expect(getWalletCarouselActionPlan(type)).toMatchObject({
        topUp: 'balance',
        addExpense: 'purchase',
        request: 'payment',
        balanceVariant: 'credit',
      });
    }
  });
});

describe('groupWalletsByCarouselType', () => {
  it('groups by type and drops goal wallets', () => {
    const groups = groupWalletsByCarouselType([
      { id: 1, type: 'DEBIT_CARD' },
      { id: 2, type: 'GOAL' },
      { id: 3, type: 'CASH' },
      { id: 4, type: 'DEBIT_CARD' },
    ]);
    expect(groups.DEBIT_CARD.map((w) => w.id)).toEqual([1, 4]);
    expect(groups.CASH.map((w) => w.id)).toEqual([3]);
    expect(groups.CREDIT_CARD).toEqual([]);
  });
});

const track = [
  { id: 1, type: 'CASH' },
  { id: 2, type: 'CASH' },
  { id: 3, type: 'DEBIT_CARD' },
  { id: 4, type: 'DEPARTMENT_STORE_CARD' },
  { id: 5, type: 'DEPARTMENT_STORE_CARD' },
];

describe('continuous track', () => {
  it('groups in tab order, keeps the given order inside a type, drops goals', () => {
    const ordered = orderWalletsForCarousel([
      { id: 9, type: 'DEPARTMENT_STORE_CARD' },
      { id: 8, type: 'GOAL' },
      { id: 7, type: 'DEBIT_CARD' },
      { id: 6, type: 'CASH' },
      { id: 5, type: 'DEBIT_CARD' },
      { id: 4, type: 'CREDIT_CARD' },
    ]);
    expect(ordered.map((w) => w.id)).toEqual([6, 7, 5, 4, 9]);
  });

  it('finds the first card of a type', () => {
    expect(firstCarouselIndexOfType(track, 'DEBIT_CARD')).toBe(2);
    expect(firstCarouselIndexOfType(track, 'DEPARTMENT_STORE_CARD')).toBe(3);
    expect(firstCarouselIndexOfType(track, 'CREDIT_CARD')).toBe(-1);
  });

  it('returns the run of the active card type', () => {
    expect(carouselTypeRange(track, 1)).toEqual({ start: 0, end: 2 });
    expect(carouselTypeRange(track, 2)).toEqual({ start: 2, end: 3 });
    expect(carouselTypeRange(track, 9)).toEqual({ start: 3, end: 5 });
    expect(carouselTypeRange([], 0)).toEqual({ start: 0, end: 0 });
  });

  it('restores the stored wallet, falling back to the first card', () => {
    expect(resolveStoredCarouselIndex(track, '4')).toBe(3);
    expect(resolveStoredCarouselIndex(track, '99')).toBe(0);
    expect(resolveStoredCarouselIndex(track, 'abc')).toBe(0);
    expect(resolveStoredCarouselIndex(track, null)).toBe(0);
  });

  it('maps scroll position to the centered card', () => {
    expect(carouselIndexFromScroll(0, 284, 5)).toBe(0);
    expect(carouselIndexFromScroll(300, 284, 5)).toBe(1);
    expect(carouselIndexFromScroll(5000, 284, 5)).toBe(4);
    expect(carouselIndexFromScroll(300, 0, 5)).toBe(0);
  });
});

describe('carousel helpers', () => {
  it('clamps the index', () => {
    expect(clampCarouselIndex(5, 3)).toBe(2);
    expect(clampCarouselIndex(-1, 3)).toBe(0);
    expect(clampCarouselIndex(2, 0)).toBe(0);
  });

  it('summarises credit using the larger of contract and temporary limit', () => {
    expect(
      getWalletCreditSummary({
        amount: 1000,
        credit_limit: 5000,
        temporary_credit_limit: 8000,
      }),
    ).toEqual({ used: 1000, limit: 8000, available: 7000 });
    expect(getWalletCreditSummary({ amount: 9000, credit_limit: 5000 })).toEqual(
      { used: 9000, limit: 5000, available: 0 },
    );
    expect(getWalletCreditSummary({ amount: 10 })).toEqual({
      used: 10,
      limit: null,
      available: null,
    });
  });
});
